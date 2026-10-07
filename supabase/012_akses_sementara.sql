-- 012 — Daftar akses sementara dan mengakhirinya lebih awal.
--
--   list_temp_access()    Admin utama, atau asisten dengan izin akses_sementara,
--                         melihat akses sementara yang sedang berjalan dan kode
--                         yang belum dipakai (tanpa isi kode: hanya hash yang
--                         tersimpan).
--   revoke_temp_access()  Mengakhiri satu akses sementara sebelum waktunya.
--                         Hanya untuk perangkat akses sementara. Admin utama
--                         diberi tahu kalau pelakunya orang lain.
--
-- Kode error: AK026 bukan akses sementara yang sedang berjalan
--
-- Aman dijalankan ulang. Membutuhkan 001–011.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- Hasil: baris untuk setiap akses yang berjalan ('aktif') dan setiap kode
-- yang belum dipakai ('menunggu'), yang paling akhir dibuat di atas.
create or replace function public.list_temp_access()
returns table (
  kind text, id uuid, member_id uuid, display_name text, label text,
  approx_city text, approx_country text, approx_country_name text,
  created_at timestamptz, expires_at timestamptz, access_minutes int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_member_id() is null or not public.has_perm('akses_sementara') then
    perform private.fail('AK016', 'Anda tidak punya izin memberi akses sementara.');
  end if;
  return query
  select 'aktif'::text, d.id, d.member_id, m.display_name, d.label,
         d.approx_city, d.approx_country, d.approx_country_name,
         d.created_at, d.expires_at, null::int
  from public.devices d join public.members m on m.id = d.member_id
  where d.via = 'sementara' and d.revoked_at is null and d.expires_at > now()
  union all
  select 'menunggu'::text, c.id, c.member_id, m.display_name, null::text,
         null::text, null::text, null::text,
         c.created_at, c.expires_at, c.access_minutes
  from private.device_codes c join public.members m on m.id = c.member_id
  where c.kind = 'akses_sementara' and c.used_at is null and c.revoked_at is null and c.expires_at > now()
  order by 9 desc;
end $$;
revoke all on function public.list_temp_access() from public, anon, authenticated;
grant execute on function public.list_temp_access() to authenticated;

create or replace function public.revoke_temp_access(p_device uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  d public.devices;
  m public.members;
begin
  if saya is null or not public.has_perm('akses_sementara') then
    perform private.fail('AK016', 'Anda tidak punya izin memberi akses sementara.');
  end if;
  select * into d from public.devices where id = p_device for update;
  if not found or d.via <> 'sementara' or d.revoked_at is not null or d.expires_at <= now() then
    perform private.fail('AK026', 'Akses sementara ini sudah berakhir atau tidak ditemukan.');
  end if;
  select * into m from public.members where id = d.member_id;
  update public.devices set revoked_at = now(), revoked_by = saya where id = d.id;
  insert into private.auth_events (member_id, device_id, event, detail)
  values (d.member_id, d.id, 'perangkat_dicabut', jsonb_build_object('oleh', saya, 'akses_sementara', true));
  if not public.is_owner() then
    perform private.notify_owner(
      'akses_sementara',
      format('Akses sementara %s diakhiri', m.display_name),
      format('%s mengakhiri lebih awal akses sementara %s.',
             (select display_name from public.members where id = saya), m.display_name),
      null, false);
  end if;
end $$;
revoke all on function public.revoke_temp_access(uuid) from public, anon, authenticated;
grant execute on function public.revoke_temp_access(uuid) to authenticated;

insert into public.app_migrations (version, name)
values ('012', 'akses_sementara')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Fungsi baru yang bisa dijalankan anon' as pemeriksaan,
       coalesce((select string_agg(p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname in ('list_temp_access', 'revoke_temp_access')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada') as hasil,
       'tidak ada' as harus
union all
select 'Fungsi baru yang bisa dijalankan pengguna login (dari 2)',
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('list_temp_access', 'revoke_temp_access')
          and has_function_privilege('authenticated', p.oid, 'execute')),
       '2'
union all
select 'Versi database',
       public.db_version(),
       '012 atau lebih';
