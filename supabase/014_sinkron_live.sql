-- 014 — Sinkron live (Realtime) untuk silsilah.
--
-- Aplikasi memuat data silsilah sekali, lalu menerima perubahan secara
-- live lewat Supabase Realtime. Realtime menghormati RLS: setiap anggota
-- hanya menerima perubahan pada baris yang memang boleh ia baca.
--
-- Akibat RLS itu, satu jenis perubahan TIDAK sampai: baris yang disisihkan.
-- Setelah disisihkan, baris itu tidak lagi boleh dibaca anggota
-- biasa, jadi Realtime tidak mengirim apa pun kepadanya, dan orang itu akan
-- tetap tampil di HP anggota sampai aplikasi memuat ulang. Karena itu:
--
--   sync_removals   penanda "baris ini keluar dari tampilan": hanya nama
--                   tabel, id baris, pohon, dan waktu. TANPA isi data.
--                   Diisi trigger saat baris people/unions/children disisihkan;
--                   penanda yang berumur lebih dari 1 hari
--                   dihapus sendiri (aplikasi yang lama tertutup memuat
--                   ulang semua data saat dibuka lagi).
--
-- Hapus permanen tidak membutuhkan penanda: Realtime selalu mengirim
-- peristiwa DELETE (hanya berisi id).
--
-- Tabel yang didaftarkan ke publikasi "supabase_realtime":
--   people, unions, children, birth_ranks, origin_trees, settings,
--   sync_removals.
-- Tidak ada data kontak di tabel-tabel ini (kontak ada di schema private,
-- yang tidak pernah didaftarkan ke Realtime).
--
-- Aman dijalankan ulang. Membutuhkan 001–013.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── 1. Penanda baris yang keluar dari tampilan ────────────────────
create table if not exists public.sync_removals (
  id bigint generated always as identity primary key,
  table_name text not null check (table_name in ('people', 'unions', 'children')),
  row_id uuid not null,
  -- null = silsilah utama; terisi = pohon keluarga asal.
  tree_id uuid,
  at timestamptz not null default now()
);
create index if not exists sync_removals_at_idx on public.sync_removals (at);

alter table public.sync_removals enable row level security;
revoke all on table public.sync_removals from public, anon, authenticated;
grant select on table public.sync_removals to authenticated;
-- Hanya trigger di bawah yang menulis; pengguna tidak punya hak tulis.

-- Dibaca dengan aturan yang sama seperti baris aslinya.
drop policy if exists baca on public.sync_removals;
create policy baca on public.sync_removals for select to authenticated using (
  (tree_id is null and (select public.current_member_id()) is not null)
  or tree_id in (select public.viewable_origin_trees()));

create or replace function private.trg_sync_removals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.sync_removals (table_name, row_id, tree_id)
    values (tg_table_name, new.id, new.tree_id);
    delete from public.sync_removals where at < now() - interval '1 day';
  end if;
  return null;
end $$;
revoke all on function private.trg_sync_removals() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['people', 'unions', 'children'] loop
    execute format('drop trigger if exists sync_removals on public.%I', t);
    execute format(
      'create trigger sync_removals after update of deleted_at on public.%I
       for each row execute function private.trg_sync_removals()', t);
  end loop;
end $$;

-- ── 2. Daftarkan tabel ke Realtime ────────────────────────────────
-- Publikasi "supabase_realtime" dibuat Supabase sendiri. Kalau tidak ada,
-- pemeriksaan di bawah menunjukkannya.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['people', 'unions', 'children', 'birth_ranks', 'origin_trees', 'settings', 'sync_removals'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

insert into public.app_migrations (version, name)
values ('014', 'sinkron_live')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Tabel silsilah yang terdaftar di Realtime (dari 7)' as pemeriksaan,
       (select count(*)::text from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename in ('people', 'unions', 'children', 'birth_ranks', 'origin_trees', 'settings', 'sync_removals')) as hasil,
       '7' as harus
union all
select 'Tabel schema private yang terdaftar di Realtime',
       coalesce((select string_agg(tablename, ', ' order by tablename) from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'private'), 'tidak ada'),
       'tidak ada'
union all
select 'sync_removals memakai RLS',
       (select relrowsecurity::text from pg_class where oid = 'public.sync_removals'::regclass),
       'true'
union all
select 'Hak tulis pengguna atas sync_removals',
       case when has_table_privilege('authenticated', 'public.sync_removals', 'insert')
              or has_table_privilege('authenticated', 'public.sync_removals', 'update')
              or has_table_privilege('authenticated', 'public.sync_removals', 'delete')
              or has_table_privilege('anon', 'public.sync_removals', 'select')
            then 'ada' else 'tidak ada' end,
       'tidak ada'
union all
select 'Trigger penanda data yang disisihkan (dari 3)',
       (select count(*)::text from pg_trigger
        where tgname = 'sync_removals' and not tgisinternal
          and tgrelid in ('public.people'::regclass, 'public.unions'::regclass, 'public.children'::regclass)),
       '3'
union all
select 'Versi database',
       public.db_version(),
       '014 atau lebih';
