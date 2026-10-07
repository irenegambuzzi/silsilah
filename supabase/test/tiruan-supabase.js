// Database tes: Postgres sungguhan (PGlite) yang di dalamnya ditiru
// bagian-bagian Supabase yang dipakai file SQL kita. Dengan begitu semua
// RLS, trigger, dan fungsi bisa dites tanpa Docker dan tanpa menyentuh
// database asli.
//
// Yang ditiru (meniru nama dan perilaku di Supabase):
//   - role anon, authenticated, service_role (service_role melewati RLS),
//     dan authenticator (pengguna sesi untuk semua permintaan API);
//   - schema auth: tabel users, sessions, dan mfa_factors; fungsi auth.uid(),
//     auth.role(), auth.jwt() yang membaca klaim JWT dari setting
//     request.jwt.claims, persis seperti PostgREST di Supabase;
//   - schema extensions dengan pgcrypto (di Supabase, pgcrypto ada di sana);
//   - schema storage: tabel buckets dan objects (RLS aktif);
//   - schema vault: create_secret() dan view decrypted_secrets. Di sini
//     rahasia TIDAK dienkripsi; cukup untuk menguji siapa yang boleh
//     membacanya;
//   - publication supabase_realtime.
// Tidak ditiru: pg_cron dan pg_net. Jadwal ditulis di file SQL terpisah
// (berakhiran _jadwal.sql) yang tidak dijalankan di tes; fungsi yang
// dipanggil jadwal dites langsung.

import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import path from 'node:path'

export const FOLDER_SQL = path.join(import.meta.dirname, '..')

const SQL_TIRUAN = `
  -- Role seperti di Supabase.
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  -- Seperti di Supabase: semua permintaan API masuk sebagai "authenticator"
  -- (session_user), lalu berpindah ke anon/authenticated/service_role.
  create role authenticator login noinherit;
  grant anon, authenticated, service_role to authenticator;

  -- Seperti di Supabase: setiap tabel, sequence, dan fungsi BARU di schema
  -- public otomatis bisa diakses anon, authenticated, dan service_role.
  -- File 001 mencabut hak otomatis ini untuk anon dan authenticated.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant all on functions to anon, authenticated, service_role;

  -- pgcrypto di schema extensions, seperti di Supabase.
  create schema extensions;
  create extension pgcrypto schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  -- ── auth ─────────────────────────────────────────────────────────
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    banned_until timestamptz,
    created_at timestamptz not null default now()
  );
  -- Authenticator (TOTP dll.). Di Supabase factor_type dan status berupa
  -- enum; di sini teks dengan nilai yang sama.
  create table auth.mfa_factors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    friendly_name text,
    factor_type text not null default 'totp' check (factor_type in ('totp', 'phone', 'webauthn')),
    status text not null default 'unverified' check (status in ('unverified', 'verified')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    aal text not null default 'aal1',
    created_at timestamptz not null default now()
  );

  -- Sama seperti di Supabase: klaim dibaca dari request.jwt.claims (JSON),
  -- dengan request.jwt.claim.sub sebagai cara lama.
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  -- ── storage ──────────────────────────────────────────────────────
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    created_at timestamptz not null default now()
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;

  -- ── vault ────────────────────────────────────────────────────────
  create schema vault;
  create table vault.secrets (
    id uuid primary key default gen_random_uuid(),
    name text unique,
    description text not null default '',
    secret text not null,
    created_at timestamptz not null default now()
  );
  create view vault.decrypted_secrets as
    select id, name, description, secret, secret as decrypted_secret, created_at
    from vault.secrets;
  create function vault.create_secret(
    new_secret text, new_name text default null,
    new_description text default '', new_key_id uuid default null
  ) returns uuid language sql as $$
    insert into vault.secrets (secret, name, description)
    values (new_secret, new_name, new_description)
    returning id
  $$;
  -- Seperti di Supabase: anon dan authenticated tidak bisa menyentuh vault.
  revoke all on schema vault from public;

  -- ── realtime ─────────────────────────────────────────────────────
  create publication supabase_realtime;
`

// Database baru dengan tiruan Supabase, tanpa migrasi kita.
export async function buatDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(SQL_TIRUAN)
  return db
}

// File migrasi kita, berurutan: 001_…sql, 002_…sql, dst.
// Tidak termasuk: 000 (mengunci tabel aplikasi lama, dites terpisah),
// file _ROLLBACK, dan file _jadwal (pg_cron).
export function daftarMigrasi() {
  return fs
    .readdirSync(FOLDER_SQL)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .filter((f) => !f.startsWith('000_') && !/_ROLLBACK\.sql$/i.test(f) && !/_jadwal\.sql$/i.test(f))
    .sort()
}

export async function jalankanMigrasi(db) {
  for (const f of daftarMigrasi()) {
    await db.exec(fs.readFileSync(path.join(FOLDER_SQL, f), 'utf8'))
  }
}

// Database lengkap: tiruan Supabase + semua migrasi kita.
export async function buatDatabaseLengkap() {
  const db = await buatDatabase()
  await jalankanMigrasi(db)
  return db
}

// Menjalankan fn seperti permintaan dari aplikasi lewat API Supabase:
// di dalam satu transaksi, dengan role dan klaim JWT tertentu.
//   peran: 'anon' | 'authenticated' | 'service_role'
//   klaim: { sub, session_id, aal, ... } (dilewati untuk anon)
// Kalau fn melempar error, transaksi dibatalkan dan error diteruskan.
export async function sebagai(db, peran, klaim, fn) {
  if (!['anon', 'authenticated', 'service_role'].includes(peran)) {
    throw new Error(`Peran tidak dikenal: ${peran}`)
  }
  const isiKlaim = { role: peran, aal: 'aal1', ...klaim }
  try {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local session authorization authenticator; set local role ${peran}`)
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(isiKlaim)])
      return fn(tx)
    })
  } finally {
    // Di PGlite "set local session authorization" tidak kembali sendiri
    // setelah transaksi; kembalikan secara eksplisit.
    await db.exec('set session authorization postgres; reset role')
  }
}

// Pengguna Auth tiruan + satu sesi. Hasil: { userId, sessionId }.
export async function buatPengguna(db, { email, aal = 'aal1' } = {}) {
  const { rows: [u] } = await db.query(
    `insert into auth.users (email) values ($1) returning id`,
    [email ?? `uji-${Math.random().toString(36).slice(2)}@contoh.invalid`]
  )
  const { rows: [s] } = await db.query(
    `insert into auth.sessions (user_id, aal) values ($1, $2) returning id`,
    [u.id, aal]
  )
  return { userId: u.id, sessionId: s.id }
}

// Klaim JWT untuk pengguna itu, seperti yang dikirim supabase-js.
export const klaimUntuk = ({ userId, sessionId }, aal = 'aal1') => ({
  sub: userId,
  session_id: sessionId,
  aal,
})

// Singkatan query yang mengembalikan baris.
export const baris = async (db, sql, params) => (await db.query(sql, params)).rows

// Menjalankan satu file SQL kita dan mengembalikan baris pemeriksaan di
// akhirnya yang TIDAK sesuai (kolom "hasil" ≠ "harus"). Kosong = semua sesuai.
// "N atau lebih" berarti hasil ≥ N.
export async function jalankanFileDanPeriksa(db, namaFile) {
  const hasil = await db.exec(fs.readFileSync(path.join(FOLDER_SQL, namaFile), 'utf8'))
  const rows = hasil.at(-1).rows
  return rows.filter((r) => {
    const m = /^(\S+) atau lebih$/.exec(r.harus)
    if (m) return !(r.hasil != null && (isNaN(m[1]) ? r.hasil >= m[1] : Number(r.hasil) >= Number(m[1])))
    return r.hasil !== r.harus
  })
}
