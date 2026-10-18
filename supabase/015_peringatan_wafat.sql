-- 015 — Peringatan wafat: "mulai hari berikutnya" per almarhum.
--
-- Jadwal peringatan (nelung dinten, mitung dinten, …) dihitung dari tanggal
-- wafat; hari wafat = hari ke-1. Atas permintaan keluarga, hitungan seorang
-- almarhum bisa dimulai HARI BERIKUTNYA ("Hitung peringatan mulai hari
-- berikutnya (wafat setelah maghrib)"). Ini pilihan, bukan paksaan.
--
--   private.death_rules       pilihan itu, satu baris per almarhum. Schema
--                             private: tidak bisa dibaca lewat API sama sekali.
--   set_death_rule()          admin utama, atau asisten dengan izin
--                             kelola_peringatan, mengatur pilihan itu.
--   get_death_rule()          pemegang izin yang sama membaca pilihan itu.
--   death_count_start()       anggota yang boleh melihat orang itu: HANYA
--                             tanggal mulai hitungan (tanggal wafat, atau
--                             +1 hari kalau pilihan itu aktif). Null kalau
--                             tanggal wafat tidak lengkap atau orangnya tidak
--                             terlihat. Nilai pilihan tidak pernah dikirim.
--
-- Pilihan hanya untuk orang yang sudah wafat dengan tanggal wafat LENGKAP
-- (tahun, bulan, hari).
--
-- Kode error: PW001 tidak punya izin mengatur peringatan wafat
--             PW002 orang belum wafat, atau tanggal wafatnya belum lengkap
--             PW003 orang tidak ditemukan
--
-- Izin baru "kelola_peringatan" ada di daftar members_permissions_known (004).
-- death_rules ikut salinan otomatis (008, snapshot_private_tables).
--
-- Aman dijalankan ulang. Membutuhkan 001–014.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── 1. Pilihan per almarhum ───────────────────────────────────────
create table if not exists private.death_rules (
  person_id uuid primary key references public.people (id) on delete cascade,
  start_next_day boolean not null default false,
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table private.death_rules enable row level security;
revoke all on table private.death_rules from public, anon, authenticated;
-- Tanpa policy: hanya fungsi security definer di bawah yang membaca dan menulis.

-- Orang itu terlihat oleh pemanggil (aturan yang sama dengan RLS people,
-- tanpa data yang disisihkan).
create or replace function private.death_person_visible(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_member_id() is not null and exists (
    select 1 from public.people x
    where x.id = p and x.deleted_at is null
      and (x.tree_id is null or x.tree_id in (select public.viewable_origin_trees())))
$$;
revoke all on function private.death_person_visible(uuid) from public, anon, authenticated;

-- Pemeriksaan bersama untuk kedua RPC admin.
create or replace function private.death_rule_check(p uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.people;
begin
  if public.current_member_id() is null or not public.has_perm('kelola_peringatan') then
    perform private.fail('PW001', 'Anda tidak punya izin mengatur peringatan wafat.');
  end if;
  if not private.death_person_visible(p) then
    perform private.fail('PW003', 'Orang ini tidak ditemukan.');
  end if;
  select * into o from public.people where id = p;
  if not o.is_deceased or o.death_y is null or o.death_m is null or o.death_d is null then
    perform private.fail('PW002',
      'Peringatan hanya bisa diatur untuk yang sudah wafat dengan tanggal wafat lengkap (hari, bulan, dan tahun).');
  end if;
end $$;
revoke all on function private.death_rule_check(uuid) from public, anon, authenticated;

-- ── 2. RPC admin ──────────────────────────────────────────────────
create or replace function public.set_death_rule(p_person uuid, p_start_next_day boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.death_rule_check(p_person);
  -- Asisten yang sedang ditahan hanya bisa membaca.
  if not public.can_edit() then
    perform private.fail('PW001', 'Anda tidak punya izin mengatur peringatan wafat.');
  end if;
  insert into private.death_rules (person_id, start_next_day, updated_by, updated_at)
  values (p_person, coalesce(p_start_next_day, false), public.current_member_id(), now())
  on conflict (person_id) do update
    set start_next_day = excluded.start_next_day, updated_by = excluded.updated_by, updated_at = now();
  return coalesce(p_start_next_day, false);
end $$;
revoke all on function public.set_death_rule(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_death_rule(uuid, boolean) to authenticated;

create or replace function public.get_death_rule(p_person uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.death_rule_check(p_person);
  return coalesce((select r.start_next_day from private.death_rules r where r.person_id = p_person), false);
end $$;
revoke all on function public.get_death_rule(uuid) from public, anon, authenticated;
grant execute on function public.get_death_rule(uuid) to authenticated;

-- ── 3. Tanggal mulai hitungan untuk semua anggota ─────────────────
create or replace function public.death_count_start(p_person uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select make_date(o.death_y, o.death_m, o.death_d)
         + case when coalesce(r.start_next_day, false) then 1 else 0 end
  from public.people o
  left join private.death_rules r on r.person_id = o.id
  where o.id = p_person
    and private.death_person_visible(o.id)
    and o.is_deceased
    and o.death_y is not null and o.death_m is not null and o.death_d is not null
$$;
revoke all on function public.death_count_start(uuid) from public, anon, authenticated;
grant execute on function public.death_count_start(uuid) to authenticated;

insert into public.app_migrations (version, name)
values ('015', 'peringatan_wafat')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'death_rules memakai RLS' as pemeriksaan,
       (select relrowsecurity::text from pg_class where oid = 'private.death_rules'::regclass) as hasil,
       'true' as harus
union all
select 'Hak pengguna atas death_rules',
       case when has_table_privilege('authenticated', 'private.death_rules', 'select')
              or has_table_privilege('authenticated', 'private.death_rules', 'insert')
              or has_table_privilege('authenticated', 'private.death_rules', 'update')
              or has_table_privilege('authenticated', 'private.death_rules', 'delete')
              or has_table_privilege('anon', 'private.death_rules', 'select')
            then 'ada' else 'tidak ada' end,
       'tidak ada'
union all
select 'Fungsi baru yang bisa dijalankan anon',
       coalesce((select string_agg(p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private')
                   and p.proname in ('set_death_rule', 'get_death_rule', 'death_count_start',
                                     'death_person_visible', 'death_rule_check')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi baru yang bisa dijalankan pengguna login (dari 3)',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('set_death_rule', 'get_death_rule', 'death_count_start')
          and has_function_privilege('authenticated', p.oid, 'execute')),
       '3'
union all
select 'Izin kelola_peringatan dikenal (file 004)',
       (select (pg_get_constraintdef(oid) like '%kelola_peringatan%')::text
        from pg_constraint where conname = 'members_permissions_known'),
       'true'
union all
select 'death_rules ikut salinan otomatis (008)',
       ('death_rules' = any (private.snapshot_private_tables()))::text,
       'true'
union all
select 'Versi database',
       public.db_version(),
       '015 atau lebih';
