-- 000 — Mengunci tabel lama family_tree (aplikasi lama).
--
-- Sebelum file ini, siapa pun yang memegang kunci publik (anon key)
-- aplikasi lama — kunci itu tertulis di repo publik lama — bisa membaca
-- DAN menimpa seluruh silsilah. Setelah file ini:
--
--   1. RLS aktif di family_tree dan semua policy lamanya dihapus:
--      tidak ada yang bisa membaca atau menulis lewat aplikasi/API.
--   2. Semua hak (grant) anon, authenticated, dan PUBLIC pada tabel itu
--      (dan sequence-nya, kalau ada) dicabut.
--   3. Tabel dikeluarkan dari Realtime.
--   4. Data TIDAK diubah dan TIDAK dihapus. Isinya tetap bisa dilihat
--      dari Dashboard (Table Editor / SQL Editor) untuk migrasi nanti.
--   5. Pemeriksaan di akhir: kolom "hasil" harus sama dengan kolom "harus".
--
-- Akibatnya aplikasi lama berhenti berfungsi (sudah disetujui).
-- Aman dijalankan ulang.
--
-- Cara pakai: Supabase Dashboard → project "silsilah-keluarga" →
-- SQL Editor → New query → tempel SELURUH isi file ini → Run.

begin;

-- ── 1. RLS aktif ──────────────────────────────────────────────────
alter table public.family_tree enable row level security;

-- ── 2. Hapus semua policy lama ────────────────────────────────────
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'family_tree'
  loop
    execute format('drop policy %I on public.family_tree', p.policyname);
  end loop;
end $$;

-- ── 3. Cabut semua hak ────────────────────────────────────────────
revoke all on table public.family_tree from anon, authenticated, public;

-- Sequence milik tabel (misalnya untuk kolom id), kalau ada.
do $$
declare
  s record;
begin
  for s in
    select seq.relname
    from pg_class seq
    join pg_depend d on d.objid = seq.oid and d.deptype in ('a', 'i')
    join pg_class t on t.oid = d.refobjid
    where seq.relkind = 'S'
      and t.oid = 'public.family_tree'::regclass
  loop
    execute format('revoke all on sequence public.%I from anon, authenticated, public', s.relname);
  end loop;
end $$;

-- ── 4. Keluarkan dari Realtime ────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_tree'
  ) then
    alter publication supabase_realtime drop table public.family_tree;
  end if;
end $$;

-- ── Catatan pada tabel ────────────────────────────────────────────
comment on table public.family_tree is
  'Data aplikasi lama. DIKUNCI (tanpa akses API). Disimpan untuk migrasi; jangan dihapus sebelum data baru diverifikasi.';

commit;

-- ── 5. Pemeriksaan ────────────────────────────────────────────────
select 'RLS aktif di family_tree' as pemeriksaan,
       (select relrowsecurity::text from pg_class where oid = 'public.family_tree'::regclass) as hasil,
       'true' as harus
union all
select 'Jumlah policy di family_tree',
       (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'family_tree'),
       '0'
union all
select 'anon masih punya hak di family_tree',
       (has_table_privilege('anon', 'public.family_tree', 'select')
         or has_table_privilege('anon', 'public.family_tree', 'insert')
         or has_table_privilege('anon', 'public.family_tree', 'update')
         or has_table_privilege('anon', 'public.family_tree', 'delete'))::text,
       'false'
union all
select 'authenticated masih punya hak di family_tree',
       (has_table_privilege('authenticated', 'public.family_tree', 'select')
         or has_table_privilege('authenticated', 'public.family_tree', 'insert')
         or has_table_privilege('authenticated', 'public.family_tree', 'update')
         or has_table_privilege('authenticated', 'public.family_tree', 'delete'))::text,
       'false'
union all
select 'family_tree masih di Realtime',
       (select count(*)::text from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_tree'),
       '0'
union all
select 'Jumlah baris data (tetap ada)',
       (select count(*)::text from public.family_tree),
       '1 atau lebih'
union all
select 'Tabel lain di schema public TANPA RLS',
       coalesce((select string_agg(c.relname, ', ')
                 from pg_class c
                 where c.relnamespace = 'public'::regnamespace
                   and c.relkind in ('r', 'p')
                   and not c.relrowsecurity), 'tidak ada'),
       'tidak ada'
union all
select 'Bucket Storage yang publik',
       coalesce((select string_agg(id, ', ') from storage.buckets where public), 'tidak ada'),
       'tidak ada';
