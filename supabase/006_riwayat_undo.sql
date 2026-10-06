-- 006 — Riwayat perubahan, Undo, kotak masuk, dan deteksi aktivitas
-- tidak wajar.
--
--   change_log     satu baris per perubahan (siapa, apa, kapan, isi lama
--                  dan baru). Diisi trigger; tidak bisa ditulis, diubah,
--                  atau dihapus lewat aplikasi. Perubahan dalam satu
--                  permintaan berbagi satu batch_id (misalnya "tambah anak"
--                  = orang + hubungan + urutan lahir otomatis).
--                  Bisa dibaca anggota/asisten/admin utama (bukan "hanya
--                  melihat"); riwayat pohon keluarga asal hanya untuk yang
--                  boleh melihat pohon itu; riwayat izin pohon asal hanya
--                  admin utama.
--   undo_batch()   membatalkan satu batch. Ditolak kalau: bukan milik
--                  sendiri (tanpa izin "batalkan_orang_lain"), data sudah
--                  diubah lagi sesudahnya, sudah dibatalkan, hapus
--                  permanen, atau tidak punya hak atas data itu. Undo juga
--                  tercatat, sehingga bisa dibatalkan lagi (redo).
--   notifications  kotak masuk per anggota (dipakai juga oleh fitur lain).
--   Aktivitas tidak wajar: lebih dari settings.anomaly_max_changes
--                  perubahan dalam settings.anomaly_window_minutes menit
--                  (bawaan 30 dalam 10) → anggota DITAHAN (hanya bisa
--                  membaca) dan admin utama diberi tahu. Admin utama tidak
--                  pernah ditahan. release_hold() melepas (admin utama).
--
-- Kode error: UN001 tidak ditemukan · UN002 sudah dibatalkan · UN003 sudah
-- diubah lagi · UN004 hapus permanen · UN005 tidak bisa dibatalkan di sini
-- · UN006 bukan perubahan sendiri · UN007 tidak punya hak atas data ini
-- · UN008 tidak bisa mengedit (hanya melihat / ditahan)
--
-- Aman dijalankan ulang. Membutuhkan 001–005.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Kotak masuk ───────────────────────────────────────────────────
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (length(kind) between 1 and 50),
  title text not null check (length(title) between 1 and 200),
  body text check (length(body) <= 2000),
  link text check (length(link) <= 500),
  priority text not null default 'biasa' check (priority in ('biasa', 'penting')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_member_idx on public.notifications (member_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists baca_sendiri on public.notifications;
create policy baca_sendiri on public.notifications for select to authenticated
  using (member_id = (select public.current_member_id()));
drop policy if exists tandai_dibaca on public.notifications;
create policy tandai_dibaca on public.notifications for update to authenticated
  using (member_id = (select public.current_member_id()))
  with check (member_id = (select public.current_member_id()));
revoke all on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Mengirim satu pesan ke kotak masuk admin utama (kalau sudah ada).
create or replace function private.notify_owner(
  jenis text, judul text, isi text default null, tautan text default null, penting boolean default true
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (member_id, kind, title, body, link, priority)
  select m.id, jenis, judul, isi, tautan, case when penting then 'penting' else 'biasa' end
  from public.members m
  where m.is_owner and m.status = 'aktif'
$$;
revoke all on function private.notify_owner(text, text, text, text, boolean) from public, anon, authenticated;

-- ── Riwayat perubahan ─────────────────────────────────────────────
create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_member_id uuid references public.members (id) on delete set null,
  table_name text not null,
  -- Kunci baris, misalnya {"id": "…"} atau {"parent_id": "…", "child_id": "…"}.
  row_key jsonb not null,
  -- Pohon tempat data ini berada (null = silsilah utama / pengaturan).
  tree_id uuid,
  op text not null check (op in ('tambah', 'ubah', 'hapus', 'pulihkan', 'hapus_permanen')),
  old_row jsonb,
  new_row jsonb,
  changed_fields text[] not null default '{}',
  batch_id uuid not null,
  -- true = akibat otomatis dari perubahan lain (misalnya urutan lahir yang
  -- bergeser saat anak ditambahkan). Tidak dibatalkan sendiri-sendiri.
  automatic boolean not null default false,
  -- Terisi kalau perubahan ini adalah pembatalan (undo) batch lain.
  undo_of_batch uuid
);
create index if not exists change_log_batch_idx on public.change_log (batch_id);
create index if not exists change_log_row_idx on public.change_log (table_name, row_key);
create index if not exists change_log_actor_idx on public.change_log (actor_member_id, at);
create index if not exists change_log_undo_idx on public.change_log (undo_of_batch);

-- Kolom yang bukan "isi" data (tidak dibandingkan, tidak dibatalkan).
create or replace function private.meta_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['version', 'created_at', 'created_by', 'updated_at', 'updated_by'] $$;
revoke all on function private.meta_columns() from public, anon, authenticated;

-- Batch untuk transaksi ini (satu permintaan aplikasi = satu batch).
create or replace function private.current_batch()
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  b uuid := nullif(current_setting('silsilah.batch_id', true), '')::uuid;
begin
  if b is null then
    b := gen_random_uuid();
    perform set_config('silsilah.batch_id', b::text, true);
  end if;
  return b;
end $$;
revoke all on function private.current_batch() from public, anon, authenticated;

-- Penahanan otomatis kalau seorang anggota membuat terlalu banyak
-- perubahan dalam waktu singkat.
create or replace function private.check_anomaly(pelaku uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  batas int;
  jendela int;
  jumlah int;
  m public.members;
begin
  if pelaku is null then
    return;
  end if;
  select * into m from public.members where id = pelaku;
  if m.is_owner or (m.hold_until is not null and m.hold_until > now()) then
    return;
  end if;
  select anomaly_max_changes, anomaly_window_minutes into batas, jendela from public.settings where id;
  select count(*) into jumlah
  from public.change_log
  where actor_member_id = pelaku and not automatic
    and at > now() - make_interval(mins => jendela);
  if jumlah > batas then
    update public.members
    set hold_until = 'infinity',
        hold_reason = format('Otomatis: lebih dari %s perubahan dalam %s menit.', batas, jendela)
    where id = pelaku;
    perform private.notify_owner(
      'aktivitas_tidak_wajar',
      format('%s ditahan sementara', m.display_name),
      format('%s membuat lebih dari %s perubahan dalam %s menit. Ia sekarang hanya bisa membaca sampai Anda meninjaunya.',
             m.display_name, batas, jendela),
      '#/admin/keamanan');
  end if;
end $$;
revoke all on function private.check_anomaly(uuid) from public, anon, authenticated;

create or replace function private.trg_change_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lama jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  baru jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  baris jsonb := coalesce(baru, lama);
  kunci jsonb;
  pohon uuid;
  operasi text;
  berubah text[] := '{}';
  pelaku uuid := private.actor_member_id();
  otomatis boolean := pg_trigger_depth() > 1;
begin
  kunci := case tg_table_name
    when 'birth_ranks' then jsonb_build_object('parent_id', baris -> 'parent_id', 'child_id', baris -> 'child_id')
    when 'origin_tree_access' then jsonb_build_object('tree_id', baris -> 'tree_id', 'member_id', baris -> 'member_id')
    else jsonb_build_object('id', baris -> 'id')
  end;
  pohon := case tg_table_name
    when 'origin_trees' then (baris ->> 'id')::uuid
    when 'settings' then null
    else (baris ->> 'tree_id')::uuid
  end;

  if tg_op = 'INSERT' then
    operasi := 'tambah';
  elsif tg_op = 'DELETE' then
    operasi := 'hapus_permanen';
  else
    select coalesce(array_agg(k order by k), '{}') into berubah
    from jsonb_object_keys(baru) k
    where k <> all (private.meta_columns()) and (baru -> k) is distinct from (lama -> k);
    if berubah = '{}' then
      return null;
    end if;
    operasi := case
      when lama ->> 'deleted_at' is null and baru ->> 'deleted_at' is not null then 'hapus'
      when lama ->> 'deleted_at' is not null and baru ->> 'deleted_at' is null then 'pulihkan'
      else 'ubah'
    end;
  end if;

  insert into public.change_log (actor_member_id, table_name, row_key, tree_id, op, old_row, new_row,
                                 changed_fields, batch_id, automatic, undo_of_batch)
  values (pelaku, tg_table_name, kunci, pohon, operasi, lama, baru, berubah,
          private.current_batch(), otomatis,
          nullif(current_setting('silsilah.undo_of_batch', true), '')::uuid);

  if not otomatis then
    perform private.check_anomaly(pelaku);
  end if;
  return null;
end $$;
revoke all on function private.trg_change_log() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['people', 'unions', 'children', 'birth_ranks', 'origin_trees',
                           'origin_tree_access', 'settings'] loop
    execute format('drop trigger if exists zz_log on public.%I', t);
    execute format('create trigger zz_log after insert or update or delete on public.%I
                    for each row execute function private.trg_change_log()', t);
  end loop;
end $$;

-- Siapa yang boleh melihat riwayat: anggota, asisten, dan admin utama
-- (bukan "hanya melihat"). Anggota yang ditahan tetap boleh melihat.
create or replace function public.can_view_history()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select m.is_owner or m.role in ('anggota', 'asisten')
    from public.members m where m.id = public.current_member_id()
  ), false)
$$;
revoke all on function public.can_view_history() from public, anon, authenticated;
grant execute on function public.can_view_history() to authenticated;

alter table public.change_log enable row level security;
drop policy if exists baca on public.change_log;
create policy baca on public.change_log for select to authenticated using (
  (select public.can_view_history())
  and (tree_id is null or tree_id in (select public.viewable_origin_trees()))
  and (table_name <> 'origin_tree_access' or (select public.is_owner())));
revoke all on table public.change_log from public, anon, authenticated;
grant select on table public.change_log to authenticated;

-- ── Undo ──────────────────────────────────────────────────────────
-- Syarat WHERE untuk menemukan baris dari row_key (alias tabel "t",
-- record kunci "r").
create or replace function private.key_predicate(kunci jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(format('t.%I = r.%I', k, k), ' and ' order by k)
  from jsonb_object_keys(kunci) k
$$;
revoke all on function private.key_predicate(jsonb) from public, anon, authenticated;

create or replace function public.undo_batch(p_batch uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saya uuid := public.current_member_id();
  e public.change_log;
  sekarang jsonb;
  kolom text[];
  pembanding text[];
  terakhir record;
  batch_sampah uuid := gen_random_uuid();
  batch_baru uuid;
begin
  if saya is null or not public.can_edit() then
    perform private.fail('UN008', 'Anda tidak bisa membatalkan perubahan (hanya melihat, atau sedang ditahan).');
  end if;
  if not exists (select 1 from public.change_log where batch_id = p_batch and not automatic) then
    perform private.fail('UN001', 'Perubahan ini tidak ditemukan.');
  end if;
  -- Sudah dibatalkan (dan pembatalannya belum dibatalkan lagi)?
  if exists (
    select 1 from public.change_log u
    where u.undo_of_batch = p_batch
      and not exists (select 1 from public.change_log r where r.undo_of_batch = u.batch_id)) then
    perform private.fail('UN002', 'Perubahan ini sudah dibatalkan.');
  end if;

  -- Pemeriksaan hak dan bentrok untuk SEMUA baris dulu, sebelum mengubah apa pun.
  for e in
    select * from public.change_log where batch_id = p_batch and not automatic order by id desc
  loop
    if e.op = 'hapus_permanen' then
      perform private.fail('UN004', 'Hapus permanen tidak bisa dibatalkan. Data hanya bisa dipulihkan dari cadangan oleh admin utama.');
    end if;
    if e.table_name = 'origin_trees' and e.op = 'tambah' then
      perform private.fail('UN005', 'Pembuatan pohon keluarga asal tidak bisa dibatalkan dari riwayat.');
    end if;
    if (e.tree_id is not null or e.table_name in ('settings', 'origin_trees', 'origin_tree_access'))
       and not public.is_owner() then
      perform private.fail('UN007', 'Hanya admin utama yang bisa membatalkan perubahan ini.');
    end if;
    if e.actor_member_id is distinct from saya and not public.has_perm('batalkan_orang_lain') then
      perform private.fail('UN006', 'Anda hanya bisa membatalkan perubahan Anda sendiri.');
    end if;

    execute format('select to_jsonb(t) from public.%I t, jsonb_populate_record(null::public.%I, $1) r where %s',
                   e.table_name, e.table_name, private.key_predicate(e.row_key))
      into sekarang using e.row_key;

    pembanding := case when e.op = 'tambah'
      then array(select k from jsonb_object_keys(e.new_row) k where k <> all (private.meta_columns()))
      else e.changed_fields end;
    if sekarang is null or exists (
         select 1 from unnest(pembanding) k where (sekarang -> k) is distinct from (e.new_row -> k)) then
      select l.at, coalesce(mn.display_name, 'sistem') as nama into terakhir
      from public.change_log l left join public.members mn on mn.id = l.actor_member_id
      where l.table_name = e.table_name and l.row_key = e.row_key and l.id > e.id and l.batch_id <> p_batch
      order by l.id desc limit 1;
      perform private.fail('UN003',
        case when terakhir.at is null then 'Data ini sudah berubah sejak perubahan itu, jadi tidak bisa dibatalkan otomatis. Silakan ubah secara manual.'
             else format('Data ini sudah diubah lagi oleh %s pada %s WIB. Batalkan perubahan itu dulu, atau ubah secara manual.',
                         terakhir.nama, to_char(terakhir.at at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24.MI')) end);
    end if;
  end loop;

  -- Terapkan, dari perubahan terakhir ke yang pertama.
  perform set_config('silsilah.undo_of_batch', p_batch::text, true);
  batch_baru := private.current_batch();
  for e in
    select * from public.change_log where batch_id = p_batch and not automatic order by id desc
  loop
    if e.op = 'tambah' then
      if e.table_name in ('people', 'unions', 'children') then
        execute format('update public.%I t set deleted_at = now(), deleted_by = $2, delete_batch = $3
                        from jsonb_populate_record(null::public.%I, $1) r where %s',
                       e.table_name, e.table_name, private.key_predicate(e.row_key))
          using e.row_key, saya, batch_sampah;
      elsif e.table_name = 'origin_tree_access' then
        execute format('delete from public.%I t using jsonb_populate_record(null::public.%I, $1) r where %s',
                       e.table_name, e.table_name, private.key_predicate(e.row_key))
          using e.row_key;
      end if;
      -- birth_ranks dibuat otomatis; ikut dirapikan saat hubungannya dibuang.
    else
      kolom := e.changed_fields;
      execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $2) o)
                      from jsonb_populate_record(null::public.%I, $1) r where %s',
                     e.table_name,
                     (select string_agg(format('%I', k), ', ') from unnest(kolom) k),
                     (select string_agg(format('o.%I', k), ', ') from unnest(kolom) k),
                     e.table_name, e.table_name, private.key_predicate(e.row_key))
        using e.row_key, e.old_row;
    end if;
  end loop;
  perform set_config('silsilah.undo_of_batch', '', true);
  return batch_baru;
end $$;
revoke all on function public.undo_batch(uuid) from public, anon, authenticated;
grant execute on function public.undo_batch(uuid) to authenticated;

-- Melepas penahanan (hanya admin utama).
create or replace function public.release_hold(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    perform private.fail('AK002', 'Hanya admin utama yang bisa melepas penahanan.');
  end if;
  update public.members set hold_until = null, hold_reason = null where id = p_member;
end $$;
revoke all on function public.release_hold(uuid) from public, anon, authenticated;
grant execute on function public.release_hold(uuid) to authenticated;

insert into public.app_migrations (version, name)
values ('006', 'riwayat_undo')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
select 'Tabel riwayat yang dicatat (dari 7)' as pemeriksaan,
       (select count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where t.tgname = 'zz_log' and c.relnamespace = 'public'::regnamespace) as hasil,
       '7' as harus
union all
select 'Riwayat bisa ditulis/diubah/dihapus aplikasi',
       (has_table_privilege('authenticated', 'public.change_log', 'insert')
        or has_table_privilege('authenticated', 'public.change_log', 'update')
        or has_table_privilege('authenticated', 'public.change_log', 'delete'))::text,
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
       '006 atau lebih';
