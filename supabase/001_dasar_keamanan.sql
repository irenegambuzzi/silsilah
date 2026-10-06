-- 001 — Dasar keamanan dan pengaturan aplikasi.
--
-- Di Supabase, setiap tabel, sequence, dan fungsi BARU di schema public
-- otomatis bisa diakses oleh anon (tamu tanpa login) dan authenticated
-- (siapa pun yang login). Satu kelalaian RLS saja bisa membuka data.
-- File ini membalik aturan itu sebelum tabel apa pun dibuat:
--
--   1. Hak otomatis untuk anon dan authenticated di schema public
--      DICABUT. Mulai sekarang setiap hak harus diberikan dengan sengaja
--      di file SQL berikutnya. (service_role tetap: dipakai Edge Function
--      dan selalu melewati RLS.)
--   2. Schema "private": tidak terbuka ke API sama sekali. Nanti berisi
--      data kontak, token undangan, lokasi, snapshot, dan log login;
--      hanya bisa diakses lewat fungsi yang memeriksa izin.
--   3. Tabel "settings" (satu baris): pengaturan aplikasi beserta nilai
--      bawaannya. Hanya konfigurasi, tanpa data keluarga.
--   4. Tabel "app_migrations": catatan file SQL yang sudah dijalankan,
--      dan fungsi db_version() supaya aplikasi bisa menolak berjalan
--      kalau database belum diperbarui.
--   5. Pemeriksaan di akhir: kolom "hasil" harus sama dengan "harus".
--
-- Catatan: Postgres selalu mengizinkan PUBLIC (termasuk anon) menjalankan
-- fungsi baru. Karena itu setiap fungsi di file-file kita mencabut hak itu
-- sendiri, dan pemeriksaan di akhir setiap file menjaganya.
--
-- Aman dijalankan ulang. Untuk membatalkan: 001_ROLLBACK.sql.
-- Cara pakai: Supabase Dashboard → SQL Editor → New query → tempel SELURUH
-- isi file ini → Run.

begin;

-- ── 1. Cabut hak otomatis untuk anon dan authenticated ────────────
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- ── 2. Schema private ─────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── 3. Pengaturan aplikasi ────────────────────────────────────────
create table if not exists public.settings (
  -- Selalu true: menjamin hanya ada satu baris.
  id boolean primary key default true check (id),

  -- Istilah generasi Jawa, mulai GEN.0. Setelah GEN.10 hanya "GEN.n".
  generation_terms text[] not null default array[
    'Pangkal', 'Anak', 'Putu', 'Buyut', 'Canggah', 'Wareng',
    'Udheg-udheg', 'Gantung siwur', 'Gropak senthe', 'Debog bosok', 'Galih asem'
  ],

  -- Data kontak: batas pembukaan per hari (dihitung per orang yang dibuka).
  contact_quota_member int not null default 20 check (contact_quota_member >= 0),
  contact_quota_assistant int not null default 50 check (contact_quota_assistant >= 0),

  -- Perangkat dan akses sementara.
  device_codes_enabled boolean not null default true,
  temp_access_max_minutes int not null default 1440
    check (temp_access_max_minutes between 30 and 10080),

  -- Notifikasi: jam tenang (menurut zona waktu perangkat penerima).
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '06:00',
  login_digest_hourly boolean not null default false,
  -- Kode negara ISO; login dari negara lain dianggap mencurigakan.
  usual_countries text[] not null default array['ID', 'IT'],

  -- Kabar Keluarga.
  news_daily_limit int not null default 5 check (news_daily_limit >= 0),
  near_radius_km int not null default 50 check (near_radius_km > 0),

  -- Deteksi aktivitas tidak wajar.
  anomaly_max_changes int not null default 30 check (anomaly_max_changes > 0),
  anomaly_window_minutes int not null default 10 check (anomaly_window_minutes > 0),

  -- Kumpul Keluarga: pengingat hari H.
  gathering_reminder_morning time not null default '07:00',
  gathering_reminder_hours_before int not null default 2
    check (gathering_reminder_hours_before between 1 and 12),

  -- Pengingat unduh backup: lebih cepat kalau sudah sebanyak ini perubahan.
  backup_reminder_change_threshold int not null default 500
    check (backup_reminder_change_threshold > 0),

  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

-- Belum ada yang boleh membaca atau mengubah lewat API. Policy untuk
-- anggota dan admin ditambahkan setelah tabel anggota ada (file 004/005).
alter table public.settings enable row level security;
revoke all on table public.settings from public, anon, authenticated;

-- ── 4. Catatan migrasi ────────────────────────────────────────────
create table if not exists public.app_migrations (
  version text primary key check (version ~ '^\d{3}$'),
  name text not null,
  first_applied_at timestamptz not null default now(),
  last_applied_at timestamptz not null default now()
);
alter table public.app_migrations enable row level security;
revoke all on table public.app_migrations from public, anon, authenticated;

-- Versi database terbaru, untuk dicocokkan aplikasi. Hanya untuk yang
-- login; isinya bukan rahasia, jadi tidak perlu pemeriksaan anggota.
create or replace function public.db_version()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select max(version) from public.app_migrations
$$;
revoke all on function public.db_version() from public, anon, authenticated;
grant execute on function public.db_version() to authenticated;

insert into public.app_migrations (version, name)
values ('001', 'dasar_keamanan')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── 5. Pemeriksaan ────────────────────────────────────────────────
with
  bawaan as (
    select a.grantee
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
  ),
  fungsi_kita as (
    select p.oid, n.nspname || '.' || p.proname as nama
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ),
  tabel_kita as (
    select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
  )
select 'Hak otomatis untuk anon/authenticated di schema public' as pemeriksaan,
       (select count(*)::text from bawaan
        where grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid)) as hasil,
       '0' as harus
union all
select 'Schema private ada',
       (select count(*)::text from pg_namespace where nspname = 'private'),
       '1'
union all
select 'anon/authenticated bisa memakai schema private',
       (has_schema_privilege('anon', 'private', 'usage')
         or has_schema_privilege('authenticated', 'private', 'usage'))::text,
       'false'
union all
select 'Tabel di public/private TANPA RLS',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel_kita where not rls), 'tidak ada'),
       'tidak ada'
union all
select 'Tabel di public/private yang bisa dibaca/ditulis anon',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel_kita
                 where has_table_privilege('anon', oid, 'select')
                    or has_table_privilege('anon', oid, 'insert')
                    or has_table_privilege('anon', oid, 'update')
                    or has_table_privilege('anon', oid, 'delete')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi di public/private yang bisa dijalankan anon',
       coalesce((select string_agg(nama, ', ' order by nama) from fungsi_kita
                 where has_function_privilege('anon', oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Jumlah baris settings',
       (select count(*)::text from public.settings),
       '1'
union all
select 'Versi database',
       public.db_version(),
       '001 atau lebih';
