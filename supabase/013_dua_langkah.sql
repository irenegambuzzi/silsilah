-- 013 — Verifikasi dua langkah admin utama (TOTP).
--
-- Fungsi admin sudah sejak 004 hanya berlaku dengan sesi terverifikasi dua
-- langkah (is_owner() menuntut aal2). File ini menambah:
--
--   record_second_factor()   Dipanggil aplikasi admin utama setelah
--                            memasukkan kode, mendaftarkan, atau menghapus
--                            aplikasi authenticator: mencatat "terverifikasi"
--                            (sekali per perangkat) dan memeriksa daftar
--                            authenticator.
--   private.check_owner_factors()
--                            Membandingkan authenticator admin utama yang
--                            terdaftar di Supabase Auth dengan yang sudah
--                            dikenal. Yang baru atau yang hilang dicatat di
--                            log dan admin utama diberi tahu (penting).
--                            Dijadwalkan setiap 10 menit (jadwal.sql), jadi
--                            perubahan tetap ketahuan walaupun bukan lewat
--                            aplikasi.
--   private.emergency_reset_owner_2fa('PULIHKAN')
--                            PROSEDUR DARURAT, hanya dari SQL Editor (lihat
--                            README dan supabase/darurat/): HP atau aplikasi
--                            authenticator admin utama hilang. Semua
--                            authenticator admin utama dihapus, semua
--                            perangkat dan sesi login admin utama diakhiri,
--                            dan dibuat SATU link masuk baru (7 hari, sekali
--                            pakai). Data keluarga tidak disentuh.
--
-- Kode error: AK027 konfirmasi pemulihan salah · AK028 hanya dari SQL
-- Editor · AK029 admin utama belum ada
--
-- Aman dijalankan ulang. Membutuhkan 001–012.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Authenticator admin utama yang sudah dikenal ──────────────────
-- Hanya id, nama, dan jenisnya; rahasia TOTP tetap hanya di Supabase Auth.
create table if not exists private.owner_factors_seen (
  factor_id uuid primary key,
  friendly_name text,
  factor_type text not null,
  seen_at timestamptz not null default now()
);
alter table private.owner_factors_seen enable row level security;
revoke all on table private.owner_factors_seen from public, anon, authenticated;

-- Hasil: jumlah perubahan (authenticator baru + yang hilang).
create or replace function private.check_owner_factors()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members;
  f record;
  n int := 0;
begin
  select * into m from public.members where is_owner and status = 'aktif';
  if not found or m.auth_user_id is null then
    return 0;
  end if;

  for f in
    select a.id, left(a.friendly_name, 50) as nama, a.factor_type::text as jenis
    from auth.mfa_factors a
    where a.user_id = m.auth_user_id and a.status::text = 'verified'
      and not exists (select 1 from private.owner_factors_seen s where s.factor_id = a.id)
  loop
    insert into private.owner_factors_seen (factor_id, friendly_name, factor_type) values (f.id, f.nama, f.jenis);
    insert into private.auth_events (member_id, event, detail)
    values (m.id, 'verifikasi_dua_langkah', jsonb_build_object('jenis', 'authenticator_baru', 'faktor', f.id, 'nama', f.nama));
    perform private.notify_owner(
      'dua_langkah',
      'Authenticator baru untuk akun admin utama',
      format('Aplikasi authenticator "%s" baru didaftarkan untuk akun admin utama (%s). Kalau ini bukan Anda, segera jalankan prosedur darurat di README.',
             coalesce(f.nama, 'tanpa nama'), private.owner_clock()),
      null, true);
    n := n + 1;
  end loop;

  for f in
    select s.factor_id as id, s.friendly_name as nama
    from private.owner_factors_seen s
    where not exists (
      select 1 from auth.mfa_factors a
      where a.id = s.factor_id and a.user_id = m.auth_user_id and a.status::text = 'verified')
  loop
    delete from private.owner_factors_seen where factor_id = f.id;
    insert into private.auth_events (member_id, event, detail)
    values (m.id, 'verifikasi_dua_langkah', jsonb_build_object('jenis', 'authenticator_dihapus', 'faktor', f.id, 'nama', f.nama));
    perform private.notify_owner(
      'dua_langkah',
      'Authenticator dihapus dari akun admin utama',
      format('Aplikasi authenticator "%s" dihapus dari akun admin utama (%s). Kalau ini bukan Anda, segera jalankan prosedur darurat di README.',
             coalesce(f.nama, 'tanpa nama'), private.owner_clock()),
      null, true);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.check_owner_factors() from public, anon, authenticated;

-- ── Dipanggil aplikasi admin utama ────────────────────────────────
-- Hanya dari perangkat admin utama yang sah (dengan atau tanpa aal2).
-- Hasil: { aal, perubahan }.
create or replace function public.record_second_factor()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  d public.devices;
  aal text := coalesce(auth.jwt() ->> 'aal', '');
begin
  if saya is null or not exists (select 1 from public.members where id = saya and is_owner) then
    perform private.fail('AK002', 'Hanya admin utama yang boleh melakukan ini.');
  end if;
  d := private.current_device();
  if aal = 'aal2' and not exists (
    select 1 from private.auth_events e
    where e.device_id = d.id and e.event = 'verifikasi_dua_langkah' and e.detail ->> 'jenis' = 'terverifikasi') then
    insert into private.auth_events (member_id, device_id, event, device_type, approx_city, approx_country, detail)
    values (saya, d.id, 'verifikasi_dua_langkah', d.device_type, d.approx_city, d.approx_country,
            jsonb_build_object('jenis', 'terverifikasi'));
  end if;
  return jsonb_build_object('aal', aal, 'perubahan', private.check_owner_factors());
end $$;
revoke all on function public.record_second_factor() from public, anon, authenticated;
grant execute on function public.record_second_factor() to authenticated;

-- ── Prosedur darurat (hanya SQL Editor) ───────────────────────────
-- Hasil: beberapa baris (langkah, hasil). Baris terakhir berisi bagian
-- akhir link masuk baru; tempel di belakang alamat situs.
create or replace function private.emergency_reset_owner_2fa(p_konfirmasi text)
returns table (langkah text, hasil text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.members;
  token text := private.random_token();
  n_faktor int;
  n_perangkat int;
  n_sesi int;
begin
  if not private.is_maintenance() then
    perform private.fail('AK028', 'Prosedur darurat hanya bisa dijalankan dari SQL Editor.');
  end if;
  if p_konfirmasi is distinct from 'PULIHKAN' then
    perform private.fail('AK027', 'Ketik PULIHKAN (huruf besar) untuk menjalankan pemulihan darurat.');
  end if;
  select * into m from public.members where is_owner for update;
  if not found or m.auth_user_id is null then
    perform private.fail('AK029', 'Admin utama belum ada atau belum pernah masuk.');
  end if;

  delete from auth.mfa_factors where user_id = m.auth_user_id;
  get diagnostics n_faktor = row_count;
  delete from private.owner_factors_seen where factor_id is not null;

  update public.devices set revoked_at = now(), revoked_by = null
  where member_id = m.id and revoked_at is null;
  get diagnostics n_perangkat = row_count;

  delete from auth.sessions where user_id = m.auth_user_id;
  get diagnostics n_sesi = row_count;

  update private.invites set revoked_at = now()
  where member_id = m.id and used_at is null and revoked_at is null;
  insert into private.invites (member_id, token_hash) values (m.id, private.sha256_hex(token));

  insert into private.auth_events (member_id, event, detail)
  values (m.id, 'verifikasi_dua_langkah', jsonb_build_object(
    'jenis', 'pemulihan_darurat', 'authenticator', n_faktor, 'perangkat', n_perangkat, 'sesi', n_sesi));
  perform private.notify_owner(
    'dua_langkah',
    'Pemulihan darurat verifikasi dua langkah',
    format('Pemulihan darurat dijalankan dari SQL Editor (%s): %s authenticator dihapus dan %s perangkat admin utama dicabut. Daftarkan authenticator baru sekarang di menu Saya.',
           private.owner_clock(), n_faktor, n_perangkat),
    null, true);

  return query values
    ('Authenticator admin utama dihapus', n_faktor::text),
    ('Perangkat admin utama dicabut', n_perangkat::text),
    ('Sesi login admin utama diakhiri', n_sesi::text),
    ('Link masuk baru: alamat situs + bagian ini (sekali pakai, 7 hari, jangan dibagikan)', '#/u/' || token);
end $$;
revoke all on function private.emergency_reset_owner_2fa(text) from public, anon, authenticated;

insert into public.app_migrations (version, name)
values ('013', 'dua_langkah')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Fungsi baru yang bisa dijalankan anon' as pemeriksaan,
       coalesce((select string_agg(p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private')
                   and p.proname in ('record_second_factor', 'check_owner_factors', 'emergency_reset_owner_2fa')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada') as hasil,
       'tidak ada' as harus
union all
select 'Fungsi darurat yang bisa dijalankan pengguna login',
       coalesce((select string_agg(p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'private' and p.proname in ('check_owner_factors', 'emergency_reset_owner_2fa')
                   and has_function_privilege('authenticated', p.oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Fungsi record_second_factor bisa dijalankan pengguna login',
       has_function_privilege('authenticated', 'public.record_second_factor()', 'execute')::text,
       'true'
union all
select 'Daftar authenticator (auth.mfa_factors) bisa dibaca dan dihapus pemilik database',
       (has_table_privilege(current_user, 'auth.mfa_factors', 'select')
        and has_table_privilege(current_user, 'auth.mfa_factors', 'delete'))::text,
       'true'
union all
select 'Sesi login (auth.sessions) bisa diakhiri pemilik database',
       has_table_privilege(current_user, 'auth.sessions', 'delete')::text,
       'true'
union all
select 'Versi database',
       public.db_version(),
       '013 atau lebih';
