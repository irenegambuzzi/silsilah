-- 002 — Tabel inti silsilah.
--
-- Data disimpan PER ORANG, PER PERNIKAHAN, dan PER HUBUNGAN (bukan satu
-- JSON besar), sehingga dua orang yang mengedit bersamaan tidak saling
-- menimpa:
--
--   people        satu baris per orang (silsilah utama atau pohon
--                 keluarga asal, dibedakan oleh tree_id).
--   unions        satu baris untuk SETIAP KALI menikah. Pasangan yang sama
--                 boleh muncul lebih dari sekali (menikah lagi).
--   children      hubungan anak ke satu pernikahan: kandung, sambung,
--                 atau angkat.
--   birth_ranks   urutan lahir anak kandung PER ORANG TUA, lintas semua
--                 pernikahannya.
--                 Kalau kedua orang tua sama-sama keturunan, anak punya
--                 dua baris (satu per orang tua).
--   origin_trees  pohon keluarga asal milik seorang pasangan khusus.
--
-- Tanggal disimpan "kabur": tahun, bulan, hari (boleh kosong dari
-- belakang) + tanda perkiraan. Contoh: "1950", "Maret 1950", "± 1950".
--
-- Yang BELUM ada di file ini (menyusul):
--   - trigger version/updated_at, anti-siklus, aturan pangkal, konsistensi
--     pohon, urutan lahir otomatis (003);
--   - kolom *_by dihubungkan ke tabel anggota (004);
--   - policy RLS dan hak akses (005). Sampai saat itu tidak ada yang bisa
--     membaca atau menulis tabel-tabel ini lewat API.
--
-- Aman dijalankan ulang. Membutuhkan 001.
-- Cara pakai: SQL Editor → tempel SELURUH isi file ini → Run.

begin;

-- ── Tanggal kabur ─────────────────────────────────────────────────
-- true kalau kombinasi tahun/bulan/hari masuk akal:
--   bulan hanya boleh ada kalau tahun ada, hari hanya kalau bulan ada,
--   tanggal harus benar-benar ada (29 Februari hanya di tahun kabisat),
--   tahun antara 1500 dan 2200.
-- Dipakai oleh check constraint, sehingga pengguna yang menyimpan data
-- (authenticated) harus boleh menjalankannya. anon tidak.
create or replace function public.fuzzy_date_valid(y int, m int, d int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    (m is null or y is not null)
    and (d is null or m is not null)
    and (y is null or y between 1500 and 2200)
    and (m is null or m between 1 and 12)
    and (d is null or (
      d between 1 and 31
      and d <= extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::int
    ))
$$;
revoke all on function public.fuzzy_date_valid(int, int, int) from public, anon, authenticated;
grant execute on function public.fuzzy_date_valid(int, int, int) to authenticated;

-- ── people ────────────────────────────────────────────────────────
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  -- null = silsilah utama; terisi = pohon keluarga asal (origin_trees).
  tree_id uuid,

  full_name text not null
    check (full_name = btrim(full_name) and length(full_name) between 1 and 200),
  nickname text check (nickname = btrim(nickname) and length(nickname) between 1 and 100),
  religious_title text check (length(religious_title) between 1 and 50),
  academic_title text check (length(academic_title) between 1 and 50),
  sex text check (sex in ('L', 'P')),

  birth_y smallint, birth_m smallint, birth_d smallint,
  birth_approx boolean not null default false,
  birth_place text check (length(birth_place) between 1 and 200),

  is_deceased boolean not null default false,
  death_y smallint, death_m smallint, death_d smallint,
  death_approx boolean not null default false,
  death_place text check (length(death_place) between 1 and 200),

  occupation text check (length(occupation) between 1 and 200),
  notes text check (length(notes) <= 10000),
  -- Status pernikahan yang dipilih ORANGNYA SENDIRI. Satu-satunya pilihan
  -- yang disimpan adalah 'belum_menikah'; "Menikah", "Berpisah", dan
  -- "Ditinggal wafat pasangan" selalu dihitung dari data pernikahan
  -- (unions). Kosong = belum dipilih (tampil "-"). Aplikasi tidak pernah
  -- mengisinya sendiri; hanya orang itu yang boleh (aturan di 005).
  marital_choice text check (marital_choice in ('belum_menikah')),

  -- Id dari data lama, untuk menelusuri hasil migrasi.
  legacy_id text,

  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_batch uuid,

  constraint people_birth_valid check (
    public.fuzzy_date_valid(birth_y, birth_m, birth_d) and (not birth_approx or birth_y is not null)),
  constraint people_death_valid check (
    public.fuzzy_date_valid(death_y, death_m, death_d) and (not death_approx or death_y is not null)),
  -- Tanggal/tempat wafat hanya untuk orang yang sudah wafat.
  constraint people_death_needs_deceased check (
    is_deceased or (death_y is null and death_place is null)),
  -- Wafat tidak mungkin sebelum lahir (dibandingkan per tahun).
  constraint people_death_after_birth check (
    death_y is null or birth_y is null or death_y >= birth_y),
  -- Disisihkan: tanggal dan kelompok penyisihan selalu terisi bersamaan.
  constraint people_trash_consistent check ((deleted_at is null) = (delete_batch is null))
);

-- ── origin_trees: pohon keluarga asal ─────────────────────────────
create table if not exists public.origin_trees (
  id uuid primary key default gen_random_uuid(),
  -- Pasangan khusus (ada di silsilah utama) yang punya pohon ini.
  anchor_person_id uuid not null unique references public.people (id) on delete restrict,
  -- Sakelar: hanya admin utama yang boleh mengubah (aturan di 005).
  is_active boolean not null default true,
  -- "Beri akses ke semua keturunan …": termasuk keturunan yang lahir nanti.
  grant_all_descendants boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_tree_fk') then
    alter table public.people
      add constraint people_tree_fk foreign key (tree_id)
      references public.origin_trees (id) on delete restrict;
  end if;
end $$;

-- ── unions: pernikahan ────────────────────────────────────────────
create table if not exists public.unions (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid references public.origin_trees (id) on delete restrict,

  -- partner1 = pihak garis keturunan; partner2 = pasangan (null = tidak
  -- diketahui). Pasangan yang sama boleh menikah lebih dari sekali, jadi
  -- TIDAK ada constraint unik untuk pasangan ini.
  partner1_id uuid not null references public.people (id) on delete restrict,
  partner2_id uuid references public.people (id) on delete restrict,
  -- "Wafat" tidak disimpan di sini: dihitung dari is_deceased.
  -- 'cerai' = pernikahan berakhir karena berpisah, apa pun caranya (cerai
  -- resmi, cerai agama/adat, atau ditinggal tanpa kabar). Tampilan selalu
  -- menulisnya "Berpisah". Siapa yang boleh mengisinya: aturan di 005.
  -- Pernikahan baru tetap boleh dicatat walaupun pernikahan sebelumnya
  -- belum ditandai berakhir (tidak ada aturan yang melarangnya).
  status text not null default 'menikah'
    check (status in ('menikah', 'cerai', 'tidak_diketahui')),

  marriage_y smallint, marriage_m smallint, marriage_d smallint,
  marriage_approx boolean not null default false,
  end_y smallint, end_m smallint, end_d smallint,
  end_approx boolean not null default false,

  -- Urutan pernikahan ke-n untuk partner1 (kosong = ikut tanggal menikah).
  sort_order smallint check (sort_order > 0),
  notes text check (length(notes) <= 10000),

  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_batch uuid,

  constraint unions_distinct_partners check (partner1_id <> partner2_id),
  constraint unions_marriage_valid check (
    public.fuzzy_date_valid(marriage_y, marriage_m, marriage_d)
    and (not marriage_approx or marriage_y is not null)),
  constraint unions_end_valid check (
    public.fuzzy_date_valid(end_y, end_m, end_d) and (not end_approx or end_y is not null)),
  constraint unions_end_after_marriage check (
    end_y is null or marriage_y is null or end_y >= marriage_y),
  constraint unions_trash_consistent check ((deleted_at is null) = (delete_batch is null))
);

-- ── children: hubungan orang tua–anak ─────────────────────────────
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid references public.origin_trees (id) on delete restrict,
  union_id uuid not null references public.unions (id) on delete restrict,
  child_id uuid not null references public.people (id) on delete restrict,

  -- kandung: anak kedua orang tua di pernikahan ini.
  -- sambung: anak salah satu saja (biasanya anak pasangan dari hubungan
  --          sebelumnya).
  -- angkat:  tanpa hubungan darah dengan keduanya.
  -- Ketiganya tampil sama di kartu; bedanya hanya di panel detail.
  kind text not null default 'kandung' check (kind in ('kandung', 'sambung', 'angkat')),
  -- Siapa orang tua darahnya. Dipakai untuk "keturunan darah" (akses
  -- pohon keluarga asal).
  biological_parent text check (biological_parent in ('keduanya', 'partner1', 'partner2')),

  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_batch uuid,

  constraint children_biological_matches_kind check (
    (kind = 'kandung' and biological_parent = 'keduanya')
    or (kind = 'sambung' and biological_parent in ('partner1', 'partner2'))
    or (kind = 'angkat' and biological_parent is null)),
  constraint children_trash_consistent check ((deleted_at is null) = (delete_batch is null))
);

-- Satu anak hanya sekali per pernikahan (yang tidak disisihkan).
create unique index if not exists children_union_child_active
  on public.children (union_id, child_id) where deleted_at is null;
-- Satu hubungan KANDUNG aktif per anak. (Anak angkat/sambung di
-- pernikahan lain tetap boleh.)
create unique index if not exists children_one_biological_active
  on public.children (child_id) where kind = 'kandung' and deleted_at is null;

-- ── birth_ranks: urutan lahir per orang tua ───────────────────────
-- "Putra/Putri ke-n" dihitung di antara semua ANAK KANDUNG orang tua itu,
-- lintas semua pernikahannya (termasuk menikah lagi dengan pasangan yang
-- sama). Anak sambung dan anak angkat tidak bernomor. Anak yang wafat saat
-- bayi tetap dihitung. Diisi otomatis dari tanggal lahir (003) dan bisa
-- diatur manual.
create table if not exists public.birth_ranks (
  tree_id uuid references public.origin_trees (id) on delete restrict,
  parent_id uuid not null references public.people (id) on delete restrict,
  child_id uuid not null references public.people (id) on delete restrict,
  rank smallint not null check (rank > 0),

  version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,

  primary key (parent_id, child_id),
  constraint birth_ranks_not_self check (parent_id <> child_id),
  -- Ditunda sampai akhir transaksi, supaya urutan bisa ditukar.
  constraint birth_ranks_unique_rank unique (parent_id, rank) deferrable initially deferred
);

-- ── Pangkal silsilah ──────────────────────────────────────────────
alter table public.settings add column if not exists root_union_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_root_union_fk') then
    alter table public.settings
      add constraint settings_root_union_fk foreign key (root_union_id)
      references public.unions (id) on delete restrict;
  end if;
end $$;

-- ── Indeks untuk pencarian hubungan ───────────────────────────────
create index if not exists people_tree_idx on public.people (tree_id);
create index if not exists unions_partner1_idx on public.unions (partner1_id);
create index if not exists unions_partner2_idx on public.unions (partner2_id);
create index if not exists unions_tree_idx on public.unions (tree_id);
create index if not exists children_union_idx on public.children (union_id);
create index if not exists children_child_idx on public.children (child_id);
create index if not exists children_tree_idx on public.children (tree_id);
create index if not exists birth_ranks_child_idx on public.birth_ranks (child_id);

-- ── RLS aktif, belum ada akses ────────────────────────────────────
-- Policy dan hak untuk anggota ditambahkan di 005.
alter table public.people enable row level security;
alter table public.origin_trees enable row level security;
alter table public.unions enable row level security;
alter table public.children enable row level security;
alter table public.birth_ranks enable row level security;
revoke all on table public.people, public.origin_trees, public.unions,
  public.children, public.birth_ranks from public, anon, authenticated;

insert into public.app_migrations (version, name)
values ('002', 'silsilah')
on conflict (version) do update set last_applied_at = now();

commit;

-- ── Pemeriksaan ───────────────────────────────────────────────────
with tabel as (
  select c.oid, c.relname, c.relrowsecurity as rls
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relname in ('people', 'origin_trees', 'unions', 'children', 'birth_ranks')
)
select 'Tabel silsilah yang ada (dari 5)' as pemeriksaan,
       (select count(*)::text from tabel) as hasil,
       '5' as harus
union all
select 'Tabel silsilah TANPA RLS',
       coalesce((select string_agg(relname, ', ' order by relname) from tabel where not rls), 'tidak ada'),
       'tidak ada'
union all
select 'Tabel silsilah yang bisa disentuh anon/authenticated',
       coalesce((select string_agg(relname, ', ' order by relname) from tabel
                 where has_table_privilege('anon', oid, 'select, insert, update, delete')
                    or has_table_privilege('authenticated', oid, 'select, insert, update, delete')),
                'tidak ada'),
       'tidak ada'
union all
select 'anon bisa menjalankan fuzzy_date_valid',
       has_function_privilege('anon', 'public.fuzzy_date_valid(int, int, int)', 'execute')::text,
       'false'
union all
select 'Contoh: 29 Februari 2023 ditolak, 2024 diterima',
       (not public.fuzzy_date_valid(2023, 2, 29) and public.fuzzy_date_valid(2024, 2, 29))::text,
       'true'
union all
select 'Kolom pangkal (settings.root_union_id) ada',
       (select count(*)::text from information_schema.columns
        where table_schema = 'public' and table_name = 'settings' and column_name = 'root_union_id'),
       '1'
union all
select 'Versi database',
       public.db_version(),
       '002 atau lebih';
