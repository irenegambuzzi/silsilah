-- 007 — Laporan kesalahan, tempat sampah, dan hapus permanen.
--
-- Anggota biasa TIDAK bisa menghapus apa pun; mereka memakai "Laporkan
-- kesalahan". Tempat sampah hanya untuk kesalahan input (data ganda, salah
-- cabang); keturunan yang sah tidak dibuang.
--
--   report_problem()   anggota (bukan "hanya melihat", tidak ditahan)
--                      melaporkan kesalahan; maksimal 10 laporan per jam.
--                      Asisten berizin "tindak_laporan" dan admin utama
--                      diberi tahu.
--   handle_report()    izin "tindak_laporan": proses/selesai/tolak + catatan;
--                      pelapor diberi tahu.
--   move_to_trash()    izin "tempat_sampah" (+ admin utama). Satu kelompok
--                      (delete_batch) per aksi. Ditolak kalau: masih punya
--                      anak aktif, pasangan pangkal, punya pohon keluarga
--                      asal, anggota aplikasi yang aktif, atau hubungan anak
--                      yang satu-satunya menyambungkan orang yang sudah
--                      berkeluarga (pakai "pindahkan ke orang tua lain").
--   restore_batch()    izin "tempat_sampah": memulihkan satu kelompok.
--   purge_batch()      HANYA admin utama (aal2), wajib mengetik "HAPUS".
--   empty_trash()      HANYA admin utama (aal2), wajib mengetik "HAPUS".
--                      Keduanya memanggil before_big_action() lebih dulu
--                      (snapshot otomatis, aktif mulai 008). Kalau satu
--                      bagian tidak bisa dihapus, TIDAK ADA yang dihapus.
--                      Isi lama tetap tercatat di riwayat.
--   Pohon keluarga asal: semua aksi di atas hanya admin utama.
--   "Pindahkan ke orang tua lain": ubah union_id hubungan anak (edit biasa,
--   sudah bisa sejak 005, tercatat dan bisa di-Undo).
--
-- Kode error: TR001 tanpa izin tempat sampah · TR002 masih punya anak ·
-- TR003 punya pohon keluarga asal · TR004 pasangan pangkal · TR005 anggota
-- aplikasi · TR006 tidak ditemukan/sudah di sampah · TR007 masih dipakai
-- data lain · TR008 hanya admin utama · TR009 konfirmasi "HAPUS" ·
-- TR010 hubungan satu-satunya · TR011 kelompok tidak ditemukan ·
-- TR012 pohon keluarga asal hanya admin utama · RP001 tidak bisa melapor ·
-- RP002 yang dilaporkan tidak ditemukan · RP003 terlalu banyak laporan ·
-- RP004 tanpa izin tindak laporan
--
-- Aman dijalankan ulang. Membutuhkan 001–006.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Titik kait sebelum aksi besar ─────────────────────────────────
-- Dipanggil sebelum hapus permanen (dan nanti impor/pemulihan). 008
-- menggantinya dengan pembuatan snapshot. Dibuat hanya kalau belum ada,
-- supaya menjalankan ulang file ini tidak menimpa versi 008.
do $$
begin
  if to_regprocedure('private.before_big_action(text, jsonb)') is null then
    create function private.before_big_action(jenis text, keterangan jsonb)
      returns void language sql security definer set search_path = ''
      as 'select null::void';
  end if;
end $$;
revoke all on function private.before_big_action(text, jsonb) from public, anon, authenticated;

-- ── Laporan kesalahan ─────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('people', 'unions', 'children')),
  target_id uuid not null,
  -- Pohon tempat data yang dilaporkan (null = silsilah utama).
  tree_id uuid references public.origin_trees (id) on delete cascade,
  reason text not null check (reason in ('data_salah', 'data_ganda', 'salah_cabang', 'lainnya')),
  message text check (length(message) <= 2000),
  reporter uuid references public.members (id) on delete set null,
  status text not null default 'baru' check (status in ('baru', 'diproses', 'selesai', 'ditolak')),
  handled_by uuid references public.members (id) on delete set null,
  handled_note text check (length(handled_note) <= 2000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at);
create index if not exists reports_reporter_idx on public.reports (reporter, created_at);

alter table public.reports enable row level security;
drop policy if exists baca on public.reports;
create policy baca on public.reports for select to authenticated using (
  reporter = (select public.current_member_id())
  or ((select public.has_perm('tindak_laporan'))
      and (tree_id is null or tree_id in (select public.viewable_origin_trees()))));
revoke all on table public.reports from public, anon, authenticated;
grant select on table public.reports to authenticated;

create or replace function public.report_problem(p_table text, p_id uuid, p_reason text, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  pohon uuid;
  ada boolean;
  baru uuid;
  m record;
begin
  if saya is null or not public.can_edit() then
    perform private.fail('RP001', 'Anda tidak bisa mengirim laporan (hanya melihat, atau sedang ditahan).');
  end if;
  if p_table not in ('people', 'unions', 'children') then
    perform private.fail('RP002', 'Data yang dilaporkan tidak ditemukan.');
  end if;
  execute format('select true, tree_id from public.%I where id = $1', p_table) into ada, pohon using p_id;
  if ada is null or (pohon is not null and pohon not in (select public.viewable_origin_trees())) then
    perform private.fail('RP002', 'Data yang dilaporkan tidak ditemukan.');
  end if;
  if (select count(*) from public.reports where reporter = saya and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('RP003', 'Anda sudah mengirim banyak laporan dalam satu jam terakhir. Silakan coba lagi nanti.');
  end if;

  insert into public.reports (target_table, target_id, tree_id, reason, message, reporter)
  values (p_table, p_id, pohon, p_reason, nullif(btrim(p_message), ''), saya)
  returning id into baru;

  -- Beri tahu yang bisa menindaklanjuti (untuk pohon asal: admin utama saja).
  for m in
    select id from public.members
    where status = 'aktif' and id <> saya
      and (is_owner or (pohon is null and role = 'asisten' and 'tindak_laporan' = any (permissions)))
  loop
    insert into public.notifications (member_id, kind, title, body, link)
    values (m.id, 'laporan_baru', 'Ada laporan kesalahan baru',
            'Seorang anggota melaporkan kesalahan data. Buka daftar laporan untuk menindaklanjuti.',
            '#/laporan');
  end loop;
  return baru;
end $$;
revoke all on function public.report_problem(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_problem(text, uuid, text, text) to authenticated;

create or replace function public.handle_report(p_report uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  select * into r from public.reports where id = p_report;
  if not found or not public.has_perm('tindak_laporan')
     or (r.tree_id is not null and not public.is_owner()) then
    perform private.fail('RP004', 'Anda tidak punya izin untuk menindaklanjuti laporan ini.');
  end if;
  if p_status not in ('diproses', 'selesai', 'ditolak') then
    perform private.fail('RP004', 'Status laporan tidak dikenal.');
  end if;
  update public.reports
  set status = p_status, handled_by = public.current_member_id(),
      handled_note = nullif(btrim(p_note), ''), handled_at = now()
  where id = p_report;
  if p_status in ('selesai', 'ditolak') and r.reporter is not null then
    insert into public.notifications (member_id, kind, title, body, link)
    values (r.reporter, 'laporan_ditanggapi',
            case p_status when 'selesai' then 'Laporan Anda sudah ditindaklanjuti' else 'Laporan Anda tidak diproses' end,
            nullif(btrim(p_note), ''), '#/laporan');
  end if;
end $$;
revoke all on function public.handle_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.handle_report(uuid, text, text) to authenticated;

-- ── Tempat sampah ─────────────────────────────────────────────────
-- Izin untuk aksi tempat sampah pada data di pohon tertentu.
create or replace function private.require_trash_right(pohon uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if pohon is not null then
    if not public.is_owner() then
      perform private.fail('TR012', 'Data pohon keluarga asal hanya bisa diatur admin utama.');
    end if;
  elsif not (public.has_perm('tempat_sampah') and public.can_edit()) then
    perform private.fail('TR001', 'Anda tidak punya izin tempat sampah.');
  end if;
end $$;
revoke all on function private.require_trash_right(uuid) from public, anon, authenticated;

create or replace function public.move_to_trash(p_table text, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  b uuid := gen_random_uuid();
  o public.people;
  u public.unions;
  c public.children;
  akar public.unions;
begin
  select un.* into akar from public.settings s join public.unions un on un.id = s.root_union_id where s.id;

  if p_table = 'people' then
    select * into o from public.people where id = p_id and deleted_at is null;
    if not found then
      perform private.fail('TR006', 'Data tidak ditemukan atau sudah di tempat sampah.');
    end if;
    perform private.require_trash_right(o.tree_id);
    if p_id in (akar.partner1_id, akar.partner2_id) then
      perform private.fail('TR004', 'Pasangan pangkal tidak bisa dibuang.');
    end if;
    if exists (select 1 from public.origin_trees where anchor_person_id = p_id) then
      perform private.fail('TR003', 'Orang ini punya pohon keluarga asal. Admin utama perlu mengurus pohon itu dulu.');
    end if;
    if exists (select 1 from public.members where person_id = p_id and status = 'aktif') then
      perform private.fail('TR005', 'Orang ini anggota aplikasi. Admin utama perlu mencabut aksesnya dulu.');
    end if;
    if exists (
      select 1 from public.children ch join public.unions un on un.id = ch.union_id
      where p_id in (un.partner1_id, un.partner2_id) and ch.deleted_at is null and un.deleted_at is null) then
      perform private.fail('TR002', 'Orang ini masih punya anak yang aktif. Pindahkan atau buang anak-anaknya dulu.');
    end if;
    -- Urutan: pernikahan → hubungan sebagai anak → orang. (Undo dan
    -- pemulihan berjalan terbalik.)
    update public.unions set deleted_at = now(), deleted_by = saya, delete_batch = b
    where p_id in (partner1_id, partner2_id) and deleted_at is null;
    update public.children set deleted_at = now(), deleted_by = saya, delete_batch = b
    where child_id = p_id and deleted_at is null;
    update public.people set deleted_at = now(), deleted_by = saya, delete_batch = b where id = p_id;

  elsif p_table = 'unions' then
    select * into u from public.unions where id = p_id and deleted_at is null;
    if not found then
      perform private.fail('TR006', 'Data tidak ditemukan atau sudah di tempat sampah.');
    end if;
    perform private.require_trash_right(u.tree_id);
    if p_id = akar.id then
      perform private.fail('TR004', 'Pernikahan pasangan pangkal tidak bisa dibuang.');
    end if;
    if exists (select 1 from public.children where union_id = p_id and deleted_at is null) then
      perform private.fail('TR002', 'Pernikahan ini masih punya anak yang aktif. Pindahkan atau buang anak-anaknya dulu.');
    end if;
    update public.unions set deleted_at = now(), deleted_by = saya, delete_batch = b where id = p_id;

  elsif p_table = 'children' then
    select * into c from public.children where id = p_id and deleted_at is null;
    if not found then
      perform private.fail('TR006', 'Data tidak ditemukan atau sudah di tempat sampah.');
    end if;
    perform private.require_trash_right(c.tree_id);
    if not exists (select 1 from public.children where child_id = c.child_id and id <> p_id and deleted_at is null)
       and exists (select 1 from public.unions
                   where c.child_id in (partner1_id, partner2_id) and deleted_at is null) then
      perform private.fail('TR010',
        'Hubungan ini satu-satunya yang menyambungkan orang ini ke silsilah, dan ia sudah berkeluarga. Gunakan "pindahkan ke orang tua lain".');
    end if;
    update public.children set deleted_at = now(), deleted_by = saya, delete_batch = b where id = p_id;

  else
    perform private.fail('TR006', 'Data tidak ditemukan atau sudah di tempat sampah.');
  end if;
  return b;
end $$;
revoke all on function public.move_to_trash(text, uuid) from public, anon, authenticated;
grant execute on function public.move_to_trash(text, uuid) to authenticated;

-- Pohon kelompok sampah: null kalau semuanya di silsilah utama.
create or replace function private.batch_tree(b uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select max(tree_id::text)::uuid from (
    select tree_id from public.people where delete_batch = b
    union all select tree_id from public.unions where delete_batch = b
    union all select tree_id from public.children where delete_batch = b) x
$$;
revoke all on function private.batch_tree(uuid) from public, anon, authenticated;

create or replace function private.batch_exists(b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.people where delete_batch = b)
      or exists (select 1 from public.unions where delete_batch = b)
      or exists (select 1 from public.children where delete_batch = b)
$$;
revoke all on function private.batch_exists(uuid) from public, anon, authenticated;

create or replace function public.restore_batch(p_batch uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch is null or not private.batch_exists(p_batch) then
    perform private.fail('TR011', 'Kelompok data ini tidak ada di tempat sampah.');
  end if;
  perform private.require_trash_right(private.batch_tree(p_batch));
  -- Kebalikan urutan membuang: orang → hubungan sebagai anak → pernikahan.
  update public.people set deleted_at = null, deleted_by = null, delete_batch = null where delete_batch = p_batch;
  update public.children set deleted_at = null, deleted_by = null, delete_batch = null where delete_batch = p_batch;
  update public.unions set deleted_at = null, deleted_by = null, delete_batch = null where delete_batch = p_batch;
end $$;
revoke all on function public.restore_batch(uuid) from public, anon, authenticated;
grant execute on function public.restore_batch(uuid) to authenticated;

-- ── Hapus permanen ────────────────────────────────────────────────
-- Inti penghapusan satu kelompok (tanpa pemeriksaan hak/konfirmasi).
create or replace function private.purge_batch_rows(b uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  k int;
  akar uuid;
begin
  select root_union_id into akar from public.settings where id;
  -- Orang/pernikahan di kelompok ini tidak boleh masih dipakai data lain.
  if exists (select 1 from public.members m join public.people p on p.id = m.person_id where p.delete_batch = b) then
    perform private.fail('TR005', 'Orang di kelompok ini adalah anggota aplikasi, jadi tidak bisa dihapus permanen.');
  end if;
  if exists (select 1 from public.origin_trees t join public.people p on p.id = t.anchor_person_id where p.delete_batch = b) then
    perform private.fail('TR003', 'Orang di kelompok ini punya pohon keluarga asal.');
  end if;
  if exists (select 1 from public.unions where delete_batch = b and id = akar) then
    perform private.fail('TR004', 'Pernikahan pasangan pangkal tidak bisa dihapus.');
  end if;
  if exists (
       select 1 from public.children ch join public.people p on p.id = ch.child_id
       where p.delete_batch = b and ch.delete_batch is distinct from b)
     or exists (
       select 1 from public.unions un join public.people p on p.id in (un.partner1_id, un.partner2_id)
       where p.delete_batch = b and un.delete_batch is distinct from b)
     or exists (
       select 1 from public.children ch join public.unions un on un.id = ch.union_id
       where un.delete_batch = b and ch.delete_batch is distinct from b) then
    perform private.fail('TR007',
      'Data di kelompok ini masih dipakai data lain. Hapus permanen kelompok yang terkait lebih dulu, atau sekaligus.');
  end if;

  delete from public.children where delete_batch = b;
  get diagnostics k = row_count; n := n + k;
  delete from public.unions where delete_batch = b;
  get diagnostics k = row_count; n := n + k;
  delete from public.birth_ranks where parent_id in (select id from public.people where delete_batch = b)
                                    or child_id in (select id from public.people where delete_batch = b);
  delete from public.people where delete_batch = b;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function private.purge_batch_rows(uuid) from public, anon, authenticated;

create or replace function private.require_purge(konfirmasi text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    perform private.fail('TR008', 'Hanya admin utama (dengan verifikasi dua langkah) yang bisa menghapus permanen.');
  end if;
  if konfirmasi is distinct from 'HAPUS' then
    perform private.fail('TR009', 'Ketik HAPUS (huruf besar) untuk memastikan penghapusan permanen.');
  end if;
end $$;
revoke all on function private.require_purge(text) from public, anon, authenticated;

create or replace function public.purge_batch(p_batch uuid, p_konfirmasi text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_purge(p_konfirmasi);
  if p_batch is null or not private.batch_exists(p_batch) then
    perform private.fail('TR011', 'Kelompok data ini tidak ada di tempat sampah.');
  end if;
  perform private.before_big_action('sebelum_hapus_permanen', jsonb_build_object('delete_batch', p_batch));
  return private.purge_batch_rows(p_batch);
end $$;
revoke all on function public.purge_batch(uuid, text) from public, anon, authenticated;
grant execute on function public.purge_batch(uuid, text) to authenticated;

-- Mengosongkan tempat sampah: semua kelompok, dari yang paling lama.
-- Kalau satu kelompok tidak bisa dihapus, TIDAK ADA yang dihapus.
create or replace function public.empty_trash(p_konfirmasi text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  b uuid;
  n int := 0;
begin
  perform private.require_purge(p_konfirmasi);
  perform private.before_big_action('sebelum_hapus_permanen', jsonb_build_object('semua', true));
  for b in
    select delete_batch from (
      select delete_batch, deleted_at from public.people where delete_batch is not null
      union all select delete_batch, deleted_at from public.unions where delete_batch is not null
      union all select delete_batch, deleted_at from public.children where delete_batch is not null) x
    group by delete_batch order by min(deleted_at)
  loop
    -- Kelompok bisa sudah ikut terhapus? Tidak: setiap kelompok berdiri sendiri.
    n := n + private.purge_batch_rows(b);
  end loop;
  return n;
end $$;
revoke all on function public.empty_trash(text) from public, anon, authenticated;
grant execute on function public.empty_trash(text) to authenticated;

insert into public.app_migrations (version, name)
values ('007', 'tempat_sampah_laporan')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Fungsi tempat sampah/laporan yang ada (dari 7)' as pemeriksaan,
       (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('report_problem', 'handle_report', 'move_to_trash',
              'restore_batch', 'purge_batch', 'empty_trash', 'release_hold')) as hasil,
       '7' as harus
union all
select 'Titik kait sebelum aksi besar ada',
       (to_regprocedure('private.before_big_action(text, jsonb)') is not null)::text,
       'true'
union all
select 'Laporan bisa ditulis langsung oleh aplikasi',
       (has_table_privilege('authenticated', 'public.reports', 'insert')
        or has_table_privilege('authenticated', 'public.reports', 'update')
        or has_table_privilege('authenticated', 'public.reports', 'delete'))::text,
       'false'
union all
select 'Tabel di public/private TANPA RLS',
       coalesce((select string_agg(n.nspname || '.' || c.relname, ', ')
                 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relrowsecurity),
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
select 'Versi database',
       public.db_version(),
       '007 atau lebih';
