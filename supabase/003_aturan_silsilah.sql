-- 003 — Aturan otomatis yang menjaga kebenaran silsilah.
--
-- Trigger di file ini berjalan di database, sehingga aturannya berlaku
-- untuk SEMUA cara menyimpan data (aplikasi, skrip migrasi, SQL Editor):
--
--   1. Cap waktu dan versi: setiap perubahan menaikkan "version" (dipakai
--      aplikasi untuk mendeteksi edit bersamaan) dan mencatat kapan/siapa.
--      Simpan tanpa perubahan apa pun diabaikan.
--   2. Kolom yang tidak boleh berubah setelah dibuat (pohon, pihak garis
--      keturunan sebuah pernikahan, anak dalam sebuah hubungan, …).
--   3. Anti-siklus: seseorang tidak bisa menjadi anak dari dirinya sendiri
--      atau dari keturunannya.
--   4. Pasangan pangkal tidak punya orang tua di silsilah utama.
--   5. Pasangan (bukan keturunan) tidak bisa diberi orang tua di silsilah
--      utama; keluarga asalnya dicatat di pohon keluarga asal.
--   6. Konsistensi pohon: orang, pernikahan, dan hubungan anak harus di
--      pohon yang sama, kecuali satu sambungan resmi: pasangan khusus
--      menjadi "anak" di pohon keluarga asalnya.
--   7. Urutan lahir otomatis: setiap ANAK KANDUNG baru diberi urutan untuk
--      setiap orang tua kandungnya yang tergolong garis keturunan,
--      disisipkan menurut tanggal lahir (kalau tidak ada tanggal, di urutan
--      terakhir). Anak sambung dan anak angkat TIDAK bernomor ("Putra/Putri
--      ke-n" hanya menghitung anak kandung orang tua itu). Urutan
--      dirapikan otomatis kalau hubungan didisisihkan atau
--      dipindah. Urutan yang bertentangan dengan tanggal lahir tidak
--      ditolak, tetapi muncul di birth_rank_warnings().
--
-- Kode error (dipakai aplikasi untuk menampilkan pesan yang tepat):
--   SL001 siklus · SL002 pangkal punya orang tua · SL003 pohon tidak cocok
--   SL004 pasangan diberi orang tua · SL005 pihak garis keturunan bukan
--   keturunan pangkal · SL006 kolom tidak boleh diubah · SL007 urutan lahir
--   bukan untuk anak kandung orang tua itu · SL008 data yang disisihkan
--   SL009 pohon keluarga asal bukan untuk pasangan di silsilah utama
--
-- Catatan untuk impor data (migrasi): atur pasangan pangkal lebih dulu,
-- lalu masukkan generasi demi generasi dari atas ke bawah, dan anak-anak
-- menurut urutan lahirnya.
--
-- Aman dijalankan ulang. Membutuhkan 001 dan 002.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Pembantu ──────────────────────────────────────────────────────

-- Pelaku perubahan (anggota yang sedang login). Sementara selalu kosong;
-- 004 menggantinya setelah tabel anggota ada. Dibuat hanya kalau belum
-- ada, supaya menjalankan ulang file ini tidak menimpa versi 004.
do $$
begin
  if to_regprocedure('private.actor_member_id()') is null then
    create function private.actor_member_id() returns uuid
      language sql stable security definer set search_path = ''
      as 'select null::uuid';
  end if;
end $$;
revoke all on function private.actor_member_id() from public, anon, authenticated;

create or replace function private.fail(kode text, pesan text, detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = kode, message = pesan, detail = coalesce(detail, '');
end $$;
revoke all on function private.fail(text, text, text) from public, anon, authenticated;

-- Perubahan struktur silsilah dijalankan satu per satu (tidak bersamaan),
-- supaya dua orang tidak bisa sama-sama membuat siklus tanpa ketahuan.
create or replace function private.lock_structure()
returns void
language sql
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('silsilah.struktur', 0)) $$;
revoke all on function private.lock_structure() from public, anon, authenticated;

-- true kalau tanggal a PASTI sesudah tanggal b (bagian yang tidak
-- diketahui tidak dibandingkan). Dipakai juga oleh birth_rank_warnings().
create or replace function public.fuzzy_date_after(
  a_y int, a_m int, a_d int, b_y int, b_m int, b_d int
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(a_y is not null and b_y is not null and (
    a_y > b_y
    or (a_y = b_y and a_m is not null and b_m is not null and (
      a_m > b_m or (a_m = b_m and a_d is not null and b_d is not null and a_d > b_d)))), false)
$$;
revoke all on function public.fuzzy_date_after(int, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.fuzzy_date_after(int, int, int, int, int, int) to authenticated;

-- Garis keturunan: salah satu pasangan pangkal, atau punya orang tua di
-- silsilah utama (hanya keturunan yang boleh punya orang tua di sana).
create or replace function private.is_lineage(p uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p is not null and (
    exists (
      select 1 from public.settings s
      join public.unions u on u.id = s.root_union_id
      where s.id and p in (u.partner1_id, u.partner2_id))
    or exists (
      select 1 from public.children c
      join public.unions u on u.id = c.union_id
      where c.child_id = p and c.tree_id is null
        and c.deleted_at is null and u.deleted_at is null))
$$;
revoke all on function private.is_lineage(uuid) from public, anon, authenticated;

-- true kalau kandidat adalah orang itu sendiri atau salah satu leluhurnya
-- (lewat hubungan anak yang aktif, di pohon mana pun).
create or replace function private.is_ancestor_or_self(kandidat uuid, orang uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive leluhur(id) as (
    select orang
    union
    select p
    from public.children c
    join leluhur l on c.child_id = l.id
    join public.unions u on u.id = c.union_id
    cross join lateral unnest(array[u.partner1_id, u.partner2_id]) as p
    where c.deleted_at is null and u.deleted_at is null and p is not null
  )
  select exists (select 1 from leluhur where id = kandidat)
$$;
revoke all on function private.is_ancestor_or_self(uuid, uuid) from public, anon, authenticated;

-- Orang tua dalam sebuah pernikahan yang mendapat urutan lahir:
-- pihak garis keturunan (partner1) selalu; pasangannya hanya kalau ia juga
-- garis keturunan (pernikahan antarsepupu), atau di pohon keluarga asal.
create or replace function private.rank_parents(p_union uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    u.partner1_id,
    case when u.partner2_id is not null
          and (u.tree_id is not null or private.is_lineage(u.partner2_id))
         then u.partner2_id end
  ], null)
  from public.unions u
  where u.id = p_union and u.deleted_at is null
$$;
revoke all on function private.rank_parents(uuid) from public, anon, authenticated;

-- true kalau hubungan anak ini menjadikan p orang tua KANDUNG anak itu:
-- anak kandung kedua orang tua, atau anak sambung yang orang tua darahnya p
-- (misalnya anak seorang keturunan dari hubungan sebelumnya). Anak angkat
-- tidak pernah. Hanya anak kandung yang mendapat urutan lahir.
create or replace function private.is_birth_parent(
  p uuid, p_biological text, p_partner1 uuid, p_partner2 uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and coalesce(
    (p_biological = 'keduanya' and p in (p_partner1, p_partner2))
    or (p_biological = 'partner1' and p = p_partner1)
    or (p_biological = 'partner2' and p = p_partner2), false)
$$;
revoke all on function private.is_birth_parent(uuid, text, uuid, uuid) from public, anon, authenticated;

-- Memberi urutan lahir untuk anak c di bawah orang tua p, disisipkan
-- sebelum saudara pertama yang PASTI lahir sesudahnya; kalau tidak ada
-- (atau tanggal lahir c tidak diketahui), di urutan terakhir.
create or replace function private.add_rank(p uuid, c uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anak public.people;
  posisi int;
begin
  if exists (select 1 from public.birth_ranks where parent_id = p and child_id = c) then
    return;
  end if;
  select * into anak from public.people where id = c;

  select min(br.rank) into posisi
  from public.birth_ranks br
  join public.people s on s.id = br.child_id
  where br.parent_id = p
    and public.fuzzy_date_after(s.birth_y, s.birth_m, s.birth_d, anak.birth_y, anak.birth_m, anak.birth_d);

  if posisi is null then
    select coalesce(max(rank), 0) + 1 into posisi from public.birth_ranks where parent_id = p;
  else
    update public.birth_ranks set rank = rank + 1 where parent_id = p and rank >= posisi;
  end if;

  insert into public.birth_ranks (parent_id, child_id, rank) values (p, c, posisi);
end $$;
revoke all on function private.add_rank(uuid, uuid) from public, anon, authenticated;

-- Membuang urutan yang tidak lagi sah untuk orang tua p (hubungan dibuang,
-- dipindah, atau diubah menjadi anak sambung/angkat), lalu merapikan
-- nomornya menjadi 1, 2, 3, … tanpa celah.
create or replace function private.cleanup_ranks(p uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p is null then
    return;
  end if;
  delete from public.birth_ranks br
  where br.parent_id = p
    and not exists (
      select 1 from public.children c
      join public.unions u on u.id = c.union_id
      where c.child_id = br.child_id and c.deleted_at is null and u.deleted_at is null
        and p = any (private.rank_parents(u.id))
        and private.is_birth_parent(p, c.biological_parent, u.partner1_id, u.partner2_id));

  with urut as (
    select child_id, row_number() over (order by rank) as baru
    from public.birth_ranks where parent_id = p
  )
  update public.birth_ranks br set rank = urut.baru
  from urut
  where br.parent_id = p and br.child_id = urut.child_id and br.rank <> urut.baru;
end $$;
revoke all on function private.cleanup_ranks(uuid) from public, anon, authenticated;

-- Menyamakan urutan lahir dengan isi sebuah pernikahan (hanya anak kandung
-- setiap orang tua).
create or replace function private.sync_union_ranks(p_union uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p uuid;
  c record;
  u public.unions;
begin
  select * into u from public.unions where id = p_union;
  if not found then
    return;
  end if;
  foreach p in array coalesce(private.rank_parents(p_union), '{}') loop
    for c in
      select ch.child_id
      from public.children ch
      join public.people pe on pe.id = ch.child_id
      where ch.union_id = p_union and ch.deleted_at is null
        and private.is_birth_parent(p, ch.biological_parent, u.partner1_id, u.partner2_id)
      order by pe.birth_y nulls last, pe.birth_m nulls last, pe.birth_d nulls last, ch.created_at
    loop
      perform private.add_rank(p, c.child_id);
    end loop;
  end loop;
  perform private.cleanup_ranks(u.partner1_id);
  perform private.cleanup_ranks(u.partner2_id);
end $$;
revoke all on function private.sync_union_ranks(uuid) from public, anon, authenticated;

-- ── 1. Cap waktu dan versi ────────────────────────────────────────
create or replace function private.trg_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
    new.created_by := private.actor_member_id();
    new.updated_by := new.created_by;
    return new;
  end if;
  -- Simpan tanpa perubahan: abaikan (tidak menaikkan versi, tidak dicatat).
  if (to_jsonb(new) - 'version' - 'updated_at' - 'updated_by')
     = (to_jsonb(old) - 'version' - 'updated_at' - 'updated_by') then
    return null;
  end if;
  new.version := old.version + 1;
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := private.actor_member_id();
  return new;
end $$;
revoke all on function private.trg_stamp() from public, anon, authenticated;

-- ── 2. Kolom yang tidak boleh berubah ─────────────────────────────
-- Nama kolom diberikan sebagai argumen trigger.
create or replace function private.trg_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kolom text;
begin
  foreach kolom in array tg_argv loop
    if (to_jsonb(new) -> kolom) is distinct from (to_jsonb(old) -> kolom) then
      perform private.fail('SL006',
        'Bagian data ini tidak boleh diubah setelah dibuat. Buat data baru kalau perlu.',
        tg_table_name || '.' || kolom);
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.trg_immutable() from public, anon, authenticated;

-- ── Pernikahan ────────────────────────────────────────────────────
create or replace function private.trg_unions_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p1 public.people;
  p2 public.people;
  akar uuid;
  c record;
begin
  perform private.lock_structure();
  select * into p1 from public.people where id = new.partner1_id;
  select root_union_id into akar from public.settings where id;

  if tg_op = 'INSERT' then
    if new.tree_id is not null and new.tree_id is distinct from p1.tree_id then
      perform private.fail('SL003', 'Pernikahan harus berada di pohon yang sama dengan orang-orangnya.');
    end if;
    new.tree_id := p1.tree_id;
  end if;

  if new.deleted_at is null then
    if p1.deleted_at is not null then
      perform private.fail('SL008', 'Orang ini sedang disisihkan. Pulihkan dulu sebelum dipakai.');
    end if;
    if new.partner2_id is not null then
      select * into p2 from public.people where id = new.partner2_id;
      if p2.tree_id is distinct from new.tree_id then
        perform private.fail('SL003', 'Kedua pasangan harus berada di pohon yang sama.');
      end if;
      if p2.deleted_at is not null then
        perform private.fail('SL008', 'Pasangan ini sedang disisihkan. Pulihkan dulu sebelum dipakai.');
      end if;
    end if;

    -- Di silsilah utama, pihak garis keturunan harus keturunan pangkal.
    if new.tree_id is null and akar is not null and new.id is distinct from akar
       and (tg_op = 'INSERT' or old.deleted_at is not null)
       and not private.is_lineage(new.partner1_id) then
      perform private.fail('SL005',
        'Pernikahan di silsilah utama harus dicatat dari pihak keturunan pasangan pangkal.');
    end if;

    -- Pasangan yang diganti tidak boleh keturunan dari anak-anak pernikahan ini.
    if tg_op = 'UPDATE' and new.partner2_id is distinct from old.partner2_id and new.partner2_id is not null then
      for c in select child_id from public.children where union_id = new.id and deleted_at is null loop
        if private.is_ancestor_or_self(c.child_id, new.partner2_id) then
          perform private.fail('SL001',
            'Hubungan ini membuat silsilah berputar: seseorang tidak bisa menjadi anak dari dirinya sendiri atau dari keturunannya.');
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.trg_unions_check() from public, anon, authenticated;

-- ── Hubungan anak ─────────────────────────────────────────────────
create or replace function private.trg_children_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.unions;
  anak public.people;
  akar public.unions;
  jangkar uuid;
begin
  perform private.lock_structure();
  select * into u from public.unions where id = new.union_id;
  select * into anak from public.people where id = new.child_id;

  if tg_op = 'INSERT' then
    if new.tree_id is not null and new.tree_id is distinct from u.tree_id then
      perform private.fail('SL003', 'Hubungan anak harus berada di pohon yang sama dengan pernikahannya.');
    end if;
    new.tree_id := u.tree_id;
  elsif new.tree_id is distinct from u.tree_id then
    perform private.fail('SL003', 'Anak hanya bisa dipindah ke pernikahan di pohon yang sama.');
  end if;

  -- Anak di pohon yang sama dengan pernikahannya, atau sambungan resmi:
  -- pasangan khusus menjadi anak di pohon keluarga asalnya sendiri.
  if anak.tree_id is distinct from u.tree_id then
    select anchor_person_id into jangkar from public.origin_trees where id = u.tree_id;
    if not (u.tree_id is not null and anak.tree_id is null and jangkar = anak.id) then
      perform private.fail('SL003', 'Anak harus berada di pohon yang sama dengan orang tuanya.');
    end if;
  end if;

  if new.deleted_at is null
     and (tg_op = 'INSERT' or new.union_id is distinct from old.union_id or old.deleted_at is not null) then
    if u.deleted_at is not null or anak.deleted_at is not null then
      perform private.fail('SL008', 'Data ini sedang disisihkan. Pulihkan dulu sebelum dipakai.');
    end if;

    if private.is_ancestor_or_self(new.child_id, u.partner1_id)
       or (u.partner2_id is not null and private.is_ancestor_or_self(new.child_id, u.partner2_id)) then
      perform private.fail('SL001',
        'Hubungan ini membuat silsilah berputar: seseorang tidak bisa menjadi anak dari dirinya sendiri atau dari keturunannya.');
    end if;

    if u.tree_id is null then
      select un.* into akar from public.settings s join public.unions un on un.id = s.root_union_id where s.id;
      if akar.id is not null and new.child_id in (akar.partner1_id, akar.partner2_id) then
        perform private.fail('SL002', 'Pasangan pangkal tidak boleh punya orang tua di silsilah utama.');
      end if;
      -- Hanya untuk hubungan baru atau pindahan: saat memulihkan data yang
      -- disisihkan, orangnya sementara tidak terhitung keturunan (hubungan yang
      -- dipulihkan inilah yang membuatnya keturunan).
      if (tg_op = 'INSERT' or new.union_id is distinct from old.union_id)
         and exists (
           select 1 from public.unions un
           where un.partner2_id = new.child_id and un.tree_id is null and un.deleted_at is null)
         and not private.is_lineage(new.child_id) then
        perform private.fail('SL004',
          'Pasangan tidak bisa diberi orang tua di silsilah utama. Keluarga asal pasangan dicatat di pohon keluarga asal.');
      end if;
      if akar.id is not null and not private.is_lineage(u.partner1_id) then
        perform private.fail('SL005',
          'Anak di silsilah utama hanya bisa dicatat di bawah keturunan pasangan pangkal.');
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.trg_children_check() from public, anon, authenticated;

create or replace function private.trg_children_ranks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.sync_union_ranks(new.union_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.union_id <> new.union_id) then
    perform private.sync_union_ranks(old.union_id);
  end if;
  return null;
end $$;
revoke all on function private.trg_children_ranks() from public, anon, authenticated;

create or replace function private.trg_unions_ranks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_union_ranks(new.id);
  if old.partner2_id is distinct from new.partner2_id then
    perform private.cleanup_ranks(old.partner2_id);
  end if;
  return null;
end $$;
revoke all on function private.trg_unions_ranks() from public, anon, authenticated;

-- ── Urutan lahir ──────────────────────────────────────────────────
create or replace function private.trg_birth_ranks_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pohon uuid;
begin
  select tree_id into pohon from public.people where id = new.parent_id;
  if tg_op = 'INSERT' then
    if new.tree_id is not null and new.tree_id is distinct from pohon then
      perform private.fail('SL003', 'Urutan lahir harus berada di pohon yang sama dengan orang tuanya.');
    end if;
    new.tree_id := pohon;
  end if;
  if not exists (
    select 1 from public.children c
    join public.unions u on u.id = c.union_id
    where c.child_id = new.child_id and c.deleted_at is null and u.deleted_at is null
      and private.is_birth_parent(new.parent_id, c.biological_parent, u.partner1_id, u.partner2_id)) then
    perform private.fail('SL007', 'Urutan lahir hanya bisa dicatat untuk anak kandung orang tua tersebut.');
  end if;
  return new;
end $$;
revoke all on function private.trg_birth_ranks_check() from public, anon, authenticated;

-- ── Pohon keluarga asal ───────────────────────────────────────────
create or replace function private.trg_origin_trees_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jangkar public.people;
begin
  select * into jangkar from public.people where id = new.anchor_person_id;
  if jangkar.tree_id is not null or jangkar.deleted_at is not null
     or not exists (
       select 1 from public.unions u
       where u.partner2_id = jangkar.id and u.tree_id is null and u.deleted_at is null)
     or private.is_lineage(jangkar.id) then
    perform private.fail('SL009',
      'Pohon keluarga asal hanya bisa dibuat untuk pasangan (bukan keturunan) di silsilah utama.');
  end if;
  return new;
end $$;
revoke all on function private.trg_origin_trees_check() from public, anon, authenticated;

-- ── Pasangan pangkal ──────────────────────────────────────────────
create or replace function private.trg_settings_root()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.unions;
begin
  if new.root_union_id is null or new.root_union_id is not distinct from old.root_union_id then
    return new;
  end if;
  perform private.lock_structure();
  select * into u from public.unions where id = new.root_union_id;
  if u.tree_id is not null then
    perform private.fail('SL003', 'Pasangan pangkal harus berada di silsilah utama.');
  end if;
  if u.deleted_at is not null then
    perform private.fail('SL008', 'Pernikahan ini sedang disisihkan. Pulihkan dulu sebelum dipakai.');
  end if;
  if exists (
    select 1 from public.children c
    where c.child_id in (u.partner1_id, u.partner2_id) and c.tree_id is null and c.deleted_at is null) then
    perform private.fail('SL002', 'Pasangan pangkal tidak boleh punya orang tua di silsilah utama.');
  end if;
  return new;
end $$;
revoke all on function private.trg_settings_root() from public, anon, authenticated;

create or replace function private.trg_settings_root_ranks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.root_union_id is not null and new.root_union_id is distinct from old.root_union_id then
    perform private.sync_union_ranks(new.root_union_id);
  end if;
  return null;
end $$;
revoke all on function private.trg_settings_root_ranks() from public, anon, authenticated;

-- ── Fungsi untuk aplikasi ─────────────────────────────────────────

-- Urutan lahir yang bertentangan dengan tanggal lahir: anak dengan nomor
-- lebih kecil yang PASTI lahir sesudah saudaranya bernomor lebih besar.
-- Hanya peringatan; tidak ada yang ditolak. Mengikuti RLS pemanggil.
create or replace function public.birth_rank_warnings(p_parent uuid default null)
returns table (parent_id uuid, child_id uuid, rank smallint, later_child_id uuid, later_rank smallint)
language sql
stable
set search_path = ''
as $$
  select a.parent_id, a.child_id, a.rank, b.child_id, b.rank
  from public.birth_ranks a
  join public.birth_ranks b on b.parent_id = a.parent_id and b.rank > a.rank
  join public.people pa on pa.id = a.child_id
  join public.people pb on pb.id = b.child_id
  where (p_parent is null or a.parent_id = p_parent)
    and public.fuzzy_date_after(pa.birth_y, pa.birth_m, pa.birth_d, pb.birth_y, pb.birth_m, pb.birth_d)
  order by a.parent_id, a.rank, b.rank
$$;
revoke all on function public.birth_rank_warnings(uuid) from public, anon, authenticated;
grant execute on function public.birth_rank_warnings(uuid) to authenticated;

-- Menggeser seorang anak ke urutan tertentu (geser naik/turun manual);
-- saudara-saudaranya ikut bergeser. Mengikuti RLS pemanggil.
create or replace function public.move_birth_rank(p_parent uuid, p_child uuid, p_rank int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  sekarang int;
  jumlah int;
  tujuan int;
begin
  select rank into sekarang from public.birth_ranks where parent_id = p_parent and child_id = p_child;
  if sekarang is null then
    perform private.fail('SL007', 'Urutan lahir hanya bisa diatur untuk anak kandung orang tua tersebut.');
  end if;
  select count(*) into jumlah from public.birth_ranks where parent_id = p_parent;
  tujuan := least(greatest(p_rank, 1), jumlah);
  if tujuan < sekarang then
    update public.birth_ranks set rank = rank + 1
    where parent_id = p_parent and rank >= tujuan and rank < sekarang;
  elsif tujuan > sekarang then
    update public.birth_ranks set rank = rank - 1
    where parent_id = p_parent and rank > sekarang and rank <= tujuan;
  end if;
  update public.birth_ranks set rank = tujuan where parent_id = p_parent and child_id = p_child;
end $$;
revoke all on function public.move_birth_rank(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.move_birth_rank(uuid, uuid, int) to authenticated;

-- ── Pemasangan trigger ────────────────────────────────────────────
-- Trigger BEFORE berjalan menurut abjad namanya: a_ (tidak boleh diubah)
-- → b_ (pemeriksaan) → z_ (cap waktu, paling akhir).

drop trigger if exists a_immutable on public.people;
create trigger a_immutable before update on public.people
  for each row execute function private.trg_immutable('id', 'tree_id');
drop trigger if exists z_stamp on public.people;
create trigger z_stamp before insert or update on public.people
  for each row execute function private.trg_stamp();

drop trigger if exists a_immutable on public.unions;
create trigger a_immutable before update on public.unions
  for each row execute function private.trg_immutable('id', 'tree_id', 'partner1_id');
drop trigger if exists b_check on public.unions;
create trigger b_check before insert or update on public.unions
  for each row execute function private.trg_unions_check();
drop trigger if exists z_stamp on public.unions;
create trigger z_stamp before insert or update on public.unions
  for each row execute function private.trg_stamp();
drop trigger if exists ranks on public.unions;
create trigger ranks after update of partner2_id, deleted_at on public.unions
  for each row execute function private.trg_unions_ranks();

drop trigger if exists a_immutable on public.children;
create trigger a_immutable before update on public.children
  for each row execute function private.trg_immutable('id', 'tree_id', 'child_id');
drop trigger if exists b_check on public.children;
create trigger b_check before insert or update on public.children
  for each row execute function private.trg_children_check();
drop trigger if exists z_stamp on public.children;
create trigger z_stamp before insert or update on public.children
  for each row execute function private.trg_stamp();
drop trigger if exists ranks on public.children;
create trigger ranks after insert or update or delete on public.children
  for each row execute function private.trg_children_ranks();

drop trigger if exists a_immutable on public.birth_ranks;
create trigger a_immutable before update on public.birth_ranks
  for each row execute function private.trg_immutable('tree_id', 'parent_id', 'child_id');
drop trigger if exists b_check on public.birth_ranks;
create trigger b_check before insert or update on public.birth_ranks
  for each row execute function private.trg_birth_ranks_check();
drop trigger if exists z_stamp on public.birth_ranks;
create trigger z_stamp before insert or update on public.birth_ranks
  for each row execute function private.trg_stamp();

drop trigger if exists a_immutable on public.origin_trees;
create trigger a_immutable before update on public.origin_trees
  for each row execute function private.trg_immutable('id', 'anchor_person_id');
drop trigger if exists b_check on public.origin_trees;
create trigger b_check before insert on public.origin_trees
  for each row execute function private.trg_origin_trees_check();

drop trigger if exists b_root on public.settings;
create trigger b_root before update of root_union_id on public.settings
  for each row execute function private.trg_settings_root();
drop trigger if exists root_ranks on public.settings;
create trigger root_ranks after update of root_union_id on public.settings
  for each row execute function private.trg_settings_root_ranks();

insert into public.app_migrations (version, name)
values ('003', 'aturan_silsilah')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with pemicu as (
  select c.relname as tabel, t.tgname as nama
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
)
select 'Trigger terpasang (dari 17)' as pemeriksaan,
       (select count(*)::text from pemicu
        where (tabel, nama) in (
          ('people', 'a_immutable'), ('people', 'z_stamp'),
          ('unions', 'a_immutable'), ('unions', 'b_check'), ('unions', 'z_stamp'), ('unions', 'ranks'),
          ('children', 'a_immutable'), ('children', 'b_check'), ('children', 'z_stamp'), ('children', 'ranks'),
          ('birth_ranks', 'a_immutable'), ('birth_ranks', 'b_check'), ('birth_ranks', 'z_stamp'),
          ('origin_trees', 'a_immutable'), ('origin_trees', 'b_check'),
          ('settings', 'b_root'), ('settings', 'root_ranks'))) as hasil,
       '17' as harus
union all
select 'Fungsi di public/private yang bisa dijalankan anon',
       coalesce((select string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname in ('public', 'private')
                   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
                   and has_function_privilege('anon', p.oid, 'execute')), 'tidak ada'),
       'tidak ada'
union all
select 'Contoh: Maret 1950 pasti sesudah 1949, tapi tidak pasti sesudah 1950',
       (public.fuzzy_date_after(1950, 3, null, 1949, null, null)
        and not public.fuzzy_date_after(1950, 3, null, 1950, null, null))::text,
       'true'
union all
select 'Versi database',
       public.db_version(),
       '003 atau lebih';
