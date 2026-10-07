-- 011 — Dukungan layar masuk: "Bukan saya" dan "Keluar".
--
--   report_not_me()      Di layar "Selamat datang", orang yang menerima link
--                        memilih "Bukan saya". Perangkat itu LANGSUNG ditutup
--                        aksesnya, dan admin utama diberi tahu (penting).
--   sign_out_devices()   "Keluar dari perangkat ini" atau "Keluar dari semua
--                        perangkat": perangkat dicabut (jadi tidak ada data
--                        lagi yang bisa dibaca dari situ) dan dicatat di log.
--
-- Kode error: AK025 hanya bisa dipakai dari perangkat yang sudah masuk
--
-- Aman dijalankan ulang. Membutuhkan 001–010.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

alter table private.auth_events drop constraint if exists auth_events_event_check;
alter table private.auth_events add constraint auth_events_event_check check (event in (
  'undangan_dibuat', 'undangan_dicabut', 'undangan_dipakai', 'undangan_ditolak',
  'kode_dibuat', 'kode_dipakai', 'kode_ditolak',
  'akses_sementara_diberikan', 'login_google', 'perangkat_dicabut', 'akses_dicabut',
  'verifikasi_dua_langkah', 'login_mencurigakan', 'keluar', 'bukan_saya'));

-- ── "Bukan saya" ──────────────────────────────────────────────────
-- Hanya dari perangkat yang sedang sah. Perangkat itu dicabut; link/kode
-- yang sudah terpakai tidak bisa dipakai lagi, jadi admin perlu membuat
-- link baru untuk orang yang benar. Hasil: { status: 'ok' }.
create or replace function public.report_not_me()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  d public.devices;
  m public.members;
  lokasi text;
begin
  if saya is null then
    perform private.fail('AK025', 'Anda belum masuk dari perangkat ini.');
  end if;
  d := private.current_device();
  select * into m from public.members where id = saya;
  lokasi := private.location_label(d.approx_city, d.approx_country, d.approx_country_name);

  update public.devices set revoked_at = now(), revoked_by = saya where id = d.id and revoked_at is null;
  insert into private.auth_events (member_id, device_id, event, device_type, approx_city, approx_country, detail)
  values (saya, d.id, 'bukan_saya', d.device_type, d.approx_city, d.approx_country, jsonb_build_object('via', d.via));

  perform private.notify_owner(
    'bukan_saya',
    format('"Bukan saya": link untuk %s', m.display_name),
    format('Link undangan untuk %s dipakai di %s (%s, %s), tetapi pemakainya memilih "Bukan saya". Akses perangkat itu sudah ditutup. Buat link baru untuk %s, dan pastikan link itu sampai ke orang yang benar.',
           m.display_name, coalesce(d.label, d.device_type, 'sebuah perangkat'), lokasi, private.owner_clock(), m.display_name),
    '#/admin/anggota', true);
  return jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.report_not_me() from public, anon, authenticated;
grant execute on function public.report_not_me() to authenticated;

-- ── Keluar ────────────────────────────────────────────────────────
-- p_all = false: hanya perangkat ini. p_all = true: semua perangkat milik
-- anggota ini. Kalau perangkat sudah tidak sah (dicabut atau kedaluwarsa),
-- tidak ada yang dilakukan (hasil 0): aplikasi tetap keluar di sisinya.
-- Hasil: jumlah perangkat yang dicabut.
create or replace function public.sign_out_devices(p_all boolean default false)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  d public.devices;
  n int;
begin
  if saya is null then
    return 0;
  end if;
  d := private.current_device();
  update public.devices set revoked_at = now(), revoked_by = saya
  where revoked_at is null and (id = d.id or (p_all and member_id = saya));
  get diagnostics n = row_count;
  insert into private.auth_events (member_id, device_id, event, device_type, detail)
  values (saya, d.id, 'keluar', d.device_type, jsonb_build_object('semua', coalesce(p_all, false), 'jumlah', n));
  return n;
end $$;
revoke all on function public.sign_out_devices(boolean) from public, anon, authenticated;
grant execute on function public.sign_out_devices(boolean) to authenticated;

insert into public.app_migrations (version, name)
values ('011', 'layar_masuk')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Fungsi baru yang bisa dijalankan anon' as pemeriksaan,
       coalesce((select string_agg(p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname in ('report_not_me', 'sign_out_devices')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada') as hasil,
       'tidak ada' as harus
union all
select 'Fungsi baru yang bisa dijalankan pengguna login (dari 2)',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('report_not_me', 'sign_out_devices')
          and has_function_privilege('authenticated', p.oid, 'execute')),
       '2'
union all
select 'Peristiwa log "bukan_saya" dikenal',
       (select count(*)::text from pg_constraint
        where conname = 'auth_events_event_check' and pg_get_constraintdef(oid) like '%bukan_saya%'),
       '1'
union all
select 'Versi database',
       public.db_version(),
       '011 atau lebih';
