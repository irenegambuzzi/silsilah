-- 008 — Salinan otomatis (snapshot) di dalam database.
--
--   private.snapshots   salinan JSON semua tabel data, dikompresi.
--
--   Salinan harian (daily_snapshot, dijadwalkan 02.00 WIB di jadwal.sql):
--     HANYA dibuat kalau isinya berbeda dari salinan harian terakhir
--     (dibandingkan lewat checksum isi, jadi perubahan yang tidak tercatat
--     di riwayat, misalnya anggota baru, juga terhitung).
--   Salinan khusus SEBELUM aksi besar (before_big_action): hapus
--     permanen, migrasi, impor, pemulihan. Selalu dibuat.
--
--   Perapian otomatis (prune_snapshots, setiap hari setelah salinan harian),
--   menurut kalender WIB:
--     harian    maksimal satu per hari (yang terakhir); 30 hari terakhir
--               YANG ADA PERUBAHANNYA selalu disimpan;
--     mingguan  yang terakhir di setiap minggu (Senin–Minggu), untuk minggu
--               ini dan 11 minggu sebelumnya (12 minggu);
--     bulanan   yang terakhir di setiap bulan, untuk bulan ini dan 11 bulan
--               sebelumnya (12 bulan);
--     khusus    disimpan 12 bulan; "sebelum_migrasi" disimpan selamanya.
--   Salinan harian lain dihapus.
--
--   Isi salinan: semua tabel di snapshot_tables() (silsilah, pohon asal dan
--   izinnya, pengaturan, anggota, laporan). TIDAK termasuk: riwayat
--   (change_log, sudah merupakan riwayat), perangkat, undangan, kode,
--   log login dan IP, kotak masuk. Fitur berikutnya menambah tabelnya
--   lewat snapshot_tables().
--
--   list_snapshots()   daftar salinan (tanpa isinya) untuk admin utama.
--
-- Aman dijalankan ulang. Membutuhkan 001–007.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run, lalu
-- jalankan jadwal.sql lagi.

begin;

create table if not exists private.snapshots (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  kind text not null check (kind in ('harian', 'sebelum_hapus_permanen', 'sebelum_migrasi',
                                     'sebelum_impor', 'sebelum_pemulihan')),
  taken_by uuid references public.members (id) on delete set null,
  -- Keterangan aksi besar, misalnya {"delete_batch": "…"}.
  detail jsonb not null default '{}',
  -- id riwayat terakhir saat salinan dibuat (untuk informasi).
  last_change_id bigint not null default 0,
  checksum text not null,
  counts jsonb not null,
  data jsonb not null
);
create index if not exists snapshots_kind_taken_idx on private.snapshots (kind, taken_at desc);
alter table private.snapshots enable row level security;
revoke all on table private.snapshots from public, anon, authenticated;

-- Kompresi lz4 untuk isi salinan (lebih cepat dan biasanya lebih kecil).
-- Kalau server tidak mendukungnya, kompresi bawaan Postgres tetap dipakai.
do $$
begin
  alter table private.snapshots alter column data set compression lz4;
exception when others then
  null;
end $$;

-- Tabel yang ikut disalin. Fitur berikutnya mengganti fungsi ini untuk
-- menambah tabelnya sendiri.
create or replace function private.snapshot_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['people', 'unions', 'children', 'birth_ranks', 'origin_trees',
               'origin_tree_access', 'settings', 'members', 'reports']
$$;
revoke all on function private.snapshot_tables() from public, anon, authenticated;

-- Isi salinan saat ini: {"people": [...], "unions": [...], ...}
-- Urutan baris tetap (menurut isi JSON-nya), supaya checksum stabil.
create or replace function private.snapshot_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text;
  isi jsonb := '{}';
  baris_tabel jsonb;
begin
  foreach t in array private.snapshot_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]'') from public.%I x', t)
      into baris_tabel;
    isi := isi || jsonb_build_object(t, baris_tabel);
  end loop;
  return isi;
end $$;
revoke all on function private.snapshot_data() from public, anon, authenticated;

create or replace function private.take_snapshot(jenis text, keterangan jsonb default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  isi jsonb := private.snapshot_data();
  jumlah jsonb;
  baru bigint;
begin
  select coalesce(jsonb_object_agg(k, jsonb_array_length(v)), '{}') into jumlah from jsonb_each(isi) as e(k, v);
  insert into private.snapshots (kind, taken_by, detail, last_change_id, checksum, counts, data)
  values (jenis, public.current_member_id(), coalesce(keterangan, '{}'),
          coalesce((select max(id) from public.change_log), 0),
          md5(isi::text), jumlah, isi)
  returning id into baru;
  return baru;
end $$;
revoke all on function private.take_snapshot(text, jsonb) from public, anon, authenticated;

-- Menggantikan titik kait kosong dari 007: sebelum aksi besar, selalu
-- buat salinan khusus.
create or replace function private.before_big_action(jenis text, keterangan jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.take_snapshot(jenis, keterangan);
end $$;
revoke all on function private.before_big_action(text, jsonb) from public, anon, authenticated;

-- Merapikan salinan (lihat aturan di kepala file). Hasil: jumlah yang dihapus.
-- p_now bisa diisi untuk pengujian.
create or replace function private.prune_snapshots(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with
    sekarang as (select (p_now at time zone 'Asia/Jakarta') as lokal),
    per_hari as (
      select distinct on ((taken_at at time zone 'Asia/Jakarta')::date)
             id, (taken_at at time zone 'Asia/Jakarta') as lokal
      from private.snapshots
      where kind = 'harian'
      order by (taken_at at time zone 'Asia/Jakarta')::date, taken_at desc, id desc
    ),
    terbaru as (
      select id from per_hari order by lokal desc limit 30
    ),
    mingguan as (
      select distinct on (date_trunc('week', r.lokal)) r.id
      from per_hari r, sekarang s
      where date_trunc('week', r.lokal) > date_trunc('week', s.lokal) - interval '12 weeks'
      order by date_trunc('week', r.lokal), r.lokal desc
    ),
    bulanan as (
      select distinct on (date_trunc('month', r.lokal)) r.id
      from per_hari r, sekarang s
      where date_trunc('month', r.lokal) > date_trunc('month', s.lokal) - interval '12 months'
      order by date_trunc('month', r.lokal), r.lokal desc
    ),
    simpan as (
      select id from terbaru union select id from mingguan union select id from bulanan
    )
  delete from private.snapshots x
  where (x.kind = 'harian' and x.id not in (select id from simpan))
     or (x.kind not in ('harian', 'sebelum_migrasi') and x.taken_at < p_now - interval '12 months');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.prune_snapshots(timestamptz) from public, anon, authenticated;

-- Dijalankan setiap hari oleh pg_cron. Hasil: 'dibuat' atau
-- 'tidak ada perubahan' (+ jumlah salinan yang dirapikan).
create or replace function private.daily_snapshot()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  terakhir text;
  hasil text;
  dirapikan int;
begin
  select checksum into terakhir from private.snapshots
  where kind = 'harian' order by taken_at desc, id desc limit 1;
  if terakhir is not distinct from md5(private.snapshot_data()::text) then
    hasil := 'tidak ada perubahan';
  else
    perform private.take_snapshot('harian');
    hasil := 'dibuat';
  end if;
  dirapikan := private.prune_snapshots();
  return hasil || case when dirapikan > 0 then format(', %s salinan lama dirapikan', dirapikan) else '' end;
end $$;
revoke all on function private.daily_snapshot() from public, anon, authenticated;

-- Daftar salinan untuk layar admin (tanpa isinya).
create or replace function public.list_snapshots()
returns table (id bigint, taken_at timestamptz, kind text, counts jsonb, size_bytes int, detail jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    perform private.fail('AK002', 'Hanya admin utama yang bisa melihat daftar salinan.');
  end if;
  return query
    select s.id, s.taken_at, s.kind, s.counts, pg_column_size(s.data), s.detail
    from private.snapshots s order by s.taken_at desc, s.id desc;
end $$;
revoke all on function public.list_snapshots() from public, anon, authenticated;
grant execute on function public.list_snapshots() to authenticated;

insert into public.app_migrations (version, name)
values ('008', 'salinan')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Tabel salinan ada dan memakai RLS' as pemeriksaan,
       (select relrowsecurity::text from pg_class where oid = to_regclass('private.snapshots')) as hasil,
       'true' as harus
union all
select 'Salinan bisa disentuh anon/authenticated',
       (has_table_privilege('anon', 'private.snapshots', 'select')
        or has_table_privilege('authenticated', 'private.snapshots', 'select'))::text,
       'false'
union all
select 'Titik kait sebelum aksi besar membuat salinan',
       (pg_get_functiondef('private.before_big_action(text, jsonb)'::regprocedure) like '%take_snapshot%')::text,
       'true'
union all
select 'Tabel yang disalin (dari 9)',
       array_length(private.snapshot_tables(), 1)::text,
       '9'
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
       '008 atau lebih';
