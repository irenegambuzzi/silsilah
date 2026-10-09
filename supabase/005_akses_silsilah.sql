-- 005 — Siapa boleh membaca dan mengubah apa (RLS).
--
-- Mulai file ini, anggota yang login DARI PERANGKAT YANG SAH bisa membaca
-- silsilah utama. Ringkasan:
--
--   Silsilah utama        baca: semua anggota (termasuk "hanya melihat")
--                         ubah/tambah: anggota yang bisa mengedit
--                         (can_edit: bukan "hanya melihat", tidak ditahan)
--                         hapus: tidak ada (hanya lewat penyisihan, 007)
--   Data yang disisihkan baca: hanya izin "sisihkan" (+ admin utama)
--                         ubah: tidak ada
--   Pohon keluarga asal   baca: admin utama; anggota yang diberi izin; dan
--                         kalau "semua keturunan" menyala: keturunan DARAH
--                         pasangan khusus itu (termasuk yang lahir/diundang
--                         nanti) dan pasangan khusus itu sendiri, kecuali
--                         yang ditolak satu per satu. Sakelar mati = hanya
--                         admin utama.
--                         ubah/tambah: hanya admin utama (dengan aal2)
--   Pengaturan            baca: semua anggota · ubah: admin utama
--   Anggota               baca: baris sendiri; semua: izin "lihat_anggota";
--                         nama saja (fungsi member_names()): semua anggota
--                         ubah: nama tampilan sendiri
--   Perangkat             baca: perangkat sendiri; semua: admin utama
--                         ubah: label/zona waktu/terakhir aktif sendiri
--   Tamu (anon)           tidak bisa apa pun.
--
-- Dua aturan tambahan untuk silsilah utama (trigger, berlaku juga kalau
-- aplikasi dilewati; SQL Editor tidak dibatasi):
--   Pernikahan berakhir   status 'cerai' (tampil "Berpisah") hanya boleh
--   karena berpisah       dicatat atau dibatalkan oleh salah satu dari kedua
--                         orang dalam pernikahan itu (kalau mereka anggota),
--                         admin utama, atau asisten dengan izin
--                         "status_pernikahan" (SL010). Pernikahan baru tetap
--                         boleh dicatat walaupun pernikahan sebelumnya belum
--                         ditandai berakhir.
--   "Belum menikah"       people.marital_choice hanya boleh diubah oleh
--                         orangnya sendiri (SL011). Aplikasi tidak pernah
--                         mengisinya otomatis.
--
-- Kolom yang diatur sistem (version, created_*, updated_*, deleted_*,
-- legacy_id) tidak bisa ditulis langsung oleh aplikasi.
--
-- Aman dijalankan ulang. Membutuhkan 001–004.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Akses pohon keluarga asal per orang ───────────────────────────
create table if not exists public.origin_tree_access (
  tree_id uuid not null references public.origin_trees (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  -- 'izinkan' = boleh melihat; 'tolak' = tidak boleh walaupun keturunan.
  mode text not null check (mode in ('izinkan', 'tolak')),
  granted_by uuid references public.members (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (tree_id, member_id)
);

-- true kalau "orang" adalah keturunan DARAH "leluhur" (atau leluhur itu
-- sendiri), lewat hubungan aktif di silsilah utama: anak kandung, atau
-- anak sambung yang orang tua darahnya adalah leluhur tersebut. Anak
-- angkat tidak termasuk.
create or replace function private.is_blood_descendant_or_self(leluhur uuid, orang uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive turunan(id) as (
    select leluhur
    union
    select c.child_id
    from public.children c
    join public.unions u on u.id = c.union_id
    join turunan t on t.id in (u.partner1_id, u.partner2_id)
    where c.tree_id is null and c.deleted_at is null and u.deleted_at is null
      and (c.biological_parent = 'keduanya'
           or (c.biological_parent = 'partner1' and u.partner1_id = t.id)
           or (c.biological_parent = 'partner2' and u.partner2_id = t.id))
  )
  select orang is not null and exists (select 1 from turunan where id = orang)
$$;
revoke all on function private.is_blood_descendant_or_self(uuid, uuid) from public, anon, authenticated;

-- Pohon keluarga asal yang boleh dilihat si pemanggil. Dihitung sekali
-- per permintaan (dipakai sebagai "tree_id in (select …)").
create or replace function public.viewable_origin_trees()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with saya as (
    select m.id, m.person_id from public.members m where m.id = public.current_member_id()
  )
  select t.id
  from public.origin_trees t
  where public.is_owner()
     or exists (
       select 1 from saya
       where t.is_active
         and (
           exists (select 1 from public.origin_tree_access a
                   where a.tree_id = t.id and a.member_id = saya.id and a.mode = 'izinkan')
           or (t.grant_all_descendants
               and not exists (select 1 from public.origin_tree_access a
                               where a.tree_id = t.id and a.member_id = saya.id and a.mode = 'tolak')
               and private.is_blood_descendant_or_self(t.anchor_person_id, saya.person_id))))
$$;
revoke all on function public.viewable_origin_trees() from public, anon, authenticated;
grant execute on function public.viewable_origin_trees() to authenticated;

-- ── Policy: tabel silsilah (people, unions, children) ─────────────
-- Pola yang sama untuk ketiganya. "(select …)" membuat fungsi dihitung
-- sekali per permintaan, bukan sekali per baris.
do $$
declare
  t text;
begin
  foreach t in array array['people', 'unions', 'children'] loop
    execute format('drop policy if exists baca on public.%I', t);
    execute format($p$
      create policy baca on public.%I for select to authenticated using (
        (deleted_at is null or (select public.has_perm('sisihkan')))
        and (
          (tree_id is null and (select public.current_member_id()) is not null)
          or tree_id in (select public.viewable_origin_trees())
        ))$p$, t);

    execute format('drop policy if exists tambah on public.%I', t);
    execute format($p$
      create policy tambah on public.%I for insert to authenticated with check (
        deleted_at is null
        and (
          (tree_id is null and (select public.can_edit()))
          or (tree_id is not null and (select public.is_owner()))
        ))$p$, t);

    execute format('drop policy if exists ubah on public.%I', t);
    execute format($p$
      create policy ubah on public.%I for update to authenticated
      using (
        deleted_at is null
        and (
          (tree_id is null and (select public.can_edit()))
          or (tree_id is not null and (select public.is_owner()))
        ))
      with check (
        deleted_at is null
        and (
          (tree_id is null and (select public.can_edit()))
          or (tree_id is not null and (select public.is_owner()))
        ))$p$, t);
  end loop;
end $$;

-- ── Aturan: status pernikahan ─────────────────────────────────────
-- true kalau pemanggil adalah orang `p` itu sendiri (anggotanya tertaut ke p).
create or replace function private.is_self(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p is not null and exists (
    select 1 from public.members m
    where m.id = public.current_member_id() and m.person_id = p)
$$;
revoke all on function private.is_self(uuid) from public, anon, authenticated;

-- Menandai sebuah pernikahan berakhir karena berpisah (atau membatalkan
-- tanda itu) adalah keputusan yang peka: hanya salah satu dari kedua orang
-- dalam pernikahan itu, admin utama, atau asisten dengan izin
-- "status_pernikahan". Berlaku saat mengubah status, dan saat mencatat
-- pernikahan baru yang langsung berstatus berpisah.
create or replace function private.trg_unions_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  berubah boolean;
begin
  if private.is_maintenance() or new.tree_id is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    berubah := new.status = 'cerai';
  else
    berubah := (new.status = 'cerai') is distinct from (old.status = 'cerai');
  end if;
  if berubah
     and not public.has_perm('status_pernikahan')
     and not private.is_self(new.partner1_id)
     and not private.is_self(new.partner2_id) then
    perform private.fail('SL010',
      'Status berpisah sebuah pernikahan hanya bisa diubah oleh salah satu dari kedua pasangan itu, admin utama, atau asisten yang diberi izin.');
  end if;
  return new;
end $$;
revoke all on function private.trg_unions_status_guard() from public, anon, authenticated;

drop trigger if exists b_status on public.unions;
create trigger b_status before insert or update of status on public.unions
  for each row execute function private.trg_unions_status_guard();

-- "Belum menikah" hanya dipilih oleh orangnya sendiri.
create or replace function private.trg_people_marital_choice_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_maintenance() then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.marital_choice is not null)
     or (tg_op = 'UPDATE' and new.marital_choice is distinct from old.marital_choice
         and not private.is_self(new.id)) then
    perform private.fail('SL011', 'Status "Belum menikah" hanya bisa dipilih oleh orangnya sendiri.');
  end if;
  return new;
end $$;
revoke all on function private.trg_people_marital_choice_guard() from public, anon, authenticated;

drop trigger if exists b_marital_choice on public.people;
create trigger b_marital_choice before insert or update of marital_choice on public.people
  for each row execute function private.trg_people_marital_choice_guard();

-- ── Policy: urutan lahir ──────────────────────────────────────────
-- Dibuat otomatis oleh trigger; aplikasi hanya menggeser (rank).
drop policy if exists baca on public.birth_ranks;
create policy baca on public.birth_ranks for select to authenticated using (
  (tree_id is null and (select public.current_member_id()) is not null)
  or tree_id in (select public.viewable_origin_trees()));

drop policy if exists ubah on public.birth_ranks;
create policy ubah on public.birth_ranks for update to authenticated
  using ((tree_id is null and (select public.can_edit())) or (tree_id is not null and (select public.is_owner())))
  with check ((tree_id is null and (select public.can_edit())) or (tree_id is not null and (select public.is_owner())));

-- ── Policy: pohon keluarga asal ───────────────────────────────────
drop policy if exists baca on public.origin_trees;
create policy baca on public.origin_trees for select to authenticated
  using (id in (select public.viewable_origin_trees()));
drop policy if exists kelola on public.origin_trees;
create policy kelola on public.origin_trees for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

alter table public.origin_tree_access enable row level security;
drop policy if exists kelola on public.origin_tree_access;
create policy kelola on public.origin_tree_access for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ── Policy: pengaturan ────────────────────────────────────────────
drop policy if exists baca on public.settings;
create policy baca on public.settings for select to authenticated
  using ((select public.current_member_id()) is not null);
drop policy if exists ubah on public.settings;
create policy ubah on public.settings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ── Policy: anggota dan perangkat ─────────────────────────────────
drop policy if exists baca on public.members;
create policy baca on public.members for select to authenticated
  using (id = (select public.current_member_id()) or (select public.has_perm('lihat_anggota')));
drop policy if exists ubah_sendiri on public.members;
create policy ubah_sendiri on public.members for update to authenticated
  using (id = (select public.current_member_id()))
  with check (id = (select public.current_member_id()));

-- Nama semua anggota (untuk "diubah oleh …" di riwayat), hanya untuk
-- anggota yang login. Tanpa kolom lain.
-- (Fungsi, bukan view: Security Advisor Supabase menandai view yang
-- berjalan dengan hak pemiliknya sebagai kesalahan.)
create or replace function public.member_names()
returns table (id uuid, display_name text, person_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.display_name, m.person_id
  from public.members m
  where public.current_member_id() is not null
  order by m.display_name
$$;
revoke all on function public.member_names() from public, anon, authenticated;
grant execute on function public.member_names() to authenticated;

drop policy if exists baca on public.devices;
create policy baca on public.devices for select to authenticated
  using (member_id = (select public.current_member_id()) or (select public.is_owner()));
drop policy if exists ubah_sendiri on public.devices;
create policy ubah_sendiri on public.devices for update to authenticated
  using (member_id = (select public.current_member_id()))
  with check (member_id = (select public.current_member_id()));

-- ── Hak per tabel dan per kolom ───────────────────────────────────
-- Mulai dari nol, lalu beri hanya yang perlu. Tidak ada DELETE.
revoke all on table public.people, public.unions, public.children, public.birth_ranks,
  public.origin_trees, public.origin_tree_access, public.settings, public.members, public.devices
  from public, anon, authenticated;

grant select on table public.people, public.unions, public.children, public.birth_ranks,
  public.origin_trees, public.origin_tree_access, public.settings, public.members, public.devices
  to authenticated;

grant insert (tree_id, full_name, nickname, religious_title, academic_title, sex,
              birth_y, birth_m, birth_d, birth_approx, birth_place,
              is_deceased, death_y, death_m, death_d, death_approx, death_place,
              occupation, notes)
  on public.people to authenticated;
grant update (full_name, nickname, religious_title, academic_title, sex,
              birth_y, birth_m, birth_d, birth_approx, birth_place,
              is_deceased, death_y, death_m, death_d, death_approx, death_place,
              occupation, notes, marital_choice)
  on public.people to authenticated;

grant insert (partner1_id, partner2_id, status, marriage_y, marriage_m, marriage_d, marriage_approx,
              end_y, end_m, end_d, end_approx, sort_order, notes)
  on public.unions to authenticated;
grant update (partner2_id, status, marriage_y, marriage_m, marriage_d, marriage_approx,
              end_y, end_m, end_d, end_approx, sort_order, notes)
  on public.unions to authenticated;

grant insert (union_id, child_id, kind, biological_parent) on public.children to authenticated;
grant update (union_id, kind, biological_parent) on public.children to authenticated;

grant update (rank) on public.birth_ranks to authenticated;

grant insert (anchor_person_id, is_active, grant_all_descendants) on public.origin_trees to authenticated;
grant update (is_active, grant_all_descendants) on public.origin_trees to authenticated;
grant insert, update, delete on public.origin_tree_access to authenticated;

grant update (generation_terms, contact_quota_member, contact_quota_assistant,
              device_codes_enabled, temp_access_max_minutes, quiet_hours_start, quiet_hours_end,
              login_digest_hourly, usual_countries, news_daily_limit, near_radius_km,
              anomaly_max_changes, anomaly_window_minutes, gathering_reminder_morning,
              gathering_reminder_hours_before, backup_reminder_change_threshold, root_union_id)
  on public.settings to authenticated;

grant update (display_name) on public.members to authenticated;
grant update (label, timezone, last_seen_at) on public.devices to authenticated;

insert into public.app_migrations (version, name)
values ('005', 'akses_silsilah')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with
  tabel as (
    select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
  ),
  dijaga as (
    select unnest(array['people', 'unions', 'children', 'birth_ranks', 'origin_trees',
                        'origin_tree_access', 'settings', 'members', 'devices']) as t
  )
select 'Tabel di public/private TANPA RLS' as pemeriksaan,
       coalesce((select string_agg(nama, ', ' order by nama) from tabel where not rls), 'tidak ada') as hasil,
       'tidak ada' as harus
union all
select 'Tabel yang bisa disentuh anon',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel
                 where has_table_privilege('anon', oid, 'select, insert, update, delete')), 'tidak ada'),
       'tidak ada'
union all
select 'Tabel yang bisa DIHAPUS (delete) oleh authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel
                 where has_table_privilege('authenticated', oid, 'delete')
                   and nama <> 'public.origin_tree_access'), 'tidak ada'),
       'tidak ada'
union all
select 'Tabel yang dijaga tetapi tanpa policy',
       coalesce((select string_agg(t, ', ' order by t) from dijaga
                 where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = dijaga.t)),
                'tidak ada'),
       'tidak ada'
union all
select 'Kolom sistem yang bisa ditulis aplikasi',
       coalesce((select string_agg(t || '.' || k, ', ' order by t, k)
                 from unnest(array['people', 'unions', 'children']) t
                 cross join unnest(array['version', 'created_by', 'updated_by', 'deleted_at', 'deleted_by',
                                         'delete_batch', 'tree_id']) k
                 where has_column_privilege('authenticated', 'public.' || t, k, 'update')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi di public/private yang bisa dijalankan anon',
       coalesce((select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private')
                   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Penjaga status berpisah dan "Belum menikah" terpasang (dari 2)',
       (select count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
          and (c.relname, t.tgname) in (('unions', 'b_status'), ('people', 'b_marital_choice'))),
       '2'
union all
select 'View di schema public (harus tidak ada; Security Advisor)',
       coalesce((select string_agg(viewname, ', ') from pg_views where schemaname = 'public'), 'tidak ada'),
       'tidak ada'
union all
select 'Versi database',
       public.db_version(),
       '005 atau lebih';
