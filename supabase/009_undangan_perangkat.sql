-- 009 — Link undangan, kode perangkat, akses sementara, dan klaim perangkat.
--
-- Alur masuk (PLAN.md bagian 6.1):
--   1. Admin utama, atau asisten dengan izin buat_undangan, memanggil
--      create_invite(). Token acak 32 byte dibuat di sini dan dikembalikan
--      SEKALI; yang disimpan hanya hash SHA-256-nya.
--   2. Penerima menekan "Masuk" → Edge Function pakai-undangan:
--        edge_check_redemption()    link masih berlaku? (+ batas percobaan)
--        (Edge Function menyiapkan akun login dan tautan masuk)
--        edge_complete_redemption() tandai link SUDAH DIPAKAI, beri tiket
--                                   klaim perangkat (sekali pakai, 10 menit)
--   3. Aplikasi membentuk sesi, lalu claim_device(tiket) mendaftarkan sesi
--      itu di devices. Sesi tanpa klaim perangkat tidak bisa membaca apa pun.
--
--   Tambah perangkat: create_device_code() → kode 8 karakter, 10 menit,
--   sekali pakai → Edge Function pakai-kode (alur sama).
--   Akses sementara: create_temp_access_code(anggota, menit) → kode yang
--   sama bentuknya; perangkat yang memakainya berakhir sendiri.
--
-- Fungsi edge_* HANYA bisa dijalankan Edge Function (service_role).
--
-- Batas percobaan yang salah (alamat IP di tabel percobaan disimpan 1 hari):
--   kode      5 kali per alamat per 15 menit, dan 30 kali dari semua alamat
--             per 10 menit (pengaman kalau penyerang berganti-ganti alamat)
--   undangan  10 kali per alamat per 15 menit
-- Saat batas tercapai, admin utama langsung diberi tahu.
--
-- Kode error: AK013 tambah perangkat dimatikan · AK014 perangkat akses
-- sementara · AK015 tanpa izin undangan · AK016 tanpa izin akses sementara
-- · AK017 sasaran admin utama/asisten · AK018 peran undangan · AK019 tiket
-- tidak berlaku · AK020 sesi sudah terdaftar · AK021 belum masuk · AK022
-- durasi terlalu pendek · AK023 sedang ditahan
--
-- Aman dijalankan ulang. Membutuhkan 001–008.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Peristiwa log baru ────────────────────────────────────────────
alter table private.auth_events drop constraint if exists auth_events_event_check;
alter table private.auth_events add constraint auth_events_event_check check (event in (
  'undangan_dibuat', 'undangan_dicabut', 'undangan_dipakai', 'undangan_ditolak',
  'kode_dibuat', 'kode_dipakai', 'kode_ditolak',
  'akses_sementara_diberikan', 'login_google', 'perangkat_dicabut', 'akses_dicabut',
  'verifikasi_dua_langkah', 'login_mencurigakan', 'keluar'));

-- ── Tiket klaim perangkat ─────────────────────────────────────────
-- Diberikan setelah link/kode dipakai. Sekali pakai, 10 menit, hanya
-- untuk akun login anggota itu. Hanya hash-nya yang disimpan.
create table if not exists private.device_claims (
  id uuid primary key default gen_random_uuid(),
  ticket_hash text not null unique check (ticket_hash ~ '^[0-9a-f]{64}$'),
  member_id uuid not null references public.members (id) on delete cascade,
  via text not null check (via in ('undangan', 'kode', 'sementara')),
  access_minutes int check (access_minutes between 30 and 10080),
  invite_id uuid references private.invites (id) on delete set null,
  code_id uuid references private.device_codes (id) on delete set null,
  event_id bigint references private.auth_events (id) on delete set null,
  device_type text check (length(device_type) <= 50),
  label text check (length(label) <= 100),
  approx_city text check (length(approx_city) <= 100),
  approx_country text check (approx_country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  used_device_id uuid references public.devices (id) on delete set null,
  constraint device_claims_minutes_match_via check ((via = 'sementara') = (access_minutes is not null))
);
create index if not exists device_claims_member_idx on private.device_claims (member_id);

-- ── Percobaan yang salah (untuk batas percobaan) ──────────────────
create table if not exists private.redeem_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('undangan', 'kode')),
  ip inet
);
create index if not exists redeem_attempts_kind_at_idx on private.redeem_attempts (kind, at);

alter table private.device_claims enable row level security;
alter table private.redeem_attempts enable row level security;
revoke all on table private.device_claims, private.redeem_attempts from public, anon, authenticated;

-- ── Pembantu ──────────────────────────────────────────────────────
create or replace function private.sha256_hex(isi text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(extensions.digest(isi, 'sha256'), 'hex') $$;
revoke all on function private.sha256_hex(text) from public, anon, authenticated;

-- 32 byte acak dalam base64url (43 karakter), untuk link dan tiket.
create or replace function private.random_token()
returns text
language sql
volatile
set search_path = ''
as $$ select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=') $$;
revoke all on function private.random_token() from public, anon, authenticated;

-- Kode 8 karakter tanpa huruf/angka yang mudah tertukar (0/O, 1/I).
-- 32 pilihan per karakter, jadi setiap byte acak dipakai tanpa bias.
create or replace function private.random_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  huruf constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  acak bytea := extensions.gen_random_bytes(8);
  hasil text := '';
begin
  for i in 0..7 loop
    hasil := hasil || substr(huruf, (get_byte(acak, i) & 31) + 1, 1);
  end loop;
  return hasil;
end $$;
revoke all on function private.random_code() from public, anon, authenticated;

create or replace function private.safe_inet(isi text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(btrim(isi), '')::inet;
exception when others then
  return null;
end $$;
revoke all on function private.safe_inet(text) from public, anon, authenticated;

create or replace function private.duration_text(menit int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when menit % 1440 = 0 then (menit / 1440) || ' hari'
    when menit % 60 = 0 then (menit / 60) || ' jam'
    else menit || ' menit'
  end
$$;
revoke all on function private.duration_text(int) from public, anon, authenticated;

-- Link atau kode untuk admin utama dan asisten hanya boleh dibuat admin
-- utama: link/kode itu membuka akun mereka.
create or replace function private.require_target_right(sasaran public.members)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (sasaran.is_owner or sasaran.role = 'asisten') and not public.is_owner() then
    perform private.fail('AK017', 'Link dan kode untuk admin utama atau asisten hanya bisa dibuat oleh admin utama.');
  end if;
end $$;
revoke all on function private.require_target_right(public.members) from public, anon, authenticated;

-- Perangkat yang sedang dipakai pemanggil (sudah pasti sah kalau
-- current_member_id() tidak kosong).
create or replace function private.current_device()
returns public.devices
language sql
stable
security definer
set search_path = ''
as $$
  select d.* from public.devices d
  where d.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and d.member_id = public.current_member_id()
$$;
revoke all on function private.current_device() from public, anon, authenticated;

-- ── Membuat link undangan ─────────────────────────────────────────
-- p_role: 'lihat' atau 'anggota' untuk anggota baru (bawaan 'anggota');
-- untuk anggota yang sudah ada, kosongkan atau sama dengan perannya.
-- p_adult_confirmed: centang "Saya pastikan orang ini sudah dewasa"
-- (dicatat hanya kalau memang diperlukan).
-- Link lama yang belum dipakai untuk orang yang sama otomatis dibatalkan.
-- Hasil: { invite_id, member_id, token, expires_at }. Token tidak disimpan.
create or replace function public.create_invite(p_person uuid, p_role text default null, p_adult_confirmed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  o public.people;
  m public.members;
  token text := private.random_token();
  undangan private.invites;
  ulang boolean;
begin
  if saya is null or not public.has_perm('buat_undangan') then
    perform private.fail('AK015', 'Anda tidak punya izin membuat link undangan.');
  end if;
  if p_role is not null and p_role not in ('lihat', 'anggota') then
    perform private.fail('AK018', 'Peran untuk undangan hanya "hanya melihat" atau "anggota". Peran anggota yang sudah terdaftar diubah di daftar anggota.');
  end if;
  select * into o from public.people where id = p_person;
  if not found then
    perform private.fail('AK003', 'Undangan hanya untuk keturunan dan menantu di silsilah utama.');
  end if;

  select * into m from public.members where person_id = p_person for update;
  if not found then
    insert into public.members (person_id, display_name, role)
    values (p_person, btrim(left(coalesce(nullif(btrim(o.nickname), ''), btrim(o.full_name)), 100)),
            coalesce(p_role, 'anggota'))
    returning * into m;
  else
    perform private.require_target_right(m);
    if p_role is not null and p_role <> m.role then
      perform private.fail('AK018', 'Peran untuk undangan hanya "hanya melihat" atau "anggota". Peran anggota yang sudah terdaftar diubah di daftar anggota.');
    end if;
  end if;
  ulang := m.auth_user_id is not null;

  update private.invites
  set revoked_at = now(), revoked_by = saya
  where member_id = m.id and used_at is null and revoked_at is null and expires_at > now();

  -- Pemeriksaan dewasa/wafat/keturunan dijalankan trigger undangan (004).
  insert into private.invites (member_id, token_hash, created_by, adult_confirmed_by)
  values (m.id, private.sha256_hex(token), saya,
          case when p_adult_confirmed and private.invite_eligibility(p_person) = 'perlu_konfirmasi' then saya end)
  returning * into undangan;

  insert into private.auth_events (member_id, event, detail)
  values (m.id, 'undangan_dibuat', jsonb_build_object('invite_id', undangan.id, 'oleh', saya, 'ulang', ulang));

  -- Link baru untuk orang yang sudah pernah masuk membuka akunnya dari
  -- perangkat lain; admin utama selalu diberi tahu kalau bukan ia sendiri.
  if ulang and not public.is_owner() then
    perform private.notify_owner(
      'undangan_ulang',
      format('Link baru untuk %s', m.display_name),
      format('%s membuat link undangan baru untuk %s, yang sudah pernah masuk. Kalau ini tidak diminta, batalkan link itu dan periksa perangkat %s.',
             (select display_name from public.members where id = saya), m.display_name, m.display_name),
      null, true);
  end if;

  return jsonb_build_object('invite_id', undangan.id, 'member_id', m.id, 'token', token,
                            'expires_at', undangan.expires_at);
end $$;
revoke all on function public.create_invite(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.create_invite(uuid, text, boolean) to authenticated;

-- ── Membatalkan link undangan yang belum dipakai ──────────────────
create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  undangan private.invites;
  m public.members;
begin
  if saya is null or not public.has_perm('buat_undangan') then
    perform private.fail('AK015', 'Anda tidak punya izin membuat link undangan.');
  end if;
  select * into undangan from private.invites where id = p_invite for update;
  if not found or undangan.used_at is not null or undangan.revoked_at is not null or undangan.expires_at <= now() then
    perform private.fail('AK006', 'Link undangan ini sudah dipakai, kedaluwarsa, atau dicabut.');
  end if;
  select * into m from public.members where id = undangan.member_id;
  perform private.require_target_right(m);
  update private.invites set revoked_at = now(), revoked_by = saya where id = p_invite;
  insert into private.auth_events (member_id, event, detail)
  values (m.id, 'undangan_dicabut', jsonb_build_object('invite_id', p_invite, 'oleh', saya));
end $$;
revoke all on function public.revoke_invite(uuid) from public, anon, authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- Menyimpan kode baru (ulang kalau kebetulan sama dengan kode lama).
create or replace function private.insert_device_code(
  p_member uuid, p_kind text, p_minutes int, p_by uuid, p_device uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  kode text;
  baris private.device_codes;
begin
  for percobaan in 1..5 loop
    kode := private.random_code();
    insert into private.device_codes (member_id, code_hash, kind, access_minutes, created_by, created_from_device)
    values (p_member, private.sha256_hex(kode), p_kind, p_minutes, p_by, p_device)
    on conflict (code_hash) do nothing
    returning * into baris;
    exit when baris.id is not null;
  end loop;
  insert into private.auth_events (member_id, event, detail)
  values (p_member, case p_kind when 'akses_sementara' then 'akses_sementara_diberikan' else 'kode_dibuat' end,
          jsonb_build_object('code_id', baris.id, 'oleh', p_by, 'menit', p_minutes));
  return jsonb_build_object('code_id', baris.id, 'code', substr(kode, 1, 4) || '-' || substr(kode, 5, 4),
                            'expires_at', baris.expires_at, 'access_minutes', p_minutes);
end $$;
revoke all on function private.insert_device_code(uuid, text, int, uuid, uuid) from public, anon, authenticated;

-- ── Kode tambah perangkat (dibuat dari perangkat yang sudah masuk) ─
-- Hasil: { code_id, code ("ABCD-2345"), expires_at }. Kode lama yang belum
-- dipakai otomatis dibatalkan, jadi selalu hanya ada satu kode aktif.
create or replace function public.create_device_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  m public.members;
  d public.devices;
begin
  if saya is null then
    perform private.fail('AK021', 'Anda belum masuk. Silakan masuk dulu.');
  end if;
  select * into m from public.members where id = saya for update;
  d := private.current_device();
  if d.via = 'sementara' or d.expires_at is not null then
    perform private.fail('AK014', 'Perangkat dengan akses sementara tidak bisa menambah perangkat lain.');
  end if;
  if not (select device_codes_enabled from public.settings where id) then
    perform private.fail('AK013', 'Fitur tambah perangkat sedang dimatikan oleh admin.');
  end if;
  if m.hold_until is not null and m.hold_until > now() then
    perform private.fail('AK023', 'Akun Anda sedang ditahan sementara, jadi belum bisa menambah perangkat. Hubungi admin.');
  end if;
  update private.device_codes
  set revoked_at = now()
  where member_id = saya and kind = 'tambah_perangkat'
    and used_at is null and revoked_at is null and expires_at > now();
  return private.insert_device_code(saya, 'tambah_perangkat', null, saya, d.id);
end $$;
revoke all on function public.create_device_code() from public, anon, authenticated;
grant execute on function public.create_device_code() to authenticated;

-- ── Kode akses sementara (admin, atau asisten dengan izin) ────────
-- Hasil: { code_id, code, expires_at, access_minutes }. Kode berlaku
-- 10 menit; aksesnya berlaku p_minutes sejak perangkat didaftarkan.
create or replace function public.create_temp_access_code(p_member uuid, p_minutes int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  sasaran public.members;
  hasil jsonb;
begin
  if saya is null or not public.has_perm('akses_sementara') then
    perform private.fail('AK016', 'Anda tidak punya izin memberi akses sementara.');
  end if;
  if p_minutes is null or p_minutes < 30 then
    perform private.fail('AK022', 'Durasi akses sementara minimal 30 menit.');
  end if;
  select * into sasaran from public.members where id = p_member for update;
  if not found or sasaran.status <> 'aktif' then
    perform private.fail('AK012', 'Akses anggota ini sudah dicabut. Admin utama perlu mengaktifkannya dulu.');
  end if;
  perform private.require_target_right(sasaran);
  update private.device_codes
  set revoked_at = now()
  where member_id = p_member and kind = 'akses_sementara'
    and used_at is null and revoked_at is null and expires_at > now();
  -- Batas durasi dari pengaturan diperiksa trigger kode perangkat (004).
  hasil := private.insert_device_code(p_member, 'akses_sementara', p_minutes, saya, (private.current_device()).id);
  if not public.is_owner() then
    perform private.notify_owner(
      'akses_sementara',
      format('%s diberi akses sementara', sasaran.display_name),
      format('%s memberi %s akses sementara selama %s. Kodenya berlaku 10 menit.',
             (select display_name from public.members where id = saya), sasaran.display_name,
             private.duration_text(p_minutes)),
      null, false);
  end if;
  return hasil;
end $$;
revoke all on function public.create_temp_access_code(uuid, int) from public, anon, authenticated;
grant execute on function public.create_temp_access_code(uuid, int) to authenticated;

-- ── Untuk Edge Function: memeriksa dan memakai link/kode ──────────

-- Sudah terlalu banyak percobaan salah? (dilihat SEBELUM mencari link/kode,
-- supaya penebak tidak mendapat jawaban apa pun)
create or replace function private.redeem_blocked(p_kind text, p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from private.redeem_attempts
     where kind = p_kind and ip is not distinct from p_ip and at > now() - interval '15 minutes')
      >= case p_kind when 'kode' then 5 else 10 end
    or (p_kind = 'kode' and
        (select count(*) from private.redeem_attempts
         where kind = 'kode' and at > now() - interval '10 minutes') >= 30)
$$;
revoke all on function private.redeem_blocked(text, inet) from public, anon, authenticated;

-- Alasan link/kode tidak bisa dipakai, atau null kalau masih bisa.
create or replace function private.redemption_problem(p_kind text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  i private.invites;
  c private.device_codes;
  status_anggota text;
begin
  if p_kind = 'undangan' then
    select * into i from private.invites where id = p_id;
    select status into status_anggota from public.members where id = i.member_id;
    if status_anggota <> 'aktif' or i.revoked_at is not null then return 'dicabut'; end if;
    if i.used_at is not null then return 'sudah_dipakai'; end if;
    if i.expires_at <= now() then return 'kedaluwarsa'; end if;
  else
    select * into c from private.device_codes where id = p_id;
    select status into status_anggota from public.members where id = c.member_id;
    if status_anggota <> 'aktif' or c.revoked_at is not null then return 'dicabut'; end if;
    if c.used_at is not null then return 'sudah_dipakai'; end if;
    if c.expires_at <= now() then return 'kedaluwarsa'; end if;
    if c.kind = 'tambah_perangkat' and not (select device_codes_enabled from public.settings where id) then
      return 'dimatikan';
    end if;
  end if;
  return null;
end $$;
revoke all on function private.redemption_problem(text, uuid) from public, anon, authenticated;

-- Mencatat percobaan yang ditolak dan memberi tahu admin utama kalau perlu.
-- Hasil: { status: alasan }.
create or replace function private.reject_redemption(
  p_kind text, p_ip inet, p_member uuid, p_alasan text, p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev bigint;
  nama text;
  per_alamat int;
  semua int;
  batas constant int := case p_kind when 'kode' then 5 else 10 end;
begin
  insert into private.redeem_attempts (kind, ip) values (p_kind, p_ip);

  if p_member is not null then
    insert into private.auth_events (member_id, event, detail)
    values (p_member, case p_kind when 'undangan' then 'undangan_ditolak' else 'kode_ditolak' end,
            jsonb_build_object('alasan', p_alasan))
    returning id into ev;
    if p_ip is not null then
      insert into private.login_ips (event_id, ip) values (ev, p_ip);
    end if;
    if p_kind = 'kode' then
      update private.device_codes set attempts = attempts + 1 where id = p_id;
    end if;
    -- Link yang sudah dipakai dibuka lagi: bisa jadi link diteruskan ke
    -- orang lain, atau dipakai orang lain lebih dulu.
    if p_kind = 'undangan' and p_alasan = 'sudah_dipakai' then
      select display_name into nama from public.members where id = p_member;
      perform private.notify_owner(
        'login_mencurigakan',
        format('Link undangan %s dibuka lagi', nama),
        format('Link undangan untuk %s sudah dipakai, tetapi ada yang mencoba memakainya lagi. Tanyakan kepada %s apakah ia sudah bisa masuk. Kalau belum, cabut perangkat yang terdaftar atas namanya dan buat link baru.',
               nama, nama),
        null, true);
    end if;
  end if;

  -- Batas per alamat baru saja tercapai: beri tahu sekali.
  select count(*) into per_alamat from private.redeem_attempts
  where kind = p_kind and ip is not distinct from p_ip and at > now() - interval '15 minutes';
  if per_alamat = batas then
    insert into private.auth_events (event, detail)
    values ('login_mencurigakan', jsonb_build_object('jenis', p_kind, 'percobaan_salah', per_alamat))
    returning id into ev;
    if p_ip is not null then
      insert into private.login_ips (event_id, ip) values (ev, p_ip);
    end if;
    perform private.notify_owner(
      'login_mencurigakan',
      case p_kind when 'kode' then 'Banyak percobaan kode perangkat yang salah'
                  else 'Banyak percobaan link undangan yang salah' end,
      format('Ada %s percobaan yang salah dalam 15 menit dari satu alamat internet. Percobaan berikutnya dari alamat itu ditolak selama 15 menit.', per_alamat),
      null, true);
  end if;

  -- Batas untuk semua alamat (kode saja) baru saja tercapai.
  if p_kind = 'kode' then
    select count(*) into semua from private.redeem_attempts
    where kind = 'kode' and at > now() - interval '10 minutes';
    if semua = 30 then
      perform private.notify_owner(
        'login_mencurigakan',
        'Pemakaian kode perangkat dihentikan sementara',
        'Ada 30 percobaan kode yang salah dalam 10 menit dari berbagai alamat internet. Semua pemakaian kode perangkat ditolak sampai percobaan salah berkurang (paling lama 10 menit).',
        null, true);
    end if;
  end if;

  return jsonb_build_object('status', p_alasan);
end $$;
revoke all on function private.reject_redemption(text, inet, uuid, text, uuid) from public, anon, authenticated;

-- Langkah 1 Edge Function: apakah link/kode ini masih bisa dipakai?
-- Tidak mengubah link/kode. Hasil:
--   { status: 'ok', member_id, user_id (akun login yang sudah tertaut, atau null) }
--   { status: 'tidak_dikenal' | 'salah' | 'sudah_dipakai' | 'kedaluwarsa'
--             | 'dicabut' | 'dimatikan' | 'terlalu_sering' }
create or replace function public.edge_check_redemption(p_kind text, p_hash text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip inet := private.safe_inet(p_ip);
  rid uuid;
  mid uuid;
  masalah text;
begin
  if p_kind is null or p_kind not in ('undangan', 'kode') or coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'tidak_dikenal');
  end if;
  if private.redeem_blocked(p_kind, ip) then
    return jsonb_build_object('status', 'terlalu_sering');
  end if;
  if p_kind = 'undangan' then
    select id, member_id into rid, mid from private.invites where token_hash = p_hash;
  else
    select id, member_id into rid, mid from private.device_codes where code_hash = p_hash;
  end if;
  if rid is null then
    return private.reject_redemption(p_kind, ip, null,
      case p_kind when 'undangan' then 'tidak_dikenal' else 'salah' end, null);
  end if;
  masalah := private.redemption_problem(p_kind, rid);
  if masalah is not null then
    return private.reject_redemption(p_kind, ip, mid, masalah, rid);
  end if;
  return jsonb_build_object('status', 'ok', 'member_id', mid,
                            'user_id', (select auth_user_id from public.members where id = mid));
end $$;
revoke all on function public.edge_check_redemption(text, text, text) from public, anon, authenticated;
grant execute on function public.edge_check_redemption(text, text, text) to service_role;

-- Langkah 2 Edge Function (hanya untuk orang yang belum punya akun login):
-- menautkan akun login yang baru dibuat. Tidak pernah mengganti akun yang
-- sudah tertaut. Hasil: { status: 'ok' | 'bentrok' }.
create or replace function public.edge_attach_auth_user(p_member uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sekarang uuid;
begin
  select auth_user_id into sekarang from public.members where id = p_member and status = 'aktif' for update;
  if not found or p_user is null then
    return jsonb_build_object('status', 'bentrok');
  end if;
  if sekarang is null then
    update public.members set auth_user_id = p_user where id = p_member;
  elsif sekarang <> p_user then
    return jsonb_build_object('status', 'bentrok');
  end if;
  return jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.edge_attach_auth_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.edge_attach_auth_user(uuid, uuid) to service_role;

-- Langkah 3 Edge Function: memakai link/kode (sekali saja, dikunci supaya
-- dua orang yang menekan "Masuk" bersamaan tidak sama-sama berhasil) dan
-- memberi tiket klaim perangkat.
-- p_info: { device_type, label, approx_city, approx_country } (perkiraan).
-- Hasil: { status: 'ok', ticket, member_id, display_name, via, access_minutes }
--        atau { status: alasan } seperti edge_check_redemption.
create or replace function public.edge_complete_redemption(
  p_kind text, p_hash text, p_ip text default null, p_info jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip inet := private.safe_inet(p_ip);
  i private.invites;
  c private.device_codes;
  rid uuid;
  mid uuid;
  m public.members;
  masalah text;
  via text;
  menit int;
  ev bigint;
  tiket text := private.random_token();
  jenis_perangkat text := nullif(left(btrim(coalesce(p_info ->> 'device_type', '')), 50), '');
  negara text := upper(coalesce(p_info ->> 'approx_country', ''));
begin
  if p_kind is null or p_kind not in ('undangan', 'kode') or coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'tidak_dikenal');
  end if;
  if p_kind = 'undangan' then
    select * into i from private.invites where token_hash = p_hash for update;
    rid := i.id;
    mid := i.member_id;
  else
    select * into c from private.device_codes where code_hash = p_hash for update;
    rid := c.id;
    mid := c.member_id;
  end if;
  if rid is null then
    return private.reject_redemption(p_kind, ip, null,
      case p_kind when 'undangan' then 'tidak_dikenal' else 'salah' end, null);
  end if;
  masalah := private.redemption_problem(p_kind, rid);
  if masalah is not null then
    return private.reject_redemption(p_kind, ip, mid, masalah, rid);
  end if;
  select * into m from public.members where id = mid;
  if m.auth_user_id is null then
    -- Edge Function belum menautkan akun login: kesalahan program, bukan
    -- kesalahan pengguna. Link/kode tidak dipakai.
    return jsonb_build_object('status', 'server');
  end if;

  if p_kind = 'undangan' then
    update private.invites set used_at = now() where id = rid;
    via := 'undangan';
  else
    update private.device_codes set used_at = now() where id = rid;
    via := case c.kind when 'akses_sementara' then 'sementara' else 'kode' end;
    menit := c.access_minutes;
  end if;

  insert into private.auth_events (member_id, event, device_type, approx_city, approx_country, detail)
  values (mid, case p_kind when 'undangan' then 'undangan_dipakai' else 'kode_dipakai' end,
          jenis_perangkat, nullif(left(btrim(coalesce(p_info ->> 'approx_city', '')), 100), ''),
          case when negara ~ '^[A-Z]{2}$' then negara end,
          jsonb_build_object('via', via) || case p_kind when 'undangan' then jsonb_build_object('invite_id', rid)
                                                        else jsonb_build_object('code_id', rid) end)
  returning id into ev;
  if ip is not null then
    insert into private.login_ips (event_id, ip) values (ev, ip);
  end if;

  insert into private.device_claims (ticket_hash, member_id, via, access_minutes, invite_id, code_id, event_id,
                                     device_type, label, approx_city, approx_country)
  select private.sha256_hex(tiket), mid, via, menit,
         case p_kind when 'undangan' then rid end, case p_kind when 'kode' then rid end, ev,
         e.device_type, nullif(left(btrim(coalesce(p_info ->> 'label', '')), 100), ''), e.approx_city, e.approx_country
  from private.auth_events e where e.id = ev;

  return jsonb_build_object('status', 'ok', 'ticket', tiket, 'member_id', mid, 'display_name', m.display_name,
                            'via', via, 'access_minutes', menit);
end $$;
revoke all on function public.edge_complete_redemption(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.edge_complete_redemption(text, text, text, jsonb) to service_role;

-- ── Klaim perangkat (dari aplikasi, setelah sesi terbentuk) ───────
-- Mendaftarkan sesi yang sedang dipakai sebagai perangkat anggota itu.
-- Aman diulang: kalau tiket ini sudah mendaftarkan sesi yang sama, hasilnya
-- perangkat yang sama. Hasil: { device_id, member_id, via, expires_at }.
create or replace function public.claim_device(p_ticket text, p_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sesi uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  t private.device_claims;
  m public.members;
  d public.devices;
  zona text := case when length(p_timezone) <= 64 and p_timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$'
                    then p_timezone end;
begin
  if auth.uid() is null or sesi is null then
    perform private.fail('AK021', 'Anda belum masuk. Silakan masuk dulu.');
  end if;
  select * into t from private.device_claims where ticket_hash = private.sha256_hex(coalesce(p_ticket, '')) for update;
  if not found then
    perform private.fail('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.');
  end if;
  select * into m from public.members where id = t.member_id;
  if m.auth_user_id is distinct from auth.uid() or m.status <> 'aktif' then
    perform private.fail('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.');
  end if;
  if t.used_at is not null then
    select * into d from public.devices where id = t.used_device_id and session_id = sesi;
    if not found then
      perform private.fail('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.');
    end if;
    return jsonb_build_object('device_id', d.id, 'member_id', d.member_id, 'via', d.via, 'expires_at', d.expires_at);
  end if;
  if t.expires_at <= now() then
    perform private.fail('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.');
  end if;
  if exists (select 1 from public.devices where session_id = sesi) then
    perform private.fail('AK020', 'Sesi ini sudah terdaftar sebagai perangkat lain. Keluar dulu, lalu masuk lagi.');
  end if;

  insert into public.devices (member_id, session_id, via, expires_at, label, device_type,
                              approx_city, approx_country, timezone, last_seen_at)
  values (m.id, sesi, t.via,
          case when t.via = 'sementara' then now() + make_interval(mins => t.access_minutes) end,
          t.label, t.device_type, t.approx_city, t.approx_country, zona, now())
  returning * into d;

  update private.device_claims set used_at = now(), used_device_id = d.id where id = t.id;
  update private.invites set used_device_id = d.id where id = t.invite_id;
  update private.device_codes set used_device_id = d.id where id = t.code_id;
  update private.auth_events set device_id = d.id where id = t.event_id;

  return jsonb_build_object('device_id', d.id, 'member_id', d.member_id, 'via', d.via, 'expires_at', d.expires_at);
end $$;
revoke all on function public.claim_device(text, text) from public, anon, authenticated;
grant execute on function public.claim_device(text, text) to authenticated;

-- ── Bersih-bersih harian (jadwal.sql) ─────────────────────────────
-- Percobaan salah (berisi alamat IP) dan tiket klaim lebih dari 1 hari
-- tidak diperlukan lagi. Hasil: jumlah baris yang dihapus.
create or replace function private.purge_redeem_data()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a int;
  b int;
begin
  delete from private.redeem_attempts where at < now() - interval '1 day';
  get diagnostics a = row_count;
  delete from private.device_claims where expires_at < now() - interval '1 day';
  get diagnostics b = row_count;
  return a + b;
end $$;
revoke all on function private.purge_redeem_data() from public, anon, authenticated;

insert into public.app_migrations (version, name)
values ('009', 'undangan_perangkat')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with
  tabel as (
    select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname, c.relname) in (('private', 'device_claims'), ('private', 'redeem_attempts'))
  ),
  fungsi_edge as (
    select p.oid, p.proname as nama
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'edge\_%'
  )
select 'Tabel baru (dari 2) dengan RLS' as pemeriksaan,
       (select count(*)::text from tabel where rls) as hasil,
       '2' as harus
union all
select 'Tabel baru yang bisa disentuh anon/authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel
                 where has_table_privilege('anon', oid, 'select, insert, update, delete')
                    or has_table_privilege('authenticated', oid, 'select, insert, update, delete')),
                'tidak ada'),
       'tidak ada'
union all
select 'Fungsi khusus Edge Function (dari 3)',
       (select count(*)::text from fungsi_edge),
       '3'
union all
select 'Fungsi khusus Edge Function yang bisa dijalankan anon/authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from fungsi_edge
                 where has_function_privilege('anon', oid, 'execute')
                    or has_function_privilege('authenticated', oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi khusus Edge Function yang bisa dijalankan service_role',
       (select count(*)::text from fungsi_edge where has_function_privilege('service_role', oid, 'execute')),
       '3'
union all
select 'pgcrypto bisa dipakai (SHA-256 contoh)',
       (private.sha256_hex('abc') = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')::text,
       'true'
union all
select 'Fungsi di public/private yang bisa dijalankan anon',
       coalesce((select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private')
                   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Versi database',
       public.db_version(),
       '009 atau lebih';
