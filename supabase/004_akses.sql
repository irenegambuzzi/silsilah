-- 004 — Anggota, perangkat, undangan, dan log login.
--
--   members        siapa saja anggota aplikasi (setiap anggota adalah
--                  orang di silsilah utama), perannya, izin asisten,
--                  status (aktif/dicabut), dan penahanan otomatis.
--   devices        satu baris per sesi login (per perangkat). Akses data
--                  SELALU diperiksa terhadap perangkat ini: perangkat yang
--                  dicabut atau kedaluwarsa langsung tidak bisa membaca
--                  apa pun, walaupun token login di HP itu masih berlaku.
--   private.invites       link undangan sekali pakai (hanya hash token).
--   private.device_codes  kode tambah perangkat / akses sementara.
--   private.auth_events   log login: kota/negara perkiraan, jenis
--                         perangkat, waktu (disimpan seterusnya).
--   private.login_ips     alamat IP mentah; DIHAPUS setelah 30 hari
--                         (purge_old_login_ips(), dijadwalkan di jadwal.sql).
--
-- Fungsi untuk aturan akses (dipakai RLS di 005 dan seterusnya):
--   current_member_id()  anggota yang sedang login DARI PERANGKAT YANG SAH
--   can_edit()           boleh menambah/mengubah data (bukan "hanya
--                        melihat", tidak sedang ditahan)
--   has_perm(izin)       asisten dengan izin itu, atau admin utama
--   is_owner()           admin utama DENGAN verifikasi dua langkah (aal2)
--
-- Perlindungan admin utama: lewat aplikasi/API, baris admin utama tidak
-- bisa dicabut, diturunkan, atau dikurangi izinnya oleh siapa pun
-- (termasuk dirinya sendiri), dan tidak ada yang bisa menjadikan dirinya
-- admin utama. Penggantian admin utama hanya lewat SQL Editor.
--
-- Kode error: AK001 admin utama dilindungi · AK002 hanya admin utama
-- AK003 bukan keturunan/menantu · AK004 belum dewasa · AK005 perlu
-- konfirmasi dewasa · AK006 undangan tidak berlaku · AK007 perangkat
-- tidak bisa diubah begitu · AK008 kode tidak berlaku · AK009 durasi
-- akses sementara terlalu lama · AK010 sudah wafat · AK011 akun login
-- tidak bisa diganti · AK012 anggota sudah dicabut
--
-- Aman dijalankan ulang. Membutuhkan 001–003.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Konteks: perubahan dari aplikasi/API, atau dari SQL Editor ────
-- Permintaan API Supabase selalu masuk sebagai session_user
-- "authenticator" dan membawa klaim JWT. SQL Editor tidak.
create or replace function private.is_maintenance()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.jwt() is null and session_user in ('postgres', 'supabase_admin')
$$;
revoke all on function private.is_maintenance() from public, anon, authenticated;

-- ── members ───────────────────────────────────────────────────────
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  -- Terisi saat undangan pertama kali dipakai; tidak pernah diganti.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  person_id uuid not null unique references public.people (id) on delete restrict,
  display_name text not null check (display_name = btrim(display_name) and length(display_name) between 1 and 100),
  role text not null default 'anggota' check (role in ('lihat', 'anggota', 'asisten')),
  is_owner boolean not null default false,
  permissions text[] not null default '{}',
  status text not null default 'aktif' check (status in ('aktif', 'dicabut')),
  -- Penahanan otomatis karena aktivitas tidak wajar ('infinity' = sampai
  -- dilepas admin). Selama ditahan hanya bisa membaca.
  hold_until timestamptz,
  hold_reason text,
  last_seen_at timestamptz,

  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.members (id) on delete set null,

  constraint members_permissions_known check (permissions <@ array[
    'batalkan_orang_lain', 'tindak_laporan', 'tempat_sampah', 'buat_undangan',
    'lihat_anggota', 'akses_sementara', 'tambah_kuota_kontak', 'unduh_kontak',
    'kelola_jadwal', 'bendahara', 'konfirmasi_kabar', 'bagikan_whatsapp']::text[]),
  constraint members_permissions_only_assistant check (role = 'asisten' or permissions = '{}'),
  constraint members_owner_is_member check (not is_owner or (role = 'anggota' and permissions = '{}')),
  constraint members_revoked_consistent check ((status = 'dicabut') = (revoked_at is not null))
);
-- Hanya satu admin utama.
create unique index if not exists members_one_owner on public.members (is_owner) where is_owner;

-- ── devices: satu baris per sesi login ────────────────────────────
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  -- session_id dari JWT Supabase.
  session_id uuid not null unique,
  via text not null check (via in ('undangan', 'kode', 'google', 'sementara')),
  -- null = berlaku sampai keluar/dicabut. Wajib untuk akses sementara.
  expires_at timestamptz,
  label text check (length(label) <= 100),
  device_type text check (length(device_type) <= 50),
  -- Perkiraan dari alamat IP saat login. Tidak ada GPS/koordinat.
  approx_city text check (length(approx_city) <= 100),
  approx_country text check (approx_country ~ '^[A-Z]{2}$'),
  timezone text check (length(timezone) <= 64),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.members (id) on delete set null,
  constraint devices_temporary_has_expiry check (via <> 'sementara' or expires_at is not null)
);
create index if not exists devices_member_idx on public.devices (member_id);

-- ── Fungsi akses ──────────────────────────────────────────────────
-- Dipakai di dalam policy RLS, sehingga pengguna yang login harus boleh
-- menjalankannya. Isinya hanya tentang si pemanggil sendiri.

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  join public.devices d on d.member_id = m.id
  where m.auth_user_id = auth.uid()
    and m.status = 'aktif'
    and d.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and d.revoked_at is null
    and (d.expires_at is null or d.expires_at > now())
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (m.is_owner or m.role in ('anggota', 'asisten'))
           and (m.hold_until is null or m.hold_until <= now())
    from public.members m
    where m.id = public.current_member_id()
  ), false)
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select m.is_owner and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    from public.members m
    where m.id = public.current_member_id()
  ), false)
$$;

create or replace function public.has_perm(izin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner() or coalesce((
    select m.role = 'asisten' and izin = any (m.permissions)
    from public.members m
    where m.id = public.current_member_id()
  ), false)
$$;

revoke all on function public.current_member_id() from public, anon, authenticated;
revoke all on function public.can_edit() from public, anon, authenticated;
revoke all on function public.is_owner() from public, anon, authenticated;
revoke all on function public.has_perm(text) from public, anon, authenticated;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.can_edit() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.has_perm(text) to authenticated;

-- Pelaku perubahan untuk kolom created_by/updated_by (menggantikan
-- versi sementara dari 003).
create or replace function private.actor_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select public.current_member_id() $$;
revoke all on function private.actor_member_id() from public, anon, authenticated;

-- ── Siapa yang boleh diundang ─────────────────────────────────────
-- Hasil: 'boleh' | 'perlu_konfirmasi' (tanggal lahir tidak diketahui dan
-- belum tercatat menikah) | 'belum_dewasa' | 'wafat' | 'bukan_keluarga'.
-- Dewasa = pasti sudah 18 tahun (dihitung dari tanggal lahir paling akhir
-- yang mungkin), ATAU sudah menikah.
create or replace function private.invite_eligibility(p uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.people;
  lahir_paling_akhir date;
begin
  select * into o from public.people where id = p;
  if not found or o.tree_id is not null or o.deleted_at is not null then
    return 'bukan_keluarga';
  end if;
  if o.is_deceased then
    return 'wafat';
  end if;
  if not (
    private.is_lineage(p)
    or exists (
      select 1 from public.unions u
      where u.partner2_id = p and u.tree_id is null and u.deleted_at is null
        and private.is_lineage(u.partner1_id))) then
    return 'bukan_keluarga';
  end if;
  if exists (
    select 1 from public.unions u
    where p in (u.partner1_id, u.partner2_id) and u.tree_id is null and u.deleted_at is null) then
    return 'boleh';
  end if;
  if o.birth_y is null then
    return 'perlu_konfirmasi';
  end if;
  lahir_paling_akhir := (make_date(o.birth_y, coalesce(o.birth_m, 12), 1)
                         + interval '1 month - 1 day')::date;
  if o.birth_d is not null then
    lahir_paling_akhir := make_date(o.birth_y, o.birth_m, o.birth_d);
  end if;
  if lahir_paling_akhir + interval '18 years' <= current_date then
    return 'boleh';
  end if;
  return 'belum_dewasa';
end $$;
revoke all on function private.invite_eligibility(uuid) from public, anon, authenticated;

-- ── private.invites: link undangan sekali pakai ───────────────────
create table if not exists private.invites (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  -- SHA-256 (hex) dari token. Token aslinya tidak pernah disimpan.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  -- Pembuat undangan memastikan "sudah dewasa" (kalau tanggal lahir
  -- tidak diketahui).
  adult_confirmed_by uuid references public.members (id) on delete set null,
  used_at timestamptz,
  used_device_id uuid references public.devices (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.members (id) on delete set null
);
create index if not exists invites_member_idx on private.invites (member_id);

-- ── private.device_codes: tambah perangkat / akses sementara ──────
create table if not exists private.device_codes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('tambah_perangkat', 'akses_sementara')),
  -- Lama akses untuk akses sementara (menit).
  access_minutes int check (access_minutes between 30 and 10080),
  created_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  created_from_device uuid references public.devices (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  used_device_id uuid references public.devices (id) on delete set null,
  attempts int not null default 0 check (attempts >= 0),
  revoked_at timestamptz,
  constraint device_codes_minutes_match_kind check ((kind = 'akses_sementara') = (access_minutes is not null))
);

-- ── private.auth_events dan private.login_ips ─────────────────────
create table if not exists private.auth_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  member_id uuid references public.members (id) on delete set null,
  device_id uuid references public.devices (id) on delete set null,
  event text not null check (event in (
    'undangan_dipakai', 'undangan_ditolak', 'kode_dibuat', 'kode_dipakai', 'kode_ditolak',
    'akses_sementara_diberikan', 'login_google', 'perangkat_dicabut', 'akses_dicabut',
    'verifikasi_dua_langkah', 'login_mencurigakan', 'keluar')),
  device_type text check (length(device_type) <= 50),
  approx_city text check (length(approx_city) <= 100),
  approx_country text check (approx_country ~ '^[A-Z]{2}$'),
  detail jsonb not null default '{}'
);
create index if not exists auth_events_member_idx on private.auth_events (member_id, at);

create table if not exists private.login_ips (
  id bigint generated always as identity primary key,
  event_id bigint not null references private.auth_events (id) on delete cascade,
  ip inet not null,
  at timestamptz not null default now()
);
create index if not exists login_ips_at_idx on private.login_ips (at);

-- Menghapus alamat IP mentah yang berumur lebih dari 30 hari. Hasil:
-- jumlah baris yang dihapus. Dijadwalkan setiap hari (jadwal.sql).
create or replace function private.purge_old_login_ips()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from private.login_ips where at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.purge_old_login_ips() from public, anon, authenticated;

-- ── Penjaga: members ──────────────────────────────────────────────
create or replace function private.trg_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  boleh_owner constant text[] := array['display_name', 'last_seen_at', 'auth_user_id',
                                       'version', 'updated_at', 'updated_by'];
  sensitif constant text[] := array['role', 'permissions', 'status', 'person_id',
                                    'hold_until', 'hold_reason', 'revoked_at', 'revoked_by'];
  kolom text;
  o public.people;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select * into o from public.people where id = new.person_id;
    if o.tree_id is not null or o.deleted_at is not null then
      perform private.fail('AK003', 'Anggota harus orang di silsilah utama.');
    end if;
  end if;

  if private.is_maintenance() then
    return coalesce(new, old);
  end if;

  -- Selebihnya: perubahan lewat aplikasi/API.
  if tg_op = 'DELETE' then
    if old.is_owner then
      perform private.fail('AK001', 'Admin utama tidak bisa diubah atau dicabut lewat aplikasi.');
    end if;
    perform private.fail('AK002', 'Anggota tidak dihapus, hanya dicabut aksesnya oleh admin utama.');
  end if;

  if tg_op = 'INSERT' then
    if new.is_owner then
      perform private.fail('AK001', 'Admin utama tidak bisa diubah atau dicabut lewat aplikasi.');
    end if;
    if (new.role = 'asisten' or new.permissions <> '{}' or new.status <> 'aktif' or new.hold_until is not null)
       and not public.is_owner() then
      perform private.fail('AK002', 'Hanya admin utama yang bisa mengatur peran, izin, atau status anggota.');
    end if;
    return new;
  end if;

  -- UPDATE
  if new.is_owner is distinct from old.is_owner then
    perform private.fail('AK001', 'Admin utama tidak bisa diubah atau dicabut lewat aplikasi.');
  end if;
  if old.auth_user_id is not null and new.auth_user_id is distinct from old.auth_user_id then
    perform private.fail('AK011', 'Akun login seorang anggota tidak bisa diganti.');
  end if;
  if old.is_owner then
    if (to_jsonb(new) - boleh_owner) <> (to_jsonb(old) - boleh_owner) then
      perform private.fail('AK001', 'Admin utama tidak bisa diubah atau dicabut lewat aplikasi.');
    end if;
    return new;
  end if;
  foreach kolom in array sensitif loop
    if (to_jsonb(new) -> kolom) is distinct from (to_jsonb(old) -> kolom) and not public.is_owner() then
      perform private.fail('AK002', 'Hanya admin utama yang bisa mengatur peran, izin, atau status anggota.');
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.trg_members_guard() from public, anon, authenticated;

-- ── Penjaga: devices ──────────────────────────────────────────────
create or replace function private.trg_devices_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  boleh constant text[] := array['last_seen_at', 'revoked_at', 'revoked_by', 'label', 'timezone'];
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.members where id = new.member_id and status = 'aktif') then
      perform private.fail('AK007', 'Perangkat hanya bisa didaftarkan untuk anggota yang aktif.');
    end if;
    return new;
  end if;
  if private.is_maintenance() then
    return new;
  end if;
  if (to_jsonb(new) - boleh) <> (to_jsonb(old) - boleh)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    perform private.fail('AK007',
      'Perangkat yang sudah dicabut tidak bisa diaktifkan lagi, dan masa berlakunya tidak bisa diubah.');
  end if;
  return new;
end $$;
revoke all on function private.trg_devices_guard() from public, anon, authenticated;

-- ── Penjaga: undangan ─────────────────────────────────────────────
create or replace function private.trg_invites_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hasil text;
  orangnya uuid;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.members where id = new.member_id and status <> 'aktif') then
      perform private.fail('AK012', 'Akses anggota ini sudah dicabut. Admin utama perlu mengaktifkannya dulu.');
    end if;
    select person_id into orangnya from public.members where id = new.member_id;
    hasil := private.invite_eligibility(orangnya);
    if hasil = 'bukan_keluarga' then
      perform private.fail('AK003', 'Undangan hanya untuk keturunan dan menantu di silsilah utama.');
    elsif hasil = 'wafat' then
      perform private.fail('AK010', 'Orang ini tercatat sudah wafat.');
    elsif hasil = 'belum_dewasa' then
      perform private.fail('AK004', 'Orang ini belum dewasa (di bawah 18 tahun dan belum menikah), jadi belum bisa diundang.');
    elsif hasil = 'perlu_konfirmasi' and new.adult_confirmed_by is null then
      perform private.fail('AK005', 'Tanggal lahir orang ini tidak diketahui. Pastikan dulu bahwa ia sudah dewasa.');
    end if;
    return new;
  end if;

  if new.token_hash is distinct from old.token_hash or new.member_id is distinct from old.member_id
     or new.created_at is distinct from old.created_at or new.expires_at is distinct from old.expires_at
     or (old.used_at is not null and new.used_at is distinct from old.used_at)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    perform private.fail('AK006', 'Link undangan ini sudah dipakai, kedaluwarsa, atau dicabut.');
  end if;
  if old.used_at is null and new.used_at is not null
     and (old.revoked_at is not null or old.expires_at <= now()) then
    perform private.fail('AK006', 'Link undangan ini sudah dipakai, kedaluwarsa, atau dicabut.');
  end if;
  return new;
end $$;
revoke all on function private.trg_invites_guard() from public, anon, authenticated;

-- ── Penjaga: kode perangkat ───────────────────────────────────────
create or replace function private.trg_device_codes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batas int;
begin
  if tg_op = 'INSERT' then
    select temp_access_max_minutes into batas from public.settings where id;
    if new.kind = 'akses_sementara' and new.access_minutes > batas then
      perform private.fail('AK009', 'Durasi akses sementara melebihi batas yang diatur admin.');
    end if;
    return new;
  end if;
  if new.code_hash is distinct from old.code_hash or new.member_id is distinct from old.member_id
     or new.kind is distinct from old.kind or new.access_minutes is distinct from old.access_minutes
     or new.expires_at is distinct from old.expires_at or new.attempts < old.attempts
     or (old.used_at is not null and new.used_at is distinct from old.used_at)
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    perform private.fail('AK008', 'Kode ini sudah dipakai, kedaluwarsa, atau dicabut.');
  end if;
  if old.used_at is null and new.used_at is not null
     and (old.revoked_at is not null or old.expires_at <= now()) then
    perform private.fail('AK008', 'Kode ini sudah dipakai, kedaluwarsa, atau dicabut.');
  end if;
  return new;
end $$;
revoke all on function private.trg_device_codes_guard() from public, anon, authenticated;

-- ── Pemasangan trigger ────────────────────────────────────────────
drop trigger if exists a_immutable on public.members;
create trigger a_immutable before update on public.members
  for each row execute function private.trg_immutable('id');
drop trigger if exists b_guard on public.members;
create trigger b_guard before insert or update or delete on public.members
  for each row execute function private.trg_members_guard();
drop trigger if exists z_stamp on public.members;
create trigger z_stamp before insert or update on public.members
  for each row execute function private.trg_stamp();

drop trigger if exists a_immutable on public.devices;
create trigger a_immutable before update on public.devices
  for each row execute function private.trg_immutable('id', 'member_id', 'session_id', 'via');
drop trigger if exists b_guard on public.devices;
create trigger b_guard before insert or update on public.devices
  for each row execute function private.trg_devices_guard();

drop trigger if exists b_guard on private.invites;
create trigger b_guard before insert or update on private.invites
  for each row execute function private.trg_invites_guard();

drop trigger if exists b_guard on private.device_codes;
create trigger b_guard before insert or update on private.device_codes
  for each row execute function private.trg_device_codes_guard();

-- ── Kolom *_by di tabel lain sekarang menunjuk ke anggota ─────────
do $$
declare
  t text;
  k text;
begin
  foreach t in array array['people', 'unions', 'children', 'birth_ranks'] loop
    foreach k in array array['created_by', 'updated_by'] loop
      if not exists (select 1 from pg_constraint where conname = t || '_' || k || '_fk') then
        execute format('alter table public.%I add constraint %I foreign key (%I) references public.members (id) on delete set null',
                       t, t || '_' || k || '_fk', k);
      end if;
    end loop;
  end loop;
  foreach t in array array['people', 'unions', 'children'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_deleted_by_fk') then
      execute format('alter table public.%I add constraint %I foreign key (deleted_by) references public.members (id) on delete set null',
                     t, t || '_deleted_by_fk');
    end if;
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'origin_trees_created_by_fk') then
    alter table public.origin_trees add constraint origin_trees_created_by_fk
      foreign key (created_by) references public.members (id) on delete set null;
  end if;
end $$;

alter table public.settings add column if not exists updated_by uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_updated_by_fk') then
    alter table public.settings add constraint settings_updated_by_fk
      foreign key (updated_by) references public.members (id) on delete set null;
  end if;
end $$;

-- ── RLS aktif, belum ada akses (policy di 005) ────────────────────
alter table public.members enable row level security;
alter table public.devices enable row level security;
alter table private.invites enable row level security;
alter table private.device_codes enable row level security;
alter table private.auth_events enable row level security;
alter table private.login_ips enable row level security;
revoke all on table public.members, public.devices from public, anon, authenticated;
revoke all on table private.invites, private.device_codes, private.auth_events, private.login_ips
  from public, anon, authenticated;

insert into public.app_migrations (version, name)
values ('004', 'akses')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with tabel as (
  select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname, c.relname) in (
    ('public', 'members'), ('public', 'devices'), ('private', 'invites'),
    ('private', 'device_codes'), ('private', 'auth_events'), ('private', 'login_ips'))
)
select 'Tabel akses yang ada (dari 6)' as pemeriksaan,
       (select count(*)::text from tabel) as hasil,
       '6' as harus
union all
select 'Tabel akses TANPA RLS',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel where not rls), 'tidak ada'),
       'tidak ada'
union all
select 'Tabel akses yang bisa disentuh anon/authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel
                 where has_table_privilege('anon', oid, 'select, insert, update, delete')
                    or has_table_privilege('authenticated', oid, 'select, insert, update, delete')),
                'tidak ada'),
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
select 'Jumlah admin utama (0 sampai di-bootstrap di langkah 1.30)',
       (select count(*)::text from public.members where is_owner),
       '0 atau lebih'
union all
select 'Tanpa login: current_member_id() kosong',
       (public.current_member_id() is null)::text,
       'true'
union all
select 'Versi database',
       public.db_version(),
       '004 atau lebih';
