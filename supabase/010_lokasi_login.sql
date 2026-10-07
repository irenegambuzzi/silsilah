-- 010 — Perkiraan lokasi login, notifikasi login ke admin utama, login
-- mencurigakan, dan pemeriksaan perangkat saat aplikasi dibuka.
--
-- Lokasi diperkirakan Edge Function dari alamat IP memakai data DB-IP Lite
-- yang disimpan di Storage privat (bucket lokasi-ip) dan dibaca di memori:
-- alamat IP TIDAK dikirim ke layanan lain. Kota untuk Indonesia dan Italia,
-- negara saja untuk negara lain. Tanpa GPS dan tanpa koordinat. Selalu
-- ditulis "sekitar …", karena IP data seluler sering terbaca sebagai kota
-- besar. Alamat IP mentah tetap dihapus setelah 30 hari (004, jadwal.sql).
--
--   Login baru (perangkat terdaftar)   → admin utama diberi tahu satu per
--     satu, atau dikumpulkan per jam kalau "ringkasan per jam" dinyalakan
--     (settings.login_digest_hourly).
--   Login dari negara di luar daftar negara biasa (settings.usual_countries,
--     bawaan Indonesia dan Italia) DAN di luar negara yang dipakai anggota
--     itu 90 hari terakhir → login mencurigakan: SELALU langsung, dengan
--     tautan "Cabut perangkat ini".
--   Perangkat atau anggota yang sudah dicabut tetapi aplikasinya masih
--     dibuka (Edge Function cek-perangkat) → langsung, paling banyak sekali
--     sehari per perangkat.
--   revoke_device(): mencabut perangkat sendiri, atau perangkat siapa pun
--     oleh admin utama (tombol "Cabut perangkat ini").
--
-- Kode error: AK024 perangkat tidak ditemukan / bukan milik Anda
--
-- Aman dijalankan ulang. Membutuhkan 001–009.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- "sekitar Semarang, Indonesia" · "sekitar Nigeria" · "lokasi tidak diketahui"
-- Nama negara bahasa Indonesia datang dari Edge Function (Intl.DisplayNames);
-- kalau tidak ada, kodenya yang ditulis. Daftar nama negara sengaja tidak
-- disimpan di repo (pemindai data pribadi memeriksa setiap kata).
create or replace function private.location_label(kota text, negara text, nama_negara text default null)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when negara is null then 'lokasi tidak diketahui'
    when nullif(btrim(kota), '') is null then 'sekitar ' || coalesce(nullif(btrim(nama_negara), ''), negara)
    else 'sekitar ' || btrim(kota) || ', ' || coalesce(nullif(btrim(nama_negara), ''), negara)
  end
$$;
revoke all on function private.location_label(text, text, text) from public, anon, authenticated;

-- Jam ("14.05") menurut zona waktu perangkat admin utama yang terakhir
-- aktif; bawaan WIB.
create or replace function private.owner_clock(waktu timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  zona text;
begin
  select d.timezone into zona
  from public.devices d join public.members m on m.id = d.member_id
  where m.is_owner and d.revoked_at is null and d.timezone is not null
  order by coalesce(d.last_seen_at, d.created_at) desc
  limit 1;
  begin
    return to_char(waktu at time zone coalesce(zona, 'Asia/Jakarta'), 'HH24.MI');
  exception when others then
    return to_char(waktu at time zone 'Asia/Jakarta', 'HH24.MI');
  end;
end $$;
revoke all on function private.owner_clock(timestamptz) from public, anon, authenticated;

-- ── Ringkasan login per jam ───────────────────────────────────────
create table if not exists private.login_digest (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  line text not null check (length(line) <= 300)
);
alter table private.login_digest enable row level security;
revoke all on table private.login_digest from public, anon, authenticated;

-- Dijadwalkan setiap jam (jadwal.sql). Hasil: jumlah login yang diringkas.
create or replace function private.send_login_digest()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  baris text[];
  n int;
  isi text := '';
  dipakai int := 0;
  b text;
begin
  with diambil as (delete from private.login_digest returning at, line)
  select array_agg(line order by at) into baris from diambil;
  n := coalesce(array_length(baris, 1), 0);
  if n = 0 then
    return 0;
  end if;
  foreach b in array baris loop
    exit when length(isi) + length(b) + 1 > 1900;
    isi := isi || case when dipakai > 0 then E'\n' else '' end || b;
    dipakai := dipakai + 1;
  end loop;
  if dipakai < n then
    isi := isi || E'\n' || format('… dan %s login lainnya.', n - dipakai);
  end if;
  perform private.notify_owner('ringkasan_login', format('Ringkasan login: %s kali dalam 1 jam terakhir', n),
                               isi, '#/admin/perangkat', false);
  return n;
end $$;
revoke all on function private.send_login_digest() from public, anon, authenticated;

-- ── Login baru → notifikasi admin utama ───────────────────────────
-- Perangkat didaftarkan lewat claim_device() (009). Lewat SQL Editor tidak
-- memicu notifikasi.
create or replace function private.trg_devices_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members;
  biasa text[];
  ringkasan boolean;
  lokasi text := private.location_label(new.approx_city, new.approx_country, new.approx_country_name);
  jam text := private.owner_clock(new.created_at);
  perangkat text := coalesce(new.device_type, 'Perangkat');
  lewat text;
begin
  if private.is_maintenance() then
    return null;
  end if;
  select * into m from public.members where id = new.member_id;
  select usual_countries, login_digest_hourly into biasa, ringkasan from public.settings where id;
  lewat := case new.via
    when 'undangan' then 'lewat link undangan'
    when 'kode' then 'lewat kode tambah perangkat'
    when 'sementara' then 'akses sementara ' || private.duration_text(
      greatest(1, round(extract(epoch from (new.expires_at - new.created_at)) / 60)::int))
    else 'lewat akun Google'
  end;

  if new.approx_country is not null
     and not (new.approx_country = any (coalesce(biasa, '{}')))
     and not exists (
       select 1 from public.devices d
       where d.member_id = new.member_id and d.id <> new.id
         and d.approx_country = new.approx_country and d.created_at > now() - interval '90 days') then
    insert into private.auth_events (member_id, device_id, event, device_type, approx_city, approx_country, detail)
    values (new.member_id, new.id, 'login_mencurigakan', new.device_type, new.approx_city, new.approx_country,
            jsonb_build_object('alasan', 'negara_tidak_biasa', 'via', new.via));
    perform private.notify_owner(
      'login_mencurigakan',
      format('Login mencurigakan: %s', m.display_name),
      format('%s baru masuk dari negara yang tidak biasa · %s · %s · %s, %s. Kalau ini bukan %s, tekan "Cabut perangkat ini".',
             m.display_name, perangkat, lokasi, jam, lewat, m.display_name),
      '#/admin/perangkat?cabut=' || new.id, true);
  elsif ringkasan then
    insert into private.login_digest (line)
    values (left(format('%s · %s · %s · %s', m.display_name, perangkat, lokasi, jam), 300));
  else
    perform private.notify_owner(
      'login_baru',
      format('%s baru masuk', m.display_name),
      format('%s · %s · %s, %s.', perangkat, lokasi, jam, lewat),
      '#/admin/perangkat', false);
  end if;
  return null;
end $$;
revoke all on function private.trg_devices_login() from public, anon, authenticated;

drop trigger if exists zz_login on public.devices;
create trigger zz_login after insert on public.devices
  for each row execute function private.trg_devices_login();

-- ── Mencabut perangkat ────────────────────────────────────────────
-- Perangkat sendiri (termasuk perangkat yang sedang dipakai), atau perangkat
-- siapa pun oleh admin utama dengan verifikasi dua langkah. Mencabut lagi
-- perangkat yang sudah dicabut tidak berbuat apa-apa.
create or replace function public.revoke_device(p_device uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  d public.devices;
begin
  if saya is null then
    perform private.fail('AK021', 'Anda belum masuk. Silakan masuk dulu.');
  end if;
  select * into d from public.devices where id = p_device for update;
  if not found or (d.member_id <> saya and not public.is_owner()) then
    perform private.fail('AK024', 'Perangkat ini tidak ditemukan, atau bukan milik Anda.');
  end if;
  if d.revoked_at is not null then
    return;
  end if;
  update public.devices set revoked_at = now(), revoked_by = saya where id = p_device;
  insert into private.auth_events (member_id, device_id, event, detail)
  values (d.member_id, d.id, 'perangkat_dicabut', jsonb_build_object('oleh', saya));
end $$;
revoke all on function public.revoke_device(uuid) from public, anon, authenticated;
grant execute on function public.revoke_device(uuid) to authenticated;

-- ── Untuk Edge Function cek-perangkat (hanya service_role) ────────
-- Status perangkat untuk sesi login ini, dan catat "terakhir aktif".
-- Hasil: { status: 'ok' | 'kedaluwarsa' | 'tidak_terdaftar' | 'dicabut', … }
-- Untuk 'dicabut': lapor = true kalau admin belum diberi tahu 24 jam ini.
create or replace function public.edge_device_check(p_user uuid, p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devices;
  m public.members;
begin
  select * into d from public.devices where session_id = p_session;
  if not found then
    return jsonb_build_object('status', 'tidak_terdaftar');
  end if;
  select * into m from public.members where id = d.member_id;
  if m.auth_user_id is distinct from p_user then
    return jsonb_build_object('status', 'tidak_terdaftar');
  end if;
  if d.revoked_at is not null or m.status <> 'aktif' then
    return jsonb_build_object('status', 'dicabut', 'device_id', d.id, 'lapor', not exists (
      select 1 from private.auth_events e
      where e.device_id = d.id and e.event = 'login_mencurigakan'
        and e.detail ->> 'alasan' = 'perangkat_dicabut' and e.at > now() - interval '1 day'));
  end if;
  if d.expires_at is not null and d.expires_at <= now() then
    return jsonb_build_object('status', 'kedaluwarsa', 'expires_at', d.expires_at);
  end if;
  update public.devices set last_seen_at = now()
  where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
  update public.members set last_seen_at = now()
  where id = m.id and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
  return jsonb_build_object('status', 'ok', 'member_id', m.id, 'expires_at', d.expires_at);
end $$;
revoke all on function public.edge_device_check(uuid, uuid) from public, anon, authenticated;
grant execute on function public.edge_device_check(uuid, uuid) to service_role;

-- Perangkat/anggota yang sudah dicabut masih membuka aplikasi: catat (dengan
-- perkiraan lokasi dan IP, IP dihapus setelah 30 hari) dan beri tahu admin
-- utama, paling banyak sekali sehari per perangkat.
-- p_info: { device_type, approx_city, approx_country, approx_country_name }.
-- Hasil: { status: 'ok' | 'dilewati' }.
create or replace function public.edge_report_revoked_device(p_device uuid, p_ip text default null, p_info jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.devices;
  m public.members;
  ev bigint;
  ip inet := private.safe_inet(p_ip);
  negara text := upper(coalesce(p_info ->> 'approx_country', ''));
  kota text := nullif(left(btrim(coalesce(p_info ->> 'approx_city', '')), 100), '');
  lokasi text;
begin
  select * into d from public.devices where id = p_device;
  if not found then
    return jsonb_build_object('status', 'dilewati');
  end if;
  select * into m from public.members where id = d.member_id;
  if (d.revoked_at is null and m.status = 'aktif') or exists (
       select 1 from private.auth_events e
       where e.device_id = d.id and e.event = 'login_mencurigakan'
         and e.detail ->> 'alasan' = 'perangkat_dicabut' and e.at > now() - interval '1 day') then
    return jsonb_build_object('status', 'dilewati');
  end if;
  if negara !~ '^[A-Z]{2}$' then
    negara := null;
    kota := null;
  end if;
  lokasi := private.location_label(kota, negara, left(p_info ->> 'approx_country_name', 100));

  insert into private.auth_events (member_id, device_id, event, device_type, approx_city, approx_country, detail)
  values (m.id, d.id, 'login_mencurigakan', nullif(left(btrim(coalesce(p_info ->> 'device_type', '')), 50), ''),
          kota, negara, jsonb_build_object('alasan', 'perangkat_dicabut', 'anggota_dicabut', m.status <> 'aktif'))
  returning id into ev;
  if ip is not null then
    insert into private.login_ips (event_id, ip) values (ev, ip);
  end if;

  if m.status <> 'aktif' then
    perform private.notify_owner(
      'login_mencurigakan',
      format('%s membuka aplikasi walaupun aksesnya sudah dicabut', m.display_name),
      format('%s milik %s dibuka lagi · %s · %s. Aksesnya sudah dicabut, jadi data tetap tertutup.',
             coalesce(d.label, d.device_type, 'Perangkat'), m.display_name, lokasi, private.owner_clock()),
      '#/admin/anggota', true);
  else
    perform private.notify_owner(
      'login_mencurigakan',
      format('Perangkat yang sudah dicabut dibuka lagi: %s', m.display_name),
      format('%s milik %s dibuka lagi · %s · %s. Data tetap tertutup untuk perangkat ini. Kalau ini mencurigakan, cabut akses %s sepenuhnya.',
             coalesce(d.label, d.device_type, 'Perangkat'), m.display_name, lokasi, private.owner_clock(), m.display_name),
      '#/admin/anggota', true);
  end if;
  return jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.edge_report_revoked_device(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.edge_report_revoked_device(uuid, text, jsonb) to service_role;

-- ── Storage privat untuk file data lokasi ─────────────────────────
-- Tanpa policy: hanya Edge Function (service_role) yang bisa membaca, dan
-- hanya workflow pembaruan bulanan (langkah 1.28) yang mengunggah.
insert into storage.buckets (id, name, public, file_size_limit)
values ('lokasi-ip', 'lokasi-ip', false, 52428800)
on conflict (id) do update set public = false;

insert into public.app_migrations (version, name)
values ('010', 'lokasi_login')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with
  tabel as (
    select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where (n.nspname, c.relname) in (('private', 'login_digest'))
  ),
  fungsi_edge as (
    select p.oid, p.proname as nama
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('edge_device_check', 'edge_report_revoked_device')
  )
select 'Tabel baru (dari 1) dengan RLS' as pemeriksaan,
       (select count(*)::text from tabel where rls) as hasil,
       '1' as harus
union all
select 'Tabel baru yang bisa disentuh anon/authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from tabel
                 where has_table_privilege('anon', oid, 'select, insert, update, delete')
                    or has_table_privilege('authenticated', oid, 'select, insert, update, delete')),
                'tidak ada'),
       'tidak ada'
union all
select 'Kolom nama negara di perangkat',
       (select count(*)::text from information_schema.columns
        where table_schema = 'public' and table_name = 'devices' and column_name = 'approx_country_name'),
       '1'
union all
select 'Fungsi Edge baru yang bisa dijalankan anon/authenticated',
       coalesce((select string_agg(nama, ', ' order by nama) from fungsi_edge
                 where has_function_privilege('anon', oid, 'execute')
                    or has_function_privilege('authenticated', oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi Edge baru yang bisa dijalankan service_role (dari 2)',
       (select count(*)::text from fungsi_edge where has_function_privilege('service_role', oid, 'execute')),
       '2'
union all
select 'Bucket lokasi-ip ada dan PRIVAT',
       (select count(*)::text from storage.buckets where id = 'lokasi-ip' and not public),
       '1'
union all
select 'Policy Storage yang membuka bucket lokasi-ip',
       (select count(*)::text from pg_policies
        where schemaname = 'storage' and (coalesce(qual, '') || coalesce(with_check, '')) like '%lokasi-ip%'),
       '0'
union all
select 'Trigger notifikasi login terpasang',
       (select count(*)::text from pg_trigger where tgname = 'zz_login' and tgrelid = 'public.devices'::regclass),
       '1'
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
       '010 atau lebih';
