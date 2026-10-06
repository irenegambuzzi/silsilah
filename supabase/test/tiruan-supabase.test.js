// Memastikan tiruan Supabase berperilaku seperti aslinya. Semua tes
// RLS di langkah-langkah berikutnya bersandar pada perilaku ini.
import { beforeAll, describe, expect, it } from 'vitest'
import {
  baris,
  buatDatabase,
  buatDatabaseLengkap,
  buatPengguna,
  daftarMigrasi,
  klaimUntuk,
  sebagai,
} from './tiruan-supabase.js'

let db
let budi

beforeAll(async () => {
  db = await buatDatabase()
  budi = await buatPengguna(db, { email: 'budi@contoh.invalid' })

  // Tabel uji dengan RLS: setiap pengguna hanya melihat barisnya sendiri.
  await db.exec(`
    create table public.catatan_uji (
      id serial primary key,
      pemilik uuid not null,
      isi text not null
    );
    alter table public.catatan_uji enable row level security;
    create policy milik_sendiri on public.catatan_uji
      for all to authenticated
      using (pemilik = auth.uid()) with check (pemilik = auth.uid());
    grant select, insert on public.catatan_uji to authenticated;
    grant usage on sequence public.catatan_uji_id_seq to authenticated;
  `)
  await db.query(`insert into public.catatan_uji (pemilik, isi) values ($1, 'milik budi'), (gen_random_uuid(), 'milik orang lain')`, [budi.userId])
}, 30000)

describe('auth: klaim JWT', () => {
  it('auth.uid(), session_id, dan aal terbaca dari klaim', async () => {
    const [r] = await sebagai(db, 'authenticated', klaimUntuk(budi, 'aal2'), (tx) =>
      baris(tx, `select auth.uid() as uid, auth.role() as peran,
                        auth.jwt() ->> 'session_id' as sesi, auth.jwt() ->> 'aal' as aal,
                        current_user as role_db`)
    )
    expect(r).toEqual({ uid: budi.userId, peran: 'authenticated', sesi: budi.sessionId, aal: 'aal2', role_db: 'authenticated' })
  })

  it('anon tidak punya uid', async () => {
    const [r] = await sebagai(db, 'anon', {}, (tx) => baris(tx, `select auth.uid() as uid, current_user as role_db`))
    expect(r).toEqual({ uid: null, role_db: 'anon' })
  })

  it('di luar permintaan (sebagai pemilik database) tidak ada klaim yang tertinggal', async () => {
    await sebagai(db, 'authenticated', klaimUntuk(budi), (tx) => baris(tx, 'select 1'))
    const [r] = await baris(db, `select auth.uid() as uid, current_user as role_db`)
    expect(r.uid).toBeNull()
    expect(r.role_db).toBe('postgres')
  })

  it('permintaan API berjalan dengan session_user authenticator, lalu kembali ke postgres', async () => {
    const [r] = await sebagai(db, 'authenticated', klaimUntuk(budi), (tx) => baris(tx, 'select session_user::text as s'))
    expect(r.s).toBe('authenticator')
    await expect(sebagai(db, 'anon', {}, () => { throw new Error('gagal') })).rejects.toThrow('gagal')
    const [k] = await baris(db, `select session_user::text as s, current_user::text as c`)
    expect(k).toEqual({ s: 'postgres', c: 'postgres' })
  })
})

describe('RLS bekerja dengan tiruan ini', () => {
  it('pengguna hanya melihat barisnya sendiri', async () => {
    const r = await sebagai(db, 'authenticated', klaimUntuk(budi), (tx) => baris(tx, `select isi from public.catatan_uji`))
    expect(r).toEqual([{ isi: 'milik budi' }])
  })

  it('seperti Supabase: tabel baru otomatis bisa diakses anon, hanya RLS yang menahan', async () => {
    const r = await sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from public.catatan_uji`))
    expect(r).toEqual([])
  })

  it('anon tidak bisa membaca tabel yang hak-nya dicabut', async () => {
    await db.exec(`revoke all on public.catatan_uji from anon`)
    await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from public.catatan_uji`))).rejects.toThrow(/permission denied/)
  })

  it('menulis atas nama orang lain ditolak policy', async () => {
    await expect(
      sebagai(db, 'authenticated', klaimUntuk(budi), (tx) =>
        tx.query(`insert into public.catatan_uji (pemilik, isi) values (gen_random_uuid(), 'palsu')`)
      )
    ).rejects.toThrow(/row-level security/)
  })

  it('transaksi yang gagal dibatalkan seluruhnya', async () => {
    await expect(
      sebagai(db, 'authenticated', klaimUntuk(budi), async (tx) => {
        await tx.query(`insert into public.catatan_uji (pemilik, isi) values ($1, 'sementara')`, [budi.userId])
        throw new Error('gagal di tengah')
      })
    ).rejects.toThrow('gagal di tengah')
    const r = await baris(db, `select count(*)::int as n from public.catatan_uji where isi = 'sementara'`)
    expect(r[0].n).toBe(0)
  })

  it('service_role melewati RLS', async () => {
    await db.exec(`grant select on public.catatan_uji to service_role`)
    const r = await sebagai(db, 'service_role', {}, (tx) => baris(tx, `select count(*)::int as n from public.catatan_uji`))
    expect(r[0].n).toBe(2)
  })

  it('peran yang tidak dikenal ditolak oleh pembantu tes', async () => {
    await expect(sebagai(db, 'postgres', {}, () => {})).rejects.toThrow(/tidak dikenal/)
  })
})

describe('ekstensi dan schema Supabase lain', () => {
  it('pgcrypto ada di schema extensions', async () => {
    const [r] = await baris(db, `select encode(extensions.digest('abc', 'sha256'), 'hex') as h,
                                        length(extensions.gen_random_bytes(32)) as n`)
    expect(r.h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(r.n).toBe(32)
  })

  it('vault: rahasia bisa dibuat dan dibaca pemilik database', async () => {
    await baris(db, `select vault.create_secret('nilai-rahasia-uji', 'kunci_uji')`)
    const [r] = await baris(db, `select decrypted_secret from vault.decrypted_secrets where name = 'kunci_uji'`)
    expect(r.decrypted_secret).toBe('nilai-rahasia-uji')
  })

  it('vault: anon dan authenticated tidak bisa membacanya', async () => {
    for (const peran of ['anon', 'authenticated']) {
      await expect(
        sebagai(db, peran, klaimUntuk(budi), (tx) => baris(tx, `select * from vault.decrypted_secrets`))
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('storage dan publication realtime tersedia', async () => {
    const [r] = await baris(db, `select
      (select count(*)::int from information_schema.tables where table_schema = 'storage') as tabel_storage,
      (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) as rls_objects,
      (select count(*)::int from pg_publication where pubname = 'supabase_realtime') as publikasi`)
    expect(r).toEqual({ tabel_storage: 2, rls_objects: true, publikasi: 1 })
  })
})

describe('migrasi', () => {
  it('daftar migrasi tidak memuat 000, _ROLLBACK, atau _jadwal', () => {
    for (const f of daftarMigrasi()) expect(f).toMatch(/^(?!000_)\d{3}_(?!.*_(ROLLBACK|jadwal)\.sql$).*\.sql$/i)
  })

  it('semua migrasi berjalan di database tes (saat ini belum ada)', async () => {
    const lengkap = await buatDatabaseLengkap()
    const [r] = await baris(lengkap, 'select 1 as ok')
    expect(r.ok).toBe(1)
    await lengkap.close()
  }, 30000)
})
