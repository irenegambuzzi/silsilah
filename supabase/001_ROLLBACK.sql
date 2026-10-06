-- 001_ROLLBACK — Membatalkan 001_dasar_keamanan.sql. HANYA untuk keadaan
-- darurat, dan hanya selama belum ada file 002 atau sesudahnya yang
-- dijalankan (file-file itu bergantung pada 001).
--
--   1. Hak otomatis Supabase untuk anon/authenticated dikembalikan.
--   2. Fungsi db_version(), tabel app_migrations dan settings dihapus.
--   3. Schema private dihapus (hanya kalau masih kosong).
--
-- Cara pakai: SQL Editor → tempel seluruh isi file ini → Run.

begin;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated;

drop function if exists public.db_version();
drop table if exists public.app_migrations;
drop table if exists public.settings;
drop schema if exists private; -- gagal (dan semuanya dibatalkan) kalau tidak kosong

commit;

select 'Rollback 001 selesai' as pemeriksaan,
       (select count(*)::text from pg_namespace where nspname = 'private') as hasil,
       '0' as harus;
