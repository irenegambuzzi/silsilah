# Rencana Pembangunan Ulang Aplikasi Silsilah Keluarga

Status: **draf versi 3 (6 Oktober 2026), belum ada kode aplikasi.** Semua pertanyaan sudah terjawab. Satu-satunya file teknis yang sudah ada adalah `supabase/000_kunci_tabel_lama.sql`, dan file itu **sudah dijalankan**.

Dokumen ini masuk ke repo publik, jadi **tidak memuat nama anggota keluarga**. Nama hanya ada di database dan di folder pribadi `data-pribadi/` yang di-gitignore.

Istilah:

- **Pasangan pangkal**: pasangan di puncak silsilah (GEN.0). Tidak ada leluhur di atas mereka.
- **Keturunan**: semua orang di bawah pasangan pangkal, termasuk anak sambung dan anak angkat yang masuk keluarga itu.
- **Pasangan**: suami/istri seorang keturunan.
- **Menantu**: pasangan seorang keturunan, dalam konteks undangan.
- **Pasangan khusus A**: (mantan) istri seorang keturunan.
- **Pasangan khusus B**: istri dari anak pasangan khusus A.
- **Pohon keluarga asal**: pohon terpisah berisi keluarga asal (orang tua, saudara, dst.) dari pasangan khusus A dan B.
- **Admin utama**: pemilik proyek. Hanya satu orang.
- **Asisten**: anggota dengan izin tambahan yang dicentang admin utama.

---

## 1. Prinsip Utama

1. **Tidak ada data sebelum login.** Database menolak semua permintaan tanpa sesi yang sah dari perangkat yang terdaftar.
2. **Tidak ada rahasia atau data keluarga di repo.** Hanya kode, skema SQL, dan data contoh fiktif. Versi library dipatok.
3. **Satu baris per data.** Orang, pernikahan, hubungan anak, kabar, jadwal, dan kas masing-masing punya tabel sendiri.
4. **Aplikasi tidak pernah menulis data bawaan.**
   - Gagal memuat → pesan error yang jelas + tombol "Coba lagi".
   - Database kosong → "Belum ada data, hubungi admin".
   - Project Supabase dijeda → "Aplikasi sedang dipulihkan".
5. **Tidak ada yang hilang tanpa disengaja.** Semua perubahan tercatat dan bisa dibatalkan. Menyisihkan data ("Sisihkan") hanya untuk kesalahan input. Hapus permanen hanya oleh admin utama, setelah snapshot otomatis.
6. **Tidak ada keturunan yang disembunyikan atau dihapus** hanya karena tidak punya anak atau sudah lama wafat.
7. **Data kontak dan lokasi diperlakukan paling ketat:** terenkripsi, dicatat setiap kali dibuka, tidak pernah disimpan offline, dan tidak pernah ikut cetakan atau notifikasi.
8. **Semua teks berbahasa Indonesia**, termasuk pesan error. Semua teks dikumpulkan di `src/teks/id.js`.
9. **Ramah untuk HP dan untuk orang tua**: huruf besar, kontras tinggi, tombol besar yang memakai teks + ikon.
10. **Identitas visual aplikasi lama dipertahankan** (acuan desain di bagian 15.5). Tampilan diperbaiki, bukan diganti total. Perubahan besar pada tampilan harus Anda setujui dulu.
11. **Setiap kelompok yang mengubah tampilan diakhiri dengan tinjauan Anda lewat mode contoh** (`npm run dev:contoh`) sebelum kelompok berikutnya dimulai. Laporan kelompok memuat alamat mode contoh dan daftar hal yang perlu diperiksa.
12. **Mode contoh selalu lengkap.** Setiap fitur baru **wajib** ditambahkan ke data contoh fiktif, termasuk data kontak, Kabar Keluarga, Kumpul Keluarga, dan foto saat fiturnya dibuat. Tes `src/contoh/kelengkapan.test.js` menjaga semua kasus yang sudah didukung; daftar "di mana menemukan setiap kasus" ada di README.

---

## 2. Langkah Darurat: Kunci Data Lama

### Status per 6 Oktober 2026

| Langkah | Status |
|---|---|
| 2.2 Kunci tabel lama (`000_kunci_tabel_lama.sql`) | ✅ Selesai, 8 pemeriksaan sesuai |
| 2.3 Matikan pendaftaran pengguna baru; daftar Users kosong | ✅ Selesai |
| 2.5 Repo lama privat, situs 404, fork = 0 | ✅ Selesai |
| 2.1 Verifikasi dua langkah (GitHub, Supabase, Google) | ⏳ **Ditunda.** Pengingat ⏰ B ada di Fase 1 sebelum langkah 1.30; harus selesai sebelum Fase 1 selesai. |
| 2.4 Ganti kunci API (publishable/secret baru, matikan kunci legacy, uji `curl`) | ✅ **Kunci sudah diganti (7 Oktober 2026).** Publishable key baru bernama `aplikasi_silsilah`, secret key baru bernama `server_silsilah`; kunci lama `default` (publishable dan secret) sudah dihapus; kunci versi lama (JWT-based anon/service_role) sudah dimatikan. Uji `curl` dengan kunci lama belum dikonfirmasi. |
| 2.4 langkah 4 / Security Advisor | ⏳ Belum dikonfirmasi. Dijalankan bersama uji `curl` kunci lama, paling lambat di langkah 1.29. |

Catatan: kunci anon lama sudah dimatikan. Isi kunci (baru maupun lama) **tidak pernah** ditulis di repo; di sini hanya nama kuncinya yang dicatat.

Panduan lengkap setiap langkah tetap disimpan di bawah ini sebagai rujukan.

### 2.1 Aktifkan verifikasi dua langkah (2FA) di akun Anda

1. **GitHub**: foto profil → Settings → Password and authentication → Two-factor authentication → Enable. Pakai aplikasi authenticator, lalu simpan *recovery codes* di pengelola kata sandi.
2. **Supabase**: foto profil (kiri bawah dashboard) → Account preferences → Security / Multi-factor authentication → Add new app. Pindai QR dengan authenticator yang sama.
3. **Google** (dipakai untuk login Supabase/GitHub, kalau ada): myaccount.google.com → Keamanan → Verifikasi 2 Langkah.

### 2.2 Kunci tabel lama

1. Dashboard Supabase → project **silsilah-keluarga** → **SQL Editor** → **New query**.
2. Buka file `supabase/000_kunci_tabel_lama.sql`, salin **seluruh** isinya, tempel, lalu tekan **Run**.
3. Di tabel hasil, kolom **hasil** harus sama dengan kolom **harus** di setiap baris. Kalau baris "Tabel lain di schema public TANPA RLS" berisi nama tabel, kirim namanya ke saya sebelum melanjutkan.
4. File ini **tidak menghapus data**. Isinya tetap bisa dilihat di Table Editor dan sudah ada backup CSV 5 Oktober 2026. File ini sudah saya uji di Postgres sementara dengan data palsu: hasilnya benar, dan aman dijalankan dua kali.

### 2.3 Matikan pendaftaran pengguna baru

1. Authentication → **Sign In / Providers** → matikan **"Allow new users to sign up"** → Save.
2. Authentication → **Users**: kalau ada pengguna yang tidak Anda kenal, hapus. Aplikasi lama tidak memakai login, jadi seharusnya kosong.

### 2.4 Ganti kunci API

Kunci anon lama sudah terbuka di repo publik lama, jadi kunci itu harus dimatikan.

1. Project Settings → **API Keys** → tab **"API Keys"** (yang baru):
   - Buat **Publishable key** (awalan `sb_publishable_…`) kalau belum ada. Kunci ini dipakai aplikasi baru dan boleh publik.
   - Buat **Secret key** (awalan `sb_secret_…`). Simpan **hanya** di pengelola kata sandi. Jangan ditempel ke chat, email, atau file di repo.
2. Tab **"Legacy API Keys"** → **Disable JWT-based API keys**. Setelah ini, kunci anon dan service_role lama tidak berlaku lagi. Ini tidak mengganggu project NUTRIHUB, karena kuncinya terpisah per project.
3. Uji di Terminal Mac. Ganti `<ref>` dengan kode project (terlihat di URL dashboard) dan `<KUNCI_ANON_LAMA>` dengan kunci lama:
   ```
   curl "https://<ref>.supabase.co/rest/v1/family_tree?select=id" -H "apikey: <KUNCI_ANON_LAMA>"
   ```
   Hasilnya harus berupa error (misalnya "Invalid API key" atau "permission denied"), **bukan data**.
4. Advisors → **Security Advisor** → Refresh. Tidak boleh ada peringatan "RLS disabled".

### 2.5 Jadikan repo lama privat

1. Buka repo `familytree` di GitHub → **Settings** → **General** → gulir ke **Danger Zone**.
2. **Change repository visibility** → **Make private** → ketik nama repo → konfirmasi.
3. Settings → **Pages**: di paket GitHub gratis, Pages untuk repo privat otomatis mati. Kalau situsnya masih tercantum, tekan **Unpublish site**.
4. Buka alamat situs lama di browser. Hasilnya harus 404.
5. Periksa **fork**: kalau sebelumnya ada orang lain yang mem-*fork* repo itu, fork-nya tetap publik. Lihat jumlah fork di halaman repo. Kalau ada, hubungi pemilik fork atau GitHub Support (formulir "sensitive data removal").
6. Mesin pencari: cari `site:<akun>.github.io familytree` di Google. Kalau masih muncul, gunakan alat **"Hapus konten usang"** di Google (search.google.com/search-console/remove-outdated-content), yang tidak memerlukan kepemilikan situs.
7. Repo lama **jangan dihapus dulu**. Biarkan privat sampai migrasi diverifikasi.

---

## 3. Arsitektur dan Teknologi

```
HP / laptop anggota
  └─ Aplikasi web (Vite + React, JavaScript), GitHub Pages, PWA
       ├─ supabase-js → Postgres (RLS + trigger + RPC), Realtime
       ├─ Edge Functions (Deno): undangan/kode perangkat, perkiraan lokasi login
       │   dari IP (database offline, tanpa pihak ketiga), kirim notifikasi push,
       │   membaca link lokasi pendek
       ├─ Storage (privat): foto bukti kas (Fase 2), foto keluarga (Fase 3)
       └─ Peta: Leaflet + ubin OpenStreetMap, pencarian tempat Nominatim

pg_cron di Supabase: snapshot, pengingat, antrean notifikasi, kedaluwarsa lokasi/akses
GitHub Actions:
  ├─ repo publik "silsilah": CI (oxlint, tes, pemindai data pribadi) + deploy Pages
  └─ repo PRIVAT "silsilah-cadangan": backup harian terenkripsi + uji pemulihan
```

**Mengikuti gaya proyek NUTRIHUB:**

- **Stack**: JavaScript (bukan TypeScript), Vite, React, React Router `HashRouter`, Tailwind CSS v4, ikon lucide-react, oxlint, Vitest, `vite-plugin-pwa` dengan `registerType: 'prompt'` dan banner "Versi baru tersedia".
- **Struktur folder**: `src/pages/`, `src/components/` (`ui/`, `layout/`, …), `src/hooks/`, `src/lib/`, `src/data/`. Tes diletakkan di sebelah filenya (`*.test.js`).
- **Database**: file SQL bernomor `supabase/001_….sql`, `002_….sql`. Setiap file:
  - diawali komentar penjelasan dalam bahasa Indonesia;
  - aman dijalankan ulang;
  - diakhiri **query pemeriksaan**;
  - dijalankan manual di SQL Editor;
  - kalau berisiko, disertai file `_ROLLBACK`.

  Tabel `app_migrations` mencatat file yang sudah dijalankan, dan aplikasi menolak berjalan dengan pesan jelas kalau database belum diperbarui.
- **Tes database tanpa Docker**: `supabase/migrations.test.js` menjalankan **semua** file SQL di PGlite (Postgres sungguhan di dalam Node). Bagian Supabase ditiru: role `anon`/`authenticated`, `auth.uid()`, `auth.jwt()` (termasuk `session_id` dan `aal`), schema `storage`, dan pembungkus untuk Vault. Semua RLS, trigger, dan RPC dites di sini. `pg_cron`/`pg_net` tidak ada di PGlite, jadi jadwal ditulis di file terpisah dan fungsi yang dipanggilnya dites langsung.
- **Edge Functions** di-*deploy* dengan Supabase CLI `supabase functions deploy --use-api` (tanpa Docker) atau lewat editor di dashboard. Logikanya dites dengan unit test.

**Perbedaan dari NUTRIHUB (disengaja):**

- Versi library **dipatok persis**: `.npmrc` berisi `save-exact=true`, tanpa `^`, `package-lock.json` di-commit, dan versi Node ada di `.nvmrc`.
- Kunci yang dipakai adalah *publishable key*, bukan anon key lama.

**Lingkungan pengembangan tanpa project kedua.** Batas Free adalah 2 project, dan keduanya sudah terpakai. Konsekuensinya:

- **Mode contoh**: `npm run dev` dengan `VITE_MODE_CONTOH=1` memakai lapisan data tiruan di memori dengan keluarga fiktif. Mode ini hanya ada di build pengembangan. Sebuah tes memastikan hasil build produksi tidak memuat mode contoh, sehingga aplikasi asli tidak pernah menulis data bawaan.
- **Database produksi sebagai staging sebelum migrasi**: sebelum data asli diimpor, tabel-tabel baru masih kosong. Uji coba di cloud dilakukan dengan data fiktif, lalu dibersihkan dengan skrip reset yang Anda periksa dulu. Setelah migrasi, setiap perubahan skema diawali snapshot otomatis.

**Siap ganti ke domain sendiri** (panduan di bagian 18):

- *Base path* hanya ditentukan di **satu tempat**: variabel `VITE_BASE_PATH` di `vite.config.js`. Manifest PWA, service worker, dan link undangan semuanya mengambil dari situ.
- Link undangan dan link kabar disusun dari alamat situs yang sedang dipakai, bukan alamat yang ditulis di kode.

Library utama (semua dipatok): `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `tailwindcss`, `lucide-react`, `d3-hierarchy` + `d3-zoom` (tata letak bagan), `leaflet` (peta), `qrcode` (QR tambah perangkat), `vite-plugin-pwa`, `@electric-sql/pglite` (tes), `vitest`, `oxlint`, serta library PDF berpassword (dipilih dan diuji di langkah 2.10).

---

## 4. Peran dan Izin

### 4.1 Peran

| Peran | Untuk siapa |
|---|---|
| **Hanya melihat** | Anggota dewasa yang hanya perlu membaca |
| **Anggota** | Keturunan/menantu dewasa yang boleh mengedit (bawaan) |
| **Asisten admin** | Anggota + izin tambahan yang dicentang per orang |
| **Admin utama** | Hanya satu orang (pemilik proyek). Tidak bisa diturunkan, dicabut, atau dikurangi wewenangnya oleh siapa pun lewat aplikasi; trigger database menolaknya. Penggantian admin utama hanya lewat SQL Editor oleh pemilik akun Supabase (prosedur darurat tertulis di README). |

**Tuan rumah** Kumpul Keluarga bukan peran tetap. Seseorang menjadi tuan rumah hanya untuk pertemuan di rumahnya.

### 4.2 Matriks hak

Keterangan: ✓ = boleh, ✗ = tidak, **izin** = hanya asisten yang dicentang izin itu.

| Hak | Hanya melihat | Anggota | Asisten | Admin utama |
|---|---|---|---|---|
| Melihat silsilah utama, mencetak/PDF per cabang | ✓ | ✓ | ✓ | ✓ |
| Melihat Kabar Keluarga dan jadwal Kumpul Keluarga | ✓ | ✓ | ✓ | ✓ |
| Melihat pohon keluarga asal | hanya yang diberi akses | hanya yang diberi akses | hanya yang diberi akses | ✓ |
| Menambah keturunan, pasangan, pernikahan, anak; mengedit data | ✗ | ✓ | ✓ | ✓ |
| Melihat riwayat perubahan | ✗ | ✓ | ✓ | ✓ |
| Membatalkan perubahan **sendiri** | ✗ | ✓ | ✓ | ✓ |
| Membatalkan perubahan **orang lain** | ✗ | ✗ | izin | ✓ |
| "Laporkan kesalahan" | ✗ | ✓ | ✓ | ✓ |
| Menindaklanjuti laporan | ✗ | ✗ | izin | ✓ |
| Menyisihkan data ("Sisihkan") dan memulihkannya | ✗ | ✗ | izin | ✓ |
| Hapus permanen (satu kelompok, atau semua data yang disisihkan) | ✗ | ✗ | ✗ | ✓ |
| Membuka data kontak (batas harian) | ✗ | ✓ (20) | ✓ (50) | ✓ (tanpa batas) |
| Menambah kuota harian data kontak | ✗ | ✗ | izin | ✓ |
| Mengunduh data kontak (PDF berpassword) | ✗ | ✗ | izin | ✓ |
| Menulis kabar dan komentar teks | ✗ | ✓ | ✓ | ✓ |
| Tanggapan singkat di kabar ("Aamiin", "Turut berduka", …) | ✓ | ✓ | ✓ | ✓ |
| Melihat daftar "bisa membantu" beserta jaraknya | ✗ | hanya penulis kabar itu | izin "Konfirmasi kabar" (atau penulis) | ✓ |
| Konfirmasi, sematkan, sembunyikan kabar; menerapkan kabar wafat ke silsilah | ✗ | ✗ | izin "Konfirmasi kabar" | ✓ |
| Mengisi kehadiran Kumpul Keluarga | ✓ | ✓ | ✓ | ✓ |
| Kelola jadwal Kumpul Keluarga | ✗ | ✗ | izin "Kelola jadwal" | ✓ |
| Menandai pernikahan berakhir karena berpisah (atau membatalkan tanda itu) | ✗ | hanya kalau ia salah satu dari kedua pasangan itu | izin "Status pernikahan" (atau salah satu pasangan) | ✓ |
| Memilih status "Belum menikah" | ✗ | hanya untuk dirinya sendiri | hanya untuk dirinya sendiri | hanya untuk dirinya sendiri |
| Kas dan sedekah (mencatat) | ✗ | ✗ | izin "Bendahara" | ✓ |
| Melihat kas: total pemasukan, pengeluaran, saldo, total per kategori, dan daftar pengeluaran (tanggal, keperluan, jumlah) | ✓ | ✓ | ✓ | ✓ |
| Melihat foto bukti kas | ✗ | ✗ | izin "Bendahara" | ✓ |
| Tombol "Bagikan ke grup WhatsApp" | ✗ | ✗ | izin | ✓ |
| Membuat link undangan (termasuk memutuskan "sudah dewasa" kalau tanggal lahir tidak diketahui) | ✗ | ✗ | izin | ✓ |
| Melihat daftar anggota dan aktivitas terakhir | ✗ | ✗ | izin | ✓ |
| Memberi akses sementara (≤ batas dari admin) | ✗ | ✗ | izin | ✓ |
| Mencabut akses anggota | ✗ | ✗ | ✗ | ✓ |
| Mengangkat/mencabut asisten dan mengatur izinnya | ✗ | ✗ | ✗ | ✓ |
| Pohon keluarga asal: membuat, mengubah, mengatur akses lihat | ✗ | ✗ | ✗ | ✓ |
| Pengaturan aplikasi | ✗ | ✗ | ✗ | ✓ |
| Backup: unduh dan pulihkan; ekspor seluruh data | ✗ | ✗ | ✗ | ✓ |
| Log lengkap termasuk aktivitas login | ✗ | ✗ | ✗ | ✓ |

**Daftar izin asisten** (kolom `members.permissions`, berupa centang):

`batalkan_orang_lain`, `tindak_laporan`, `sisihkan` (dulu `tempat_sampah`), `buat_undangan`, `lihat_anggota`, `akses_sementara`, `tambah_kuota_kontak`, `unduh_kontak`, `kelola_jadwal`, `bendahara`, `konfirmasi_kabar`, `bagikan_whatsapp`, `status_pernikahan` (menandai pernikahan orang lain berakhir karena berpisah; ditambahkan Oktober 2026).

**Aturan tambahan:**

- Anggota yang sedang **ditahan** karena aktivitas tidak wajar (bagian 8.6) tetap bisa membaca, tapi tidak bisa menulis.
- Fungsi admin hanya berlaku dengan sesi **terverifikasi dua langkah** (`aal2`, bagian 6.5). Tanpa itu, admin diperlakukan sebagai anggota biasa.

---

## 5. Struktur Database

### 5.1 Pembagian schema

- **`public`**: tabel yang dibaca aplikasi lewat API, dengan RLS aktif di semua tabel. Role `anon` tidak diberi hak apa pun. Hak default untuk tabel baru dicabut di file 001 (*secure by default*), dan setiap hak diberikan secara eksplisit.
- **`private`**: **tidak terbuka ke API sama sekali**. Isinya data kontak, token undangan/kode, lokasi anggota, snapshot, antrean notifikasi, dan log login. Aksesnya hanya lewat fungsi RPC `security definer` yang mengecek izin, mencatat, dan menghitung kuota.

### 5.2 Kolom bersama

Dipakai di tabel data utama (`people`, `unions`, `children`, `gatherings`, `cash_entries`, `news`):

| Kolom | Keterangan |
|---|---|
| `id` uuid PK | |
| `version` int | Dinaikkan trigger di setiap update. Dipakai untuk mendeteksi edit bersamaan. |
| `created_at/by`, `updated_at/by` | Diisi trigger dari anggota yang login, bukan dari klien. |
| `deleted_at/by`, `delete_batch` | Hanya di tabel yang datanya bisa disisihkan. |

### 5.3 Tanggal kabur

Setiap tanggal disimpan sebagai `*_y`, `*_m`, `*_d`, dan `*_approx`. Contoh: "12 Maret 1950", "Maret 1950", "1950", "sekitar 1950".

*Constraint*: bulan wajib ada tahun, hari wajib ada bulan, dan tanggal harus valid. Tanggal Hijriah ditambahkan di Fase 3.

### 5.4 Silsilah

**`people`** (orang)

| Kolom | Keterangan |
|---|---|
| `tree_id` | `null` = silsilah utama; terisi = pohon keluarga asal (→ `origin_trees`) |
| `full_name` | wajib |
| `nickname` | nama panggilan |
| `religious_title` | gelar religius: H., Hj., KH., Gus, dll. (label form: "(opsional)") |
| `academic_title` | gelar pendidikan (label form: "(opsional)") |
| `sex` | `'L' \| 'P'` |
| `birth_*`, `birth_place` | |
| `is_deceased`, `death_*`, `death_place` | Tampilan menambahkan **"Alm."** (laki-laki) atau **"Almh."** (perempuan) di depan nama secara otomatis. |
| `occupation` | pekerjaan; tanpa tulisan "opsional", tidak wajib |
| `notes` | catatan |
| `marital_choice` | status pernikahan yang dipilih **orangnya sendiri**; satu-satunya nilai: `'belum_menikah'`. Kosong = belum dipilih. Hanya orang itu yang boleh mengubahnya (trigger, SQL 005, kode SL011); aplikasi tidak pernah mengisinya sendiri. |
| `legacy_id` | id dari data lama, untuk menelusuri hasil migrasi |
| + kolom bersama | |

Alamat dan nomor HP **tidak** ada di sini, tetapi di `private.contacts` (bagian 7).

**`unions`** (pernikahan; satu baris untuk **setiap kali menikah**)

| Kolom | Keterangan |
|---|---|
| `tree_id` | |
| `partner1_id` | pihak garis keturunan |
| `partner2_id` | pasangan, boleh null ("tidak diketahui") |
| `status` | `'menikah' \| 'cerai' \| 'tidak_diketahui'`. "Wafat" dihitung dari `is_deceased`. Nilai `'cerai'` berarti pernikahan **berakhir karena berpisah** apa pun caranya (cerai resmi, cerai agama/adat, atau ditinggal tanpa kabar); tampilan **selalu** menulisnya "Berpisah", tidak pernah "cerai"/"bercerai". Mengubah status ke/dari `'cerai'` hanya oleh salah satu dari kedua pasangan (kalau anggota), admin utama, atau asisten dengan izin `status_pernikahan` (trigger, SQL 005, kode SL010). |
| `marriage_*`, `end_*` | |
| `sort_order` | urutan pernikahan ke-n |
| `notes` | |
| + kolom bersama | |

Pasangan yang sama **boleh** muncul di lebih dari satu baris, misalnya menikah lagi dengan istri ke-1. Tidak ada constraint unik untuk pasangan suami-istri. **Pernikahan baru tidak pernah ditolak** walaupun pernikahan sebelumnya belum ditandai berakhir (diperiksa ulang Oktober 2026: tidak ada aturan di SQL 003 dan sesudahnya yang memblokirnya; dijaga tes).

**Status pernikahan** di panel keterangan adalah **pilihan tetap** (bukan teks bebas): "Belum menikah", "Menikah", "Berpisah", "Ditinggal wafat pasangan" (`src/lib/silsilah/status.js`).

- Diturunkan otomatis dari data pernikahan: ada pernikahan yang masih berjalan → Menikah; kalau tidak, menurut pernikahan **terakhir**: berakhir karena berpisah → Berpisah; pasangannya wafat → Ditinggal wafat pasangan (kalau keduanya wafat, hanya yang pasangannya pasti wafat lebih dulu).
- Tanpa data pernikahan sama sekali → "-", **sampai orangnya sendiri memilih "Belum menikah"** (`marital_choice`). Aplikasi **tidak pernah** menulis "Belum menikah" secara otomatis. Data pernikahan selalu mengalahkan pilihan itu.
- Pilihan "Belum menikah" di form dibuat bersama form orang (langkah 1.23).

**`children`** (hubungan orang tua–anak)

| Kolom | Keterangan |
|---|---|
| `tree_id` | |
| `union_id`, `child_id` | |
| `kind` | `'kandung' \| 'sambung' \| 'angkat'` |
| `biological_parent` | `'keduanya' \| 'partner1' \| 'partner2' \| null`. Kandung = keduanya; anak sambung = salah satu (biasanya anak dari pasangan); angkat = null. Dipakai untuk menentukan "keturunan darah" (akses pohon keluarga asal). |
| + kolom bersama | |

**`birth_ranks`** (urutan lahir anak **kandung**, **per orang tua**)

| Kolom | Keterangan |
|---|---|
| `parent_id` | orang tua yang merupakan keturunan |
| `child_id` | |
| `rank` | urutan lahir |

Aturan urutan lahir (**diubah Oktober 2026**: sebelumnya anak sambung/angkat ikut dihitung):

- Dihitung **hanya di antara ANAK KANDUNG** orang tua itu, lintas semua pernikahan. Anak kandung = hubungan `kandung`, atau anak `sambung` yang `biological_parent`-nya adalah orang tua itu (misalnya anak seorang keturunan dari hubungan sebelumnya). **Anak sambung (dari pasangan) dan anak angkat tidak bernomor** dan tidak ikut jumlah "bersaudara" (`private.is_birth_parent` di SQL 003, `kandungUntuk` di `src/lib/silsilah/anak.js`).
- Terisi otomatis berdasarkan tanggal lahir saat anak ditambahkan, dan bisa diatur manual kalau tanggal tidak diketahui (geser naik/turun). Mengubah anak kandung menjadi anak angkat menghapus urutannya dan merapikan nomor saudaranya.
- Anak yang wafat saat bayi atau kecil tetap dihitung.
- Kalau **kedua** orang tua adalah keturunan (pernikahan antarsepupu), setiap anak punya **dua** baris, satu per orang tua. "Putra/Putri ke-n" pun dihitung untuk masing-masing orang tua.

*Constraint dan trigger* untuk silsilah:

- Satu hubungan kandung aktif per anak.
- Menolak siklus (seseorang tidak boleh jadi leluhur dirinya sendiri).
- Pasangan pangkal tidak boleh punya orang tua di silsilah utama.
- Semua baris dalam satu pernikahan atau hubungan harus berada di pohon yang sama. Satu-satunya pengecualian: hubungan "anak" yang menautkan pasangan khusus (yang ada di silsilah utama) ke orang tuanya di pohon keluarga asal. Baris itu milik pohon keluarga asal.
- Peringatan (bukan penolakan) kalau `birth_ranks` bertentangan dengan tanggal lahir yang diketahui.

**`origin_trees`** (pohon keluarga asal)

| Kolom | Keterangan |
|---|---|
| `id` | |
| `anchor_person_id` | pasangan khusus di silsilah utama; unik |
| `is_active` | sakelar, hanya admin utama |
| `grant_all_descendants` | lihat di bawah |
| `created_*` | |

**`origin_tree_access`**: `tree_id`, `member_id`, `mode` (`'izinkan' \| 'tolak'`), `granted_by`, `granted_at`.

Siapa yang boleh melihat pohon keluarga asal:

- admin utama; **atau**
- `mode = 'izinkan'`; **atau**
- `grant_all_descendants = true`, dan orang yang tertaut ke akun anggota itu adalah **keturunan darah** pasangan khusus tersebut, dan tidak ada `mode = 'tolak'` untuknya.

Tombol **"Beri akses ke semua keturunan [nama pasangan]"** menyalakan `grant_all_descendants`, sehingga cukup sekali klik.

- Aturannya **dinamis**: keturunan pasangan khusus yang lahir atau diundang **nanti** otomatis mendapat akses lihat.
- Admin utama tetap bisa mencabut akses per orang (`mode = 'tolak'`) atau menambahnya per orang (`mode = 'izinkan'`).
- Kedalaman pohon tidak dibatasi.
- Hanya admin utama yang bisa menulis ke baris dengan `tree_id` terisi.

**Istilah di pohon keluarga asal** dihitung dari sudut pandang **pasangan khusus itu sendiri** (`src/lib/kerabat.js`, dengan tes):

- Bapak, Ibu; Mbah (kakek/nenek) dan Mbah buyut;
- Kakak/Adik (dari urutan lahir);
- Pakdhe/Budhe (kakak dari bapak/ibu) dan Paklik/Bulik (adik dari bapak/ibu). Pasangan mereka mengikuti jenis kelaminnya, misalnya istri Pakdhe = Budhe;
- Keponakan, Sepupu, Ipar, dan seterusnya. Ke atas dari Mbah buyut: Mbah canggah, Mbah wareng (mengikuti istilah generasi), lalu ditulis dengan jalurnya ("Orang tua dari Mbah wareng").

Kalau urutan lahir tidak diketahui, aplikasi menampilkan "Pakdhe/Paklik". Hubungan yang tidak punya istilah baku ditampilkan dengan jalurnya, misalnya "Anak dari Sepupu".

**`settings`** (satu baris, hanya konfigurasi):

- `root_union_id`;
- istilah generasi: `["Pangkal","Anak","Putu","Buyut","Canggah","Wareng","Udheg-udheg","Gantung siwur","Gropak senthe","Debog bosok","Galih asem"]`. Mulai GEN.11 hanya ditampilkan "GEN.11", "GEN.12", dst., tanpa istilah;
- kuota kontak harian (anggota 20, asisten 50);
- batas akses sementara (bawaan 24 jam);
- `device_codes_enabled`;
- jam tenang notifikasi (21.00–06.00);
- batas kabar per orang per hari;
- radius "dekat" (km);
- ambang aktivitas tidak wajar;
- jam pengingat Kumpul Keluarga (07.00 dan 2 jam sebelum acara);
- ambang pengingat unduh backup;
- `login_digest_hourly` (ringkasan login per jam; bawaan mati);
- daftar negara "biasa" untuk deteksi login mencurigakan (bawaan: Indonesia, Italia).

**`app_migrations`**: nomor file SQL yang sudah dijalankan.

### 5.5 Akses dan perangkat

**`members`**

| Kolom | Keterangan |
|---|---|
| `id` | |
| `auth_user_id` | terisi saat undangan pertama kali dipakai |
| `person_id` | **wajib**: setiap anggota adalah keturunan atau menantu yang ada di silsilah |
| `display_name` | |
| `role` | `'lihat' \| 'anggota' \| 'asisten'` |
| `is_owner` | admin utama; unik, hanya satu baris yang `true` |
| `permissions` | text[] |
| `status` | `'aktif' \| 'dicabut'` |
| `hold_until`, `hold_reason` | penahanan otomatis |
| `last_seen_at`, `created_*`, `revoked_*` | |

Trigger menolak setiap perubahan pada baris admin utama, dan menolak `role = 'asisten'` atau `permissions` kalau yang mengubah bukan admin utama.

**`private.invites`**

| Kolom | Keterangan |
|---|---|
| `id` | |
| `member_id` | |
| `token_hash` | SHA-256; token asli tidak disimpan |
| `created_*` | |
| `expires_at` | 7 hari |
| `used_at`, `used_device_id` | |
| `revoked_*` | |

**`private.device_codes`**

| Kolom | Keterangan |
|---|---|
| `id`, `member_id` | |
| `code_hash` | |
| `kind` | `'tambah_perangkat' \| 'akses_sementara'` |
| `access_minutes` | durasi, untuk akses sementara |
| `created_by`, `created_from_device` | |
| `expires_at` | 10 menit |
| `used_at`, `attempts` | |

**`devices`** (satu baris per sesi login)

| Kolom | Keterangan |
|---|---|
| `id`, `member_id` | |
| `session_id` | dari JWT Supabase |
| `label` | misalnya "iPhone · Safari" |
| `via` | `'undangan' \| 'kode' \| 'google' \| 'sementara'` |
| `expires_at` | null = selamanya |
| `timezone` | |
| `device_type` | misalnya "iPhone", "Android", "Laptop Windows" |
| `approx_city`, `approx_country`, `approx_country_name` | perkiraan dari IP saat login (nama negara bahasa Indonesia dari Edge Function); **tanpa GPS/koordinat** |
| `created_at`, `last_seen_at`, `revoked_*` | |

**`private.auth_events`**: log lengkap. Hanya admin utama.

- Peristiwa yang dicatat: undangan dipakai/ditolak, kode dibuat/dipakai, akses sementara, login Google, perangkat dicabut, akses dicabut, verifikasi dua langkah, login mencurigakan.
- Setiap peristiwa menyimpan perkiraan kota, negara, jenis perangkat, dan waktu. Data ini disimpan seterusnya.

**`private.login_ips`**: `event_id`, `ip`, `at`.

- Alamat IP mentah, hanya untuk pemeriksaan keamanan.
- **Dihapus otomatis setelah 30 hari** oleh `pg_cron`.
- Hanya admin utama yang bisa melihatnya.

**`notifications`** (kotak masuk per anggota): `member_id`, `kind`, `title`, `body`, `link`, `priority`, `created_at`, `read_at`.

**`private.push_subscriptions`**: per perangkat. Dihapus saat logout atau saat perangkat dicabut.

**`private.notification_queue`**: `kind`, `audience`, `payload`, `not_before` (jam tenang), `priority`, `sent_at`, `attempts`.

**Fungsi bantu** (`security definer`):

- `current_member()`: anggota aktif milik `auth.uid()` **dan** sesi (`session_id`) yang tercatat di `devices`, belum dicabut, dan belum kedaluwarsa.
- `can_edit()`: role ≠ lihat dan tidak sedang ditahan.
- `has_perm(izin)`: admin utama selalu `true`.
- `is_owner()`: `is_owner = true` **dan** `aal = 'aal2'`.
- `can_view_origin(tree)`.
- `can_reveal_contacts()`: role ≠ lihat dan bukan anak di bawah umur.

Dengan pengecekan perangkat di setiap query, **mencabut satu perangkat langsung menutup data di perangkat itu**, walaupun token login di perangkat itu belum kedaluwarsa.

### 5.6 Riwayat, laporan, dan cadangan

- **`change_log`**: bagian 8.1.
- **`reports`**: laporan kesalahan.

  | Kolom | Keterangan |
  |---|---|
  | `target_table`, `target_id` | |
  | `reason` | `'data_salah' \| 'data_ganda' \| 'salah_cabang' \| 'kabar_keliru' \| 'lainnya'` |
  | `message`, `reporter` | |
  | `status` | `'baru' \| 'diproses' \| 'selesai' \| 'ditolak'` |
  | `handled_by`, `handled_note` | |
- **`private.snapshots`**: bagian 9.1.
- **`backup_status`**: hasil backup GitHub terakhir (ditulis workflow) dan kapan admin terakhir mengunduh.

### 5.7 Data kontak

Rinciannya ada di bagian 7.

- **`private.contacts`**: `person_id` PK, `address_enc`, `phone_enc`, `phone_hash`, `region_name`, `region_province`, `region_lat/lng`, `version`, `updated_*`.
- **`private.contact_reveals`**: `viewer`, `person_id`, `at`, `day` (WIB), `via`.
- **`private.contact_quota_grants`**: `member_id`, `day`, `extra`, `granted_by`.
- **`private.contact_exports`**: `member_id`, `at`, `count`. Password tidak pernah disimpan.

### 5.8 Kumpul Keluarga (Fase 2)

**`gatherings`**

| Kolom | Keterangan |
|---|---|
| `starts_at` | timestamptz, WIB |
| `ends_at` | perkiraan selesai (bawaan: `starts_at` + 3 jam, bisa diubah) |
| `host_member_ids` | uuid[] |
| `host_label` | |
| `address` | **dihapus otomatis paling lambat 12 jam setelah `ends_at`** |
| `lat`, `lng` | ikut dihapus bersama alamat |
| `directions` | petunjuk jalan; ikut dihapus bersama alamat |
| `address_cleared_at` | kapan alamat dihapus; arsip hanya menampilkan "di rumah [tuan rumah]" |
| `speaker` | penceramah |
| `theme` | tema pengajian |
| `readings` | text[]: tahlil, Yasin, … |
| `notes` | |
| `status` | `'rencana' \| 'terjadwal' \| 'siap' \| 'selesai' \| 'batal'` |
| `host_confirmed_at` | |
| + kolom bersama | |

- **`gathering_rsvps`**: (`gathering_id`, `member_id`) PK, `answer` (`'hadir' \| 'tidak' \| 'belum_pasti'`), `people_count`.
- **`gathering_swaps`**: `from_gathering`, `to_gathering`, `requested_by`, `reason`, `status` (`'diajukan' \| 'disetujui' \| 'ditolak'`), `decided_by`.
- **`cash_entries`**:

  | Kolom | Keterangan |
  |---|---|
  | `month` | |
  | `gathering_id` | |
  | `direction` | `'masuk' \| 'keluar'` |
  | `category` | masuk: `'sedekah_pertemuan' \| 'lainnya'`; keluar: `'konsumsi' \| 'santunan' \| 'duka' \| 'sosial' \| 'lain_lain'` |
  | `amount` | rupiah, bilangan bulat > 0 |
  | `entry_date`, `description` | |
  | + kolom bersama | |

  **Tidak ada kolom untuk jumlah per orang.**
- **`cash_periods`**: `month` PK, `closed_at`, `closed_by`. Selama bulan itu tertutup, trigger menolak insert/update/hapus. Membuka kembali hanya oleh admin utama, dengan alasan, dan tercatat.
- **`cash_proofs`**: `entry_id`, `storage_path` (bucket privat `bukti-kas`). Hanya bendahara dan admin.
- **View `cash_summary`**: total per bulan dan per tahun (masuk, keluar, saldo) dan **total per kategori**. Bisa dibaca semua anggota.
- **View `cash_expenses_public`**: daftar pengeluaran (tanggal, keperluan, kategori, jumlah), **tanpa** foto bukti. Bisa dibaca semua anggota.

### 5.9 Kabar Keluarga (Fase 2)

**`news`**

| Kolom | Keterangan |
|---|---|
| `kind` | `'gembira' \| 'duka' \| 'darurat' \| 'umum'` |
| `subtype` | pernikahan, kelahiran, khitanan, wisuda, meninggal, kecelakaan, sakit_keras, bencana, lainnya |
| `title`, `body` | |
| `event_at`, `event_place_text` | |
| `burial_at`, `burial_place` | pemakaman |
| `tahlil_info` | |
| `help_needed` | bantuan yang dibutuhkan |
| `pinned` | |
| `status` | `'aktif' \| 'selesai' \| 'ditarik' \| 'disembunyikan'` |
| `confirmed_at/by` | |
| `author_member_id` | |
| + kolom bersama | |

- **`news_people`**: orang terkait (tertaut ke kartu silsilah).
- **`news_locations`**: lokasi **kejadian** beserta riwayatnya.

  | Kolom | Keterangan |
  |---|---|
  | `lat`, `lng` | |
  | `source` | `'gps_penulis' \| 'peta' \| 'link' \| 'alamat' \| 'anggota_di_lokasi'` |
  | `place_label`, `address_note` | |
  | `is_primary` | |
  | `set_by`, `at` | |

  Lokasi `anggota_di_lokasi` hanya terlihat oleh penulis, admin, dan asisten sampai dijadikan lokasi utama.
- **`news_reactions`**, **`news_comments`** (bisa disembunyikan), **`news_helpers`** ("Saya bisa membantu").
- **`private.member_locations`**: lokasi yang dibagikan anggota.

  | Kolom | Keterangan |
  |---|---|
  | `member_id` | |
  | `news_id` | konteks |
  | `lat`, `lng`, `accuracy_m` | |
  | `distance_km` | jarak ke lokasi kejadian, dihitung saat dibagikan dan saat lokasi kejadian diperbarui; **tetap disimpan** setelah koordinat dihapus, supaya daftar "bisa membantu" tetap menampilkan "±3 km" |
  | `shared_at` | |
  | `expires_at` | **12 jam** setelah dibagikan, atau lebih cepat kalau kabar ditandai selesai; setelah itu koordinat dihapus |

  Selama 12 jam itu, koordinat juga boleh dipakai **diam-diam** untuk menentukan anggota yang "dekat" pada kabar duka/darurat **baru**, tanpa pernah ditampilkan.
- **`private.member_whereabouts`**: status "Sedang berada di …".

  | Kolom | Keterangan |
  |---|---|
  | `member_id` | PK |
  | `place_name` | |
  | `lat`, `lng` | titik tengah kota |
  | `until_date` | dihapus otomatis sesudahnya |
- **`pending_tree_updates`**: perubahan silsilah dari kabar wafat (`is_deceased`, tanggal/tempat wafat) dengan status `'menunggu' \| 'diterapkan' \| 'ditolak'`.

### 5.10 Ringkasan RLS

| Data | Baca | Tulis |
|---|---|---|
| Silsilah utama (`tree_id` null) | `current_member()` | `can_edit()`. Hapus = RPC sisihkan (izin). Hapus permanen = RPC admin utama. Tambahan (trigger SQL 005): status pernikahan berakhir karena berpisah hanya oleh salah satu pasangan, admin utama, atau izin `status_pernikahan`; `marital_choice` hanya oleh orangnya sendiri. |
| Pohon keluarga asal | `can_view_origin()` | admin utama |
| `change_log` | anggota, asisten, admin (bukan "lihat") | hanya trigger |
| `members` | baris sendiri; daftar lengkap: izin `lihat_anggota`; nama tampilan lewat fungsi `member_names()` | admin utama (undangan: izin `buat_undangan`, lewat RPC) |
| `devices` | perangkat sendiri; admin semua | RPC (dari Edge Function); cabut: pemilik perangkat atau admin |
| `notifications` | milik sendiri | sistem; tandai dibaca: pemilik |
| `reports` | pelapor (miliknya), izin `tindak_laporan` | anggota (buat); izin (tindak lanjut) |
| `gatherings` | semua anggota | izin `kelola_jadwal`. Tuan rumah lewat RPC, hanya kolom detail (pin, jam, petunjuk, catatan), konfirmasi, dan ajukan tukar. |
| `gathering_rsvps` | semua anggota (termasuk daftar nama yang hadir) | baris sendiri (semua peran, termasuk "lihat") |
| `cash_entries` | izin `bendahara`, admin | izin `bendahara`, dan hanya untuk bulan yang belum ditutup |
| `cash_proofs`, Storage `bukti-kas` | izin `bendahara`, admin | izin `bendahara` |
| `cash_summary`, `cash_expenses_public` | semua anggota | — |
| `news`, `news_comments` | semua anggota (yang disembunyikan: penulis, admin, asisten) | tulis: `can_edit()` + batas harian; edit/tarik: penulis; konfirmasi/sematkan/sembunyikan: izin `konfirmasi_kabar` |
| `news_reactions` | semua anggota | baris sendiri (semua peran, termasuk "lihat") |
| Daftar "bisa membantu" + jarak (RPC) | penulis kabar itu, izin `konfirmasi_kabar`, admin; anggota lain hanya jumlahnya | `news_helpers`: baris sendiri (bukan "lihat") |
| `settings` | anggota | admin utama |
| Schema `private` | tidak ada akses langsung | hanya lewat RPC yang mengecek izin, mencatat, dan menghitung kuota |
| Storage `bukti-kas` | izin `bendahara`, admin | izin `bendahara` |
| `family_tree` (lama) | **terkunci** (langkah 2.2) | — |

Semua kebijakan dites di PGlite dengan matriks lengkap: anon, bukan anggota, anggota dicabut, perangkat dicabut, perangkat kedaluwarsa, lihat, anggota, asisten dengan dan tanpa izin, admin tanpa `aal2`, dan admin dengan `aal2`.

---

## 6. Undangan, Perangkat, dan Login

### 6.1 Cara kerja teknis

1. **Membuat undangan** (admin, atau asisten dengan izin `buat_undangan`) lewat RPC:
   - Pilih orang di silsilah. Undangan hanya untuk **keturunan atau menantu yang sudah dewasa**: **berusia 18 tahun ke atas ATAU sudah menikah** (punya baris di `unions`). Anak di bawah umur ditolak.
   - Kalau tanggal lahir tidak diketahui dan orangnya belum tercatat menikah, pembuat undangan (admin, atau asisten dengan izin `buat_undangan`) harus mencentang "Saya pastikan orang ini sudah dewasa". Keputusan itu tercatat.
   - Pilih peran: lihat atau anggota.
   - Sistem membuat token acak 32 byte dan menyimpan **hash**-nya. Link `https://…/#/u/<token>` **hanya ditampilkan sekali**.
2. **Menukar undangan** (Edge Function `pakai-undangan`). Proses ini berjalan **hanya setelah orang itu menekan tombol "Masuk"**, bukan saat halaman dibuka. Dengan begitu, pratinjau link di WhatsApp atau browser tidak menghabiskan link sekali pakai.
   - Cek: undangan belum dipakai, belum kedaluwarsa (7 hari), dan belum dicabut.
   - Buat akun Auth (email sintetis, tidak ada email terkirim), lalu `generateLink({type:'magiclink'})` → `token_hash`.
   - Kembalikan juga **tiket klaim perangkat** sekali pakai.
   - Undangan ditandai **sudah dipakai**. Siapa pun yang membuka link itu lagi melihat "Link sudah dipakai", dan admin mendapat notifikasi percobaan tersebut.
3. Aplikasi memanggil `verifyOtp(token_hash)` sehingga sesi terbentuk, lalu `klaim_perangkat(tiket)` mendaftarkan `session_id` di `devices`. **Sesi tanpa klaim perangkat tidak bisa membaca apa pun.** Token dihapus dari address bar.
4. **Login diingat selamanya** sampai keluar, dicabut, atau masa akses sementara habis. Sesi Supabase diperbarui otomatis.
5. **Tambah perangkat**:
   - Di aplikasi yang sudah login: menu Saya → "Tambah perangkat" → tampil **QR + kode 8 karakter**, berlaku 10 menit, sekali pakai.
   - Perangkat baru memindai QR (membuka link `#/kode/…`) atau mengetik kode di layar Masuk. Prosesnya sama seperti undangan, lewat Edge Function `pakai-kode`.
   - Percobaan kode salah dibatasi.
   - Admin bisa mematikan fitur ini secara global.
6. **Akses sementara** (admin, atau asisten dengan izin `akses_sementara`):
   - Pilih anggota dan durasi (30 menit sampai batas admin, bawaan maksimal 24 jam) → kode/QR.
   - Perangkat yang memakainya mendapat `devices.expires_at`, dan **RLS menolak akses setelah waktunya habis**.
   - Aplikasi menampilkan hitung mundur. Saat habis, aplikasi otomatis keluar dan **menghapus semua data lokal**. Kalau perangkat sedang mati, data dihapus saat aplikasi dibuka lagi; data juga tidak bisa diambil ulang karena RLS sudah menolak.
   - Setiap pemberian tercatat, dan admin utama mendapat notifikasi.
7. **Notifikasi login baru** ke admin utama:
   - **Bawaan: satu per satu.** Contoh: "Budi baru masuk · iPhone · sekitar Semarang, Indonesia · 14.05".
   - Admin bisa menyalakan atau mematikan **"ringkasan per jam"** kapan saja di Pengaturan aplikasi, misalnya saat peluncuran.
   - **Login mencurigakan selalu dikirim langsung**, walaupun mode ringkasan menyala, dengan tombol **"Cabut perangkat ini"**. Yang dianggap mencurigakan:
     - login dari negara di luar daftar negara biasa (bawaan Indonesia dan Italia, bisa diubah) **dan** di luar negara yang pernah dipakai anggota itu dalam 90 hari terakhir;
     - permintaan dari perangkat atau sesi yang **sudah dicabut**;
     - percobaan memakai link undangan yang sudah dipakai;
     - banyak percobaan kode perangkat yang salah.
8. **Perkiraan lokasi login dari alamat IP**:
   - **Hanya kota/negara perkiraan**, ditambah jenis perangkat dan waktu. **Tidak ada GPS atau koordinat** saat login.
   - Alamat IP dibaca oleh Edge Function yang menangani login (undangan, kode, Google, dan pemeriksaan perangkat saat aplikasi dibuka).
   - Lokasi dicari di **database lokasi IP offline: DB-IP "IP to City Lite"** (gratis, lisensi CC BY 4.0, atribusi ditampilkan di halaman Privasi). **IP tidak dikirim ke pihak ketiga.**
     - Supaya muat di Edge Function, data tingkat kota hanya diambil untuk negara-negara dalam daftar negara biasa. Negara lain cukup tingkat negara.
     - Data diperbarui otomatis sebulan sekali oleh workflow di repo privat dan disimpan di Storage privat.
     - **Hasil uji langkah 1.16 (7 Oktober 2026):** kota untuk semua negara ±76 MB, melebihi batas file Storage paket gratis (50 MB) dan terlalu berat untuk Edge Function. Sesuai keputusan pemilik: **kota untuk Indonesia dan Italia, negara untuk negara lain** (±6,9 MB, ±2,6 MB terkompresi; dimuat ±60 ms, ±54 MB memori). Data IPv6 dicatat per blok /64.
   - **IP mentah disimpan maksimal 30 hari** di `private.login_ips` lalu dihapus otomatis. Yang disimpan seterusnya hanya kota, negara, jenis perangkat, dan waktu.
   - Semua ini dijelaskan di halaman **Privasi** aplikasi (bahasa Indonesia).
   - Catatan jujur: perkiraan kota dari IP sering meleset, terutama di jaringan seluler Indonesia (bisa selalu tampil "Jakarta"). Karena itu label selalu ditulis "sekitar …".
9. **Daftar perangkat**:
   - Anggota: "Perangkat saya", bisa mencabut perangkatnya sendiri.
   - Admin: daftar perangkat per orang, bisa mencabut perangkat mana pun.
10. **Masuk dengan Google** (opsional): anggota yang sudah login bisa memilih "Hubungkan akun Google" (manual linking). Pendaftaran baru dimatikan, sehingga Google hanya berlaku untuk akun yang sudah terdaftar. Setiap login Google tetap mendaftarkan perangkat dan memicu notifikasi admin.
11. **Cabut akses anggota** (admin utama): `members.status = 'dicabut'`, semua perangkat dicabut, semua link/kode dibatalkan, dan akun Auth diblokir.
12. **Browser di dalam aplikasi lain** (misalnya browser bawaan Instagram atau Facebook) dikenali. Aplikasi meminta orang itu membuka link di Chrome/Safari **sebelum** link dipakai, supaya link sekali pakai tidak "tertinggal" di tempat yang salah.

### 6.2 Dari sudut pandang anggota keluarga

**Pertama kali**

1. Bu Wulan (contoh fiktif) menerima WhatsApp dari admin:
   > Assalamu'alaikum Bu Wulan, ini link pribadi untuk membuka Silsilah Keluarga. Link ini hanya bisa dipakai sekali dan berlaku 7 hari. Mohon jangan diteruskan ke orang lain.
2. Ia mengetuk link. Muncul halaman berhuruf besar: "Link undangan pribadi. Tekan **Masuk** untuk melanjutkan." Tidak ada nama atau data sebelum tombol ditekan.
3. Ia menekan **Masuk**. Muncul "Selamat datang, Bu Wulan!" dan kartunya: "Apakah ini Anda? [Ya] [Bukan]". Kalau ia memilih "Bukan", admin langsung diberi tahu.
4. Tips singkat: memperbesar huruf, mengizinkan notifikasi, memasang di layar utama, dan cara menambah perangkat.
5. Ia masuk ke **Cabang saya**.

**Hari berikutnya**: ia membuka ikon atau situs dan langsung masuk.

**HP atau tablet kedua**: di HP pertama ia membuka Saya → **Tambah perangkat**. Di HP kedua ia memindai QR dengan kamera, atau membuka situs dan memilih "Masuk dengan kode", lalu mengetik kodenya.

**iPhone setelah "Tambahkan ke Layar Utama"**: iOS memisahkan login Safari dan aplikasi layar utama. Ia membuka ikon baru → "Masuk dengan kode", lalu di Safari (yang masih login) membuka Tambah perangkat dan menyalin kodenya. Panduan bergambar disediakan.

**Meminjam laptop atau HP orang lain**: ia meminta akses sementara ke admin/asisten dan mengetik kodenya. Banner menunjukkan "Akses sementara berakhir pukul 15.30". Setelah itu aplikasi keluar sendiri dan data di perangkat itu terhapus.

**Pesan-pesan yang mungkin muncul**:

- **Link sudah dipakai**: "Link ini sudah dipakai. Kalau Anda belum pernah masuk, hubungi admin keluarga."
- **Link kedaluwarsa**: "Link ini sudah kedaluwarsa. Mintalah link baru kepada admin."

**HP hilang**: dari perangkat lain ia membuka Perangkat saya → Cabut. Kalau tidak punya perangkat lain, ia menghubungi admin, yang mencabut perangkat itu dan mengirim link baru.

**Keluar**: tersedia "Keluar dari perangkat ini" dan "Keluar dari semua perangkat". Saat keluar, semua data di perangkat itu dihapus.

### 6.3 Dari sudut pandang admin

1. Buka Anggota → **Undang**.
2. Pilih orang dari silsilah (hanya keturunan/menantu dewasa yang bisa dipilih) dan pilih peran.
3. Tekan **Buat link**.
4. Tekan **Kirim lewat WhatsApp**. Ini membuka WhatsApp di HP admin dengan pesan yang sudah terisi, ke nomor orang itu kalau tersimpan; membuka nomor itu dihitung sebagai pembukaan kontak. Bisa juga **Salin link**.

Link yang belum dipakai bisa dicabut atau dibuat ulang. Daftar anggota menampilkan status undangan (belum dipakai / dipakai / kedaluwarsa), perangkat aktif, dan kapan terakhir aktif.

### 6.4 Pemeriksaan akses berkala

Setiap bulan admin utama mendapat daftar anggota yang **tidak aktif lebih dari 1 tahun**, dengan saran "Cabut akses" atau "Biarkan". Tidak ada yang dicabut otomatis.

### 6.5 Akun admin utama

- Masuk seperti anggota lain, lalu **verifikasi dua langkah wajib**: TOTP (kode 6 angka dari aplikasi authenticator, misalnya aplikasi Kata Sandi di iPhone yang dibuka dengan Face ID).
- **Passkey/Face ID langsung** dipakai kalau Supabase Auth sudah mendukung WebAuthn saat langkah 1.19 dikerjakan. **Dicek di langkah 1.19 (7 Oktober 2026):** passkey Supabase masih **beta** (diumumkan 28 Mei 2026, API eksperimental yang bisa berubah), jadi belum dipakai; TOTP tetap wajib. Kode pemulihan bawaan Supabase juga masih eksperimental, jadi tidak dipakai.
- Sesi admin tanpa verifikasi dua langkah (`aal1`) **tidak bisa** menjalankan fungsi admin. Aplikasi juga mengunci semua layar `/admin/…` (gerbang `KhususAdmin`).
- Pengganti kode pemulihan (langkah 1.19): **dua authenticator** (utama + cadangan), dan **prosedur darurat** dari SQL Editor (`supabase/darurat/`, SQL 013) yang menghapus semua authenticator, mengakhiri semua perangkat/sesi admin utama, lalu membuat satu link masuk baru. Authenticator yang ditambah/dihapus dilaporkan ke kotak masuk admin utama (jadwal setiap 10 menit).

**Pengingat untuk Anda:** aktifkan juga verifikasi dua langkah untuk **akun Supabase** dan **akun GitHub** (langkah 2.1). Akun-akun itu adalah kunci utama ke seluruh data.

---

## 7. Data Kontak (Alamat dan Nomor HP)

1. **Penyimpanan**: tabel `private.contacts`, tidak terbuka ke API.
   - Alamat dan nomor HP **dienkripsi** dengan `pgcrypto`. Kuncinya ada di **Supabase Vault** dan dibuat otomatis oleh SQL, sehingga Anda tidak perlu memegangnya.
   - Kolom yang **tidak** dienkripsi hanyalah wilayah (kabupaten/kota + provinsi) beserta titik tengahnya. Kolom ini dibutuhkan untuk pencarian wilayah dan perkiraan "dekat".
   - Nomor HP juga disimpan sebagai **hash berkunci** (dinormalisasi ke format 62…), untuk pencarian berdasarkan nomor.
   - Catatan jujur: enkripsi melindungi dari kebocoran tabel, snapshot, atau RLS yang keliru. Enkripsi tidak melindungi dari orang yang memegang akses penuh database, yaitu hanya Anda.
2. **Siapa yang bisa membuka**: semua anggota yang bisa mengedit (anggota, asisten, admin). **Tidak bisa** oleh anggota "hanya melihat", dan tidak bisa oleh akun yang orangnya masih di bawah umur. Tidak ada pengaturan "hanya admin" per pemilik data.
3. **Tampilan**:
   - Tertutup ("••••") sampai diketuk **Tampilkan**.
   - Tampil **30 detik**, lalu tertutup lagi.
   - Selama tampil ada tanda air samar "Dibuka oleh [nama] · [tanggal jam]".
   - Saat mengedit, tersedia tombol **Ganti** tanpa harus membuka isi lama.
4. **Pencatatan**: setiap pembukaan dicatat (siapa membuka data siapa, kapan). Riwayat perubahan kontak hanya mencatat "mengubah nomor HP", **tanpa isinya**.
5. **Batas harian** dihitung **per orang yang dibuka**: HP + alamat orang yang sama dihitung 1, dan membuka orang yang sama lagi di hari yang sama tidak dihitung ulang.
   - Batas bawaan: anggota 20, asisten 50, admin tanpa batas. Angka ini bisa diubah admin.
   - Hari dihitung dalam WIB, dan kuota direset pukul 00.00 WIB.
6. **Kalau batas terlampaui**:
   - Pembukaan berikutnya ditahan, sedangkan bagian aplikasi lain tetap berjalan.
   - Admin utama mendapat notifikasi (sekali per orang per hari) dengan empat tombol:
     - **Lihat siapa saja yang dibuka**;
     - **Tambah kuota hari ini** (jumlah diisi bebas; asisten dengan izin juga bisa);
     - **Biarkan** (terbuka lagi otomatis pukul 00.00);
     - **Cabut akses**.
7. **Tidak pernah** ikut ke PDF, cetakan, ekspor biasa, penyimpanan offline, notifikasi, atau snapshot dalam bentuk terbaca. Di snapshot, kontak tetap berupa teks terenkripsi.
8. **Unduh data kontak** (admin, atau asisten dengan izin `unduh_kontak`):
   - Tanpa konfirmasi ulang.
   - PDF dibuat **di perangkat** dan dikunci dengan **password acak per unduhan**. Password ditampilkan sekali dengan tombol **Salin** dan tidak pernah dikirim ke server atau disimpan.
   - Unduhan dicatat, dan admin utama mendapat notifikasi kalau asisten yang mengunduh.
9. **Pencarian**:
   - Berdasarkan **wilayah**: menampilkan nama orang di wilayah itu.
   - Berdasarkan **nomor HP**: menampilkan nama pemilik nomor.
   - Keduanya hanya untuk yang boleh membuka kontak, tidak menampilkan isi kontak, dan tidak memotong kuota, tetapi dicatat dan dibatasi jumlahnya. Admin bisa mencari semuanya.

---

## 8. Riwayat, Undo, Laporan, Data yang Disisihkan, dan Edit Bersamaan

### 8.1 Riwayat (`change_log`)

Trigger pada semua tabel data menulis satu baris per perubahan:

| Kolom | Isi |
|---|---|
| `at` | waktu |
| `actor_member_id` | pelaku |
| `table_name`, `row_id` | |
| `op` | `tambah \| ubah \| hapus \| pulihkan \| hapus_permanen` |
| `old_row`, `new_row` | |
| `changed_fields` | |
| `batch_id` | satu aksi pengguna (misalnya tambah anak = orang + hubungan) |
| `undo_of` | |

Klien tidak bisa menulis atau mengubah riwayat. Ada dua pengecualian:

- **Data kontak**: isi lama dan baru tidak pernah ditampilkan; yang disimpan hanya teks terenkripsi.
- **Alamat, pin, dan petunjuk jalan pertemuan**: riwayat hanya mencatat "alamat diubah" **tanpa isinya**, supaya alamat tuan rumah tidak tertinggal di riwayat setelah dihapus 12 jam pasca-acara.

### 8.2 Undo per perubahan

- **Anggota** hanya bisa membatalkan **perubahannya sendiri**. Membatalkan perubahan orang lain hanya untuk asisten dengan izin `batalkan_orang_lain` dan admin.
- Undo berlaku untuk satu batch utuh. Undo ditolak kalau data sudah diubah lagi sesudahnya: "Data ini sudah diubah lagi oleh Ratna pada 14.20."
- Undo untuk "tambah" berarti menyisihkan data itu. Undo sendiri juga tercatat, sehingga bisa dibatalkan lagi.
- Setelah setiap simpan muncul *toast* "Tersimpan. [Batalkan]".

### 8.3 Laporkan kesalahan

- Anggota biasa **tidak bisa menghapus apa pun**. Di setiap kartu, detail, dan kabar ada tombol **"Laporkan kesalahan"** dengan pilihan alasan (data salah, data ganda, salah cabang, lainnya) dan pesan.
- Asisten dengan izin `tindak_laporan` dan admin menerima notifikasi. Mereka menindaklanjuti dengan memperbaiki, memindahkan anak ke orang tua yang benar, atau menyisihkan data yang salah input, lalu menutup laporan. Pelapor diberi tahu hasilnya.

### 8.4 Data yang disisihkan

**Istilah (Oktober 2026):** kata "tempat sampah" tidak dipakai di tulisan mana pun karena kurang sopan untuk data keluarga. Tombolnya **"Sisihkan"**, layarnya **"Data yang disisihkan"**, izinnya `sisihkan`, dan file SQL-nya `007_disisihkan_laporan.sql`. Nama fungsi teknis (`move_to_trash`, `empty_trash`) tetap, karena tidak pernah tampil.

- **Hanya untuk kesalahan input** (data ganda, salah cabang). Keturunan yang sah tidak pernah disisihkan. Aplikasi mengingatkan hal ini di dialog "Sisihkan".
- **Menyisihkan dan memulihkan**: asisten dengan izin `sisihkan` dan admin. Orang yang masih punya keturunan aktif tidak bisa disisihkan sebelum anak-anaknya dipindahkan.
- **Hapus permanen** (satu kelompok, atau semua data yang disisihkan sekaligus): **hanya admin utama**, dengan konfirmasi mengetik "HAPUS". Sebelumnya dibuat snapshot otomatis.
- Salah cabang biasanya diperbaiki dengan **"Pindahkan ke orang tua lain"**. Ini dihitung edit biasa, jadi anggota bisa melakukannya, dan perubahan itu tercatat serta bisa dibatalkan.

### 8.5 Edit bersamaan dan sinkron live

- Data dimuat sekali, lalu sinkron live (Realtime). Saat aplikasi aktif kembali atau internet tersambung lagi, data diambil ulang.
- Peringatan "Data ini baru saja diubah oleh Ratna 3 menit lalu" muncul saat membuka form. Banner muncul kalau ada perubahan saat sedang mengedit.
- Saat menyimpan, aplikasi hanya mengirim kolom yang diubah, dengan syarat `version` masih sama. Kalau berbeda, dilakukan merge per kolom: kolom yang bentrok ditampilkan "Versi Anda" berdampingan dengan "Versi Ratna" untuk dipilih.
- Tidak ada penulisan saat offline.
- **Ditetapkan di langkah 1.20:** semua data silsilah dimuat per halaman (batas 1.000 baris per permintaan di Supabase), hanya dengan kolom yang terdaftar di `src/lib/data/kolom.js`. Realtime menghormati RLS, sehingga baris yang disisihkan tidak pernah "terkirim" ke anggota biasa; karena itu SQL 014 menambah tabel penanda `sync_removals` (hanya nama tabel + id, tanpa isi, dihapus sendiri setelah 1 hari). Data diambil ulang saat sambungan live pulih, saat internet tersambung lagi, dan saat aplikasi dibuka kembali setelah lebih dari 1 menit. Perubahan akses pohon keluarga asal baru terlihat setelah data diambil ulang.

### 8.6 Deteksi aktivitas tidak wajar

Trigger menghitung aktivitas per anggota. Ambang bawaan (bisa diubah admin):

- lebih dari 30 perubahan dalam 10 menit;
- lebih dari 10 laporan atau kabar dalam 1 jam;
- banyak pencarian nomor dalam waktu singkat.

Kalau ambang terlampaui:

1. Anggota itu **ditahan**: hanya bisa membaca. Ia melihat pesan "Perubahan Anda sedang ditinjau admin".
2. Admin utama mendapat notifikasi dengan pilihan **Lihat perubahannya**, **Lepaskan**, **Batalkan semua perubahan ini**, dan **Cabut akses**.

---

## 9. Backup

### 9.1 Salinan di dalam database (`private.snapshots`)

- **Hanya dibuat kalau ada perubahan.** Setiap malam pukul 02.00 WIB, `pg_cron` membandingkan id `change_log` terakhir dengan snapshot sebelumnya.
- **Bertingkat** (dirapikan otomatis setiap malam):
  - **30 harian**: 30 hari terakhir yang ada perubahannya.
  - **12 mingguan**: snapshot terakhir setiap minggu, 12 minggu ke belakang.
  - **12 bulanan**: snapshot terakhir setiap bulan, 12 bulan ke belakang.
- **Sebelum aksi besar** (migrasi, impor, hapus permanen, pemulihan) dibuat snapshot khusus. Snapshot ini disimpan 12 bulan, kecuali snapshot sebelum migrasi yang disimpan selamanya.
- **Isi**: semua tabel data (silsilah, pohon keluarga asal, anggota, kabar, kumpul, kas, kontak terenkripsi).
  - Tidak termasuk `change_log` (sudah merupakan riwayat), lokasi anggota (sementara), IP mentah, dan file Storage.
  - **Alamat, pin, dan petunjuk jalan pertemuan juga tidak ikut** snapshot maupun backup GitHub, supaya alamat tuan rumah tidak tersimpan lebih lama dari 12 jam setelah acara (backup tahunan disimpan selamanya). Akibatnya, kalau suatu saat data dipulihkan dari backup, alamat untuk pertemuan yang akan datang perlu diisi ulang.
  - Disimpan sebagai jsonb dengan kompresi `lz4`.
- **Pemulihan** (admin utama): bisa per orang atau seluruh data. Sebelum memulihkan, snapshot khusus dibuat dulu.

**Perkiraan ukuran:**

| Data (perkiraan setelah 3 tahun) | Jumlah | Ukuran JSON |
|---|---|---|
| Orang (utama + keluarga asal) | ±1.200 | ±0,6 MB |
| Pernikahan + hubungan anak | ±1.600 | ±0,4 MB |
| Kontak (terenkripsi) | ±400 | ±0,2 MB |
| Anggota, perangkat, pengaturan | ±200 / ±500 | ±0,2 MB |
| Kabar + tanggapan (±300 per tahun) | ±900 | ±1,2 MB |
| Kumpul + kas | ±36 pertemuan, ±700 transaksi | ±0,3 MB |
| **Satu snapshot** | | **±3 MB mentah, ±1 MB setelah kompresi** |
| **Semua snapshot** (maks. ±54 reguler + ±10 khusus) | | **±60–70 MB** (sebagai pembanding, tahun pertama sekitar ±20 MB) |
| `change_log` | | bertambah ±10–20 MB per tahun |

**Diukur di langkah 1.12** (keluarga fiktif ±1.200 orang, 600 pernikahan, 200 anggota, tanpa kabar/kas): satu salinan ±1,7 MB mentah, **±330 KB tersimpan** setelah kompresi. Dengan ±54 salinan reguler + ±10 khusus itu sekitar ±20 MB; bertambah setelah Kabar dan Kumpul Keluarga ada.

Batas database paket Free adalah 500 MB, jadi masih jauh. Admin melihat ukuran database di layar Cadangan dan mendapat peringatan di 300 MB.

### 9.2 Backup harian di repo GitHub PRIVAT `silsilah-cadangan`

- **Workflow dijalankan di repo privat itu** (bukan di repo publik), sehingga jadwalnya tidak dimatikan otomatis karena repo sepi.
- **Setiap hari pukul 03.00 WIB**:
  1. Ekspor data lewat *session pooler*.
  2. Hitung checksum. **Kalau sama dengan backup terakhir, berhenti.**
  3. Kalau berbeda, enkripsi dengan format **age + passphrase**. Workflow memakai library resmi `age-encryption` (perintah `age -p` sendiri hanya bisa interaktif). File tetap bisa dibuka di Mac dengan `age -d file.age`, yang meminta passphrase.
  4. Simpan sebagai lampiran **GitHub Release**, bukan di riwayat git, supaya file lama benar-benar bisa dihapus.
  5. **Uji pemulihan**: dekripsi, pulihkan ke Postgres sementara di runner, dan bandingkan jumlah baris.
  6. Tulis hasilnya ke `backup_status`. Kalau gagal, admin mendapat notifikasi.
- **Retensi**: 30 harian, 12 bulanan, dan **1 per tahun selamanya**.
- **Isi**: data semua schema aplikasi, termasuk **kunci Vault data kontak**, sehingga pemulihan cukup dengan passphrase. Foto bukti kas dicadangkan sekali per file (bertambah, tidak diulang).
- **Konsekuensi memakai passphrase**: passphrase harus disimpan sebagai **GitHub Secret** di repo privat supaya workflow bisa mengenkripsi. Secret tidak bisa dibaca kembali dan hanya dipakai workflow. Risikonya kecil selama hanya Anda yang punya akses tulis ke repo itu dan akun GitHub memakai 2FA.
- **Hanya Anda yang memegang passphrase.** Simpan di pengelola kata sandi **dan** salinan kertas di tempat aman. Kalau passphrase hilang, semua backup GitHub tidak bisa dibuka.

**Catatan jujur tentang jeda project:**

- Menurut aturan Supabase saat ini, project Free dijeda setelah sekitar 7 hari tanpa aktivitas. Backup harian membaca database setiap hari, jadi seharusnya project tetap aktif. Namun **aturan Supabase bisa berubah**.
- Kalau project dijeda, aplikasi mengenali error itu dan menampilkan **"Aplikasi sedang dipulihkan. Silakan coba lagi beberapa saat lagi."**
- Pemulihan dilakukan oleh Anda di dashboard (tombol Restore). Project yang dijeda terlalu lama mungkin tidak bisa dipulihkan dari dashboard, dan saat itulah backup GitHub dibutuhkan.

### 9.3 Unduh backup manual

- Tombol **"Unduh backup"** (admin utama) menghasilkan JSON lengkap, dengan kontak tetap terenkripsi dan berpassword.
- **Pengingat dua kali setahun** (1 Januari dan 1 Juli), atau lebih cepat kalau sudah lebih dari 500 perubahan sejak unduhan terakhir: "Unduh satu salinan ke komputer dan coba buka." Panduan membukanya disertakan.

---

## 10. Notifikasi Push

- **Web Push** (VAPID). Edge Function `kirim-notifikasi` dipanggil oleh antrean (`pg_cron` setiap menit) dan langsung oleh trigger untuk kabar duka/darurat (`pg_net`).
- Langganan disimpan per perangkat. Saat pertama kali, anggota diminta izin dengan penjelasan sederhana.
- **iPhone**: notifikasi hanya berfungsi kalau aplikasi **dipasang di layar utama** (iOS 16.4 ke atas). Panduan bergambar disediakan, dan admin melihat jumlah anggota yang belum mengaktifkan notifikasi.
- Semua notifikasi juga masuk ke **kotak masuk** di aplikasi, sehingga tidak ada yang hilang kalau push gagal.
- **Jam tenang** (bawaan 21.00–06.00) dihitung menurut **zona waktu perangkat penerima**. Kabar gembira dan pengumuman ditunda sampai pagi, sedangkan duka dan darurat dikirim seketika.
- Isi notifikasi **tidak pernah memuat alamat, nomor HP, atau lokasi anggota**. Kabar yang belum dikonfirmasi diberi awalan "(Belum dikonfirmasi)".
- Notifikasi untuk admin: login baru (satu per satu atau ringkasan per jam), **login mencurigakan (selalu langsung, dengan tombol "Cabut perangkat ini")**, akses sementara, kuota kontak terlampaui, asisten mengunduh kontak, aktivitas tidak wajar, laporan baru, backup gagal, pemeriksaan akses berkala, dan pengingat unduh backup.

---

## 11. Kumpul Keluarga (Fase 2)

Pertemuan keluarga besar sebulan sekali, dengan **pengajian** sebagai acara utama.

**Isi jadwal**: tanggal, hari, jam, tuan rumah, lokasi (alamat + **pin di peta**), petunjuk jalan, penceramah (ustadz/kyai), tema pengajian, bacaan (tahlil, Yasin, dll.), dan catatan. Tersedia tombol **"Buka di Google Maps"** dan **"Buka di Apple Maps"**.

**Peran:**

- **Pengurus jadwal** (izin `kelola_jadwal` dan admin):
  - Menyusun **giliran tuan rumah 12 bulan sekaligus**: pilih aturan tanggal (misalnya "Ahad kedua setiap bulan") dan urutan tuan rumah, sehingga terbentuk 12 draf yang bisa disesuaikan lalu diterbitkan.
  - Menentukan tanggal dan tuan rumah, mengisi penceramah/tema, dan menyetujui tukar jadwal.
- **Tuan rumah bulan itu**:
  - Hanya bisa mengubah detail di rumahnya (pin, jam, petunjuk jalan, catatan).
  - **Mengonfirmasi kesiapan** sekitar H-14. Kalau belum mengonfirmasi, pengurus jadwal mendapat notifikasi.
  - Bisa mengajukan tukar jadwal.
  - **Tidak** bisa mengganti tanggal atau menghapus jadwal.
- **Semua anggota** (termasuk "hanya melihat") melihat jadwal, mengisi kehadiran (hadir / tidak hadir / belum pasti + jumlah orang), dan membuka peta. **Daftar nama yang hadir** terlihat oleh semua anggota.

**Pengingat push** ke semua anggota:

- H-7 dan H-1;
- hari H pukul **07.00**;
- **2 jam sebelum acara dimulai**. Kalau acara dimulai sebelum pukul 09.00, kedua pengingat hari H digabung jadi satu.

Ada juga notifikasi saat jadwal dibuat atau diubah. Jam acara selalu ditampilkan dalam WIB, ditambah waktu setempat bagi anggota di zona lain (misalnya "19.30 WIB · 14.30 waktu Anda").

**"Bagikan ke grup WhatsApp"** (izin `bagikan_whatsapp` dan admin): membuka WhatsApp di HP orang itu dengan pesan siap kirim (tanggal, tuan rumah, alamat, link Google Maps, penceramah, tema). **Tidak ada pengiriman otomatis.**

**Alamat pertemuan:**

- Alamat di **kartu jadwal** terlihat **terbuka** oleh semua anggota (tanpa perlu diketuk), boleh disimpan offline, dan ikut pesan WhatsApp.
- Alamat itu **dihapus otomatis paling lambat 12 jam setelah acara selesai** (`ends_at` + 12 jam), bersama pin dan petunjuk jalan:
  - `pg_cron` menghapusnya dari database, sehingga tidak ikut snapshot berikutnya.
  - Aplikasi juga menyembunyikannya sendiri berdasarkan jam, walaupun perangkat sedang offline, dan membuangnya dari cache offline.
- Arsip pertemuan hanya menampilkan **"di rumah [nama tuan rumah]"**.
- Alamat di **profil** tuan rumah tetap dilindungi sebagai data kontak (bagian 7). Alamat jadwal adalah salinan terpisah yang diisi tuan rumah atau pengurus jadwal, bukan diambil otomatis dari profil.

**Kas dan sedekah:**

- **Pemasukan per pertemuan dicatat sebagai TOTAL saja**, tanpa jumlah per orang.
- **Pengeluaran** per kategori: konsumsi, santunan, duka, sosial, lain-lain.
- Saldo kas dihitung otomatis. Foto bukti (nota, transfer) disimpan di bucket privat dan dikompres di HP sebelum diunggah.
- Dicatat oleh **Bendahara** (izin `bendahara`).
- **Tutup buku per bulan**: setelah ditutup, data bulan itu tidak bisa diubah. Membuka kembali hanya oleh admin utama, dengan alasan, dan tercatat. Semua perubahan tercatat di riwayat.
- Laporan PDF bulanan dan tahunan.
- **Semua anggota** melihat total pemasukan, pengeluaran, saldo, **total per kategori**, dan **daftar pengeluaran** (tanggal, keperluan, jumlah).
- **Foto bukti** hanya bisa dilihat bendahara dan admin.
- **Sedekah per orang tidak pernah dicatat.**

---

## 12. Kabar Keluarga (Fase 2)

Tempat semua anggota keluarga cepat mengetahui kabar penting.

1. **Penulis**: semua anggota yang bisa mengedit, dengan batas jumlah per orang per hari yang diatur admin (bawaan 5). Anggota "hanya melihat" bisa membaca kabar dan memberi tanggapan singkat, tetapi tidak bisa menulis kabar atau komentar teks.
2. **Jenis**:
   - Kabar gembira: pernikahan, kelahiran, khitanan, wisuda, lainnya.
   - Kabar duka: meninggal dunia, dengan waktu dan tempat pemakaman serta tahlilan.
   - Darurat / butuh bantuan: kecelakaan, sakit keras, bencana, dengan kolom "bantuan yang dibutuhkan".
   - Pengumuman umum: bisa disematkan di atas.
3. **Isi**: judul, isi, orang terkait (tertaut ke kartu), lokasi, waktu dan tempat acara (opsional).
4. **Notifikasi**: **semua kabar ke semua anggota**.
   - Duka dan darurat dikirim seketika, kapan pun.
   - Gembira dan umum tidak dikirim di jam tenang.
   - Untuk duka dan darurat, anggota yang kemungkinan **dekat** (radius bawaan 50 km, bisa diubah admin) mendapat notifikasi **prioritas**, misalnya "🚨 Darurat di Semarang, dekat dengan Anda". Anggota lain mendapat notifikasi biasa.
   - Perhitungan jarak dilakukan di server. Lokasi anggota tidak pernah dikirim ke perangkat orang lain.
5. **Urutan sumber lokasi untuk menentukan "dekat"**:
   1. Lokasi yang dibagikan lewat "Bagikan lokasi saya sekarang" (dari dalam kabar mana pun) **dalam 12 jam terakhir**. Lokasi ini dipakai diam-diam dan tidak pernah ditampilkan.
   2. Status "Sedang berada di …" dengan tanggal berakhir.
   3. Kota/wilayah dari alamat tinggal.

   **Tidak ada pelacakan di latar belakang.** Lokasi hanya diambil sekali, saat tombol ditekan dan izin diberikan.
6. **Tanggapan**:
   - Tombol singkat ("Turut berduka", "Aamiin", "Selamat") untuk semua anggota, termasuk "hanya melihat".
   - Komentar teks hanya untuk anggota yang bisa mengedit.
   - Di kabar darurat ada "Saya bisa membantu" dan "Bagikan lokasi saya sekarang".
   - **Hanya penulis kabar itu, admin, dan asisten dengan izin "Konfirmasi kabar"** yang melihat daftar "Budi · ±3 km · bisa membantu". Kalau jaraknya dihitung dari kota, tertulis "(perkiraan)".
   - Jarak yang dihitung saat lokasi dibagikan tetap tampil setelah koordinatnya dihapus (12 jam).
   - Anggota lain hanya melihat jumlah orang yang siap membantu.
7. **Lokasi kejadian** (darurat/duka). Aplikasi bertanya: "Apakah Anda sedang berada di lokasi kejadian?"
   - **Ya**: "Gunakan lokasi saya sekarang" (GPS sekali ambil).
   - **Tidak**, tersedia tiga cara:
     - (a) cari nama tempat (misalnya nama rumah sakit) lalu pilih dari hasil;
     - (b) tempel link Google Maps atau share location WhatsApp, termasuk link pendek `maps.app.goo.gl`, yang dibaca lewat Edge Function `baca-link-lokasi` (hanya untuk domain peta yang dikenal);
     - (c) geser pin di peta.
   - Alamat yang diketik bisa ditambahkan sebagai keterangan.
   - Setiap lokasi diberi **label sumber**: "📍 Dari GPS penulis di lokasi", "📍 Dipilih dari peta", "📍 Dari link lokasi", atau "📍 Perkiraan dari alamat".
   - Orang yang berada di lokasi bisa membagikan lokasinya dari dalam kabar. Penulis, admin, atau asisten bisa menjadikannya **lokasi utama**.
   - Lokasi bisa **diperbarui**: semua anggota mendapat notifikasi "Lokasi diperbarui: sekarang di …", dan riwayat lokasi kejadian tetap tersimpan.
   - Tersedia tombol "Buka di Google Maps" / "Buka di Apple Maps".
8. **Privasi lokasi**:
   - Koordinat lokasi anggota **dihapus otomatis 12 jam setelah dibagikan**, atau lebih cepat kalau kabar ditandai selesai. Yang tersisa hanya perkiraan jaraknya (misalnya "±3 km").
   - Status "Sedang berada di …" hilang setelah tanggal berakhirnya.
   - Lokasi anggota hanya dipakai untuk kabar itu, ditambah penentuan "dekat" untuk kabar duka/darurat baru selama 12 jam yang sama (poin 5). Tidak dipakai untuk hal lain.
9. **Terhubung ke silsilah**:
   - Kabar kelahiran: tombol "Tambahkan ke silsilah" dengan data yang sudah terisi.
   - Kabar pernikahan: tombol tambah pasangan/pernikahan.
   - Kabar wafat **tidak langsung** mengubah silsilah. Aplikasi membuat usulan di `pending_tree_updates`, dan status "Alm./Almh." serta tanggal wafat baru diterapkan setelah dikonfirmasi admin atau asisten (`konfirmasi_kabar`).
10. **Pengaman dari kabar keliru**:
    - Kabar langsung tayang dengan label **"Belum dikonfirmasi"** sampai dikonfirmasi admin atau asisten.
    - Penulis bisa mengedit atau menarik kabarnya.
    - Admin dan asisten bisa menyembunyikan kabar, dan anggota bisa melaporkannya.
11. **Selesai/Tertangani**: kabar darurat bisa ditandai selesai oleh penulis, admin, atau asisten.
12. **Hanya untuk anggota yang login.** Kabar tidak ikut ekspor umum. Ada arsip per tahun, dan bagian "Kabar terkait" di panel detail setiap orang.
13. **"Bagikan ke grup WhatsApp"**: izin `bagikan_whatsapp` dan admin, seperti di Kumpul Keluarga.

---

## 13. Peta dan Pencarian Tempat (dipakai bersama)

- Satu komponen `components/peta/` dipakai untuk Kumpul Keluarga dan Kabar Keluarga.
- **Leaflet** dengan ubin **OpenStreetMap**, gratis, dengan atribusi "© OpenStreetMap contributors" yang selalu tampil.
- **Pencarian tempat dengan Nominatim**, mengikuti kebijakan pemakaiannya: maksimal 1 permintaan per detik, pencarian **saat tombol Cari ditekan** (bukan saat mengetik), hasil disimpan sementara, dan identitas aplikasi dikirim.
- Kalau suatu saat layanan itu menolak, penyedia ubin atau pencarian bisa diganti di satu tempat.
- **Pembaca link lokasi** (`src/lib/linkLokasi.js`, dengan tes) mengenali format `@lat,lng`, `?q=lat,lng`, `!3d…!4d…`, dan `maps.apple.com/?ll=`. Link pendek dibuka lewat Edge Function.
- Tombol arah: `https://www.google.com/maps/dir/?api=1&destination=lat,lng` dan `https://maps.apple.com/?daddr=lat,lng`.

---

## 14. Daftar Layar

| # | Layar | Isi utama |
|---|---|---|
| 1 | **Masuk** | Tanpa data apa pun. Pilihan "Masuk dengan kode" dan penjelasan singkat. ("Masuk dengan Google" ditambahkan di Fase 2, setelah Google dikonfigurasi: tugas 23.) |
| 2 | **Membuka undangan / kode** | Tombol Masuk, deteksi browser dalam aplikasi, dan pesan link sudah dipakai / kedaluwarsa / tidak ada internet |
| 3 | **Selamat datang** | "Apakah ini Anda?", tips huruf, notifikasi, layar utama, dan tambah perangkat |
| 4 | **Bagan** (silsilah utama) | Kartu seperti aplikasi lama, geser/zoom, mode fokus cabang, *breadcrumb*, "Tampilkan saya", serta "+ Anak / + Pasangan" di kartu (untuk yang bisa mengedit) |
| 5 | **Daftar** | Teks berjenjang dengan nomor silsilah, istilah generasi, dan GEN |
| 6 | **Detail orang** | Format panel aplikasi lama (bagian 15.1): avatar, nama, "Putu · Generasi ke-2", Keterangan Pribadi ("Putri ke-3 dari 11 bersaudara"; antarsepupu: satu kalimat per orang tua; panggilan, jenis kelamin, orang tua, status pernikahan, pasangan berurutan, pekerjaan, nomor silsilah), Riwayat Hidup (lahir, wafat, catatan), anak (anak kandung bernomor; anak sambung/angkat tanpa nomor dengan keterangan kecil), "Anak sambung [nama]"/"Anak angkat [nama]" di keterangan anak itu, kontak (Tampilkan), kabar terkait, riwayat, dan Laporkan kesalahan |
| 7 | **Form orang / pernikahan / anak** | Gelar "(opsional)", pekerjaan, alamat, dan HP (tidak wajib, tanpa tulisan opsional), tanggal kabur, jenis anak, urutan lahir (hanya anak kandung), pilihan "Belum menikah" (hanya di data diri sendiri), dan "Berpisah" (hanya untuk yang berhak, SL010) |
| 8 | **Pohon keluarga asal** | Untuk yang diberi akses. Pohon terpisah dengan warna latar berbeda dan istilah dari sudut pandang pasangan khusus (Bapak, Mbah, Pakdhe, …). Hanya admin yang bisa mengedit. |
| 9 | **Pencarian** | Semua hasil yang cocok + toleran ejaan; pencarian wilayah/nomor (yang berwenang) |
| 10 | **Kabar Keluarga** | Daftar (yang disematkan di atas), saringan jenis, arsip per tahun |
| 11 | **Tulis/Detail kabar** | Formulir per jenis, lokasi kejadian, tanggapan, daftar yang bisa membantu, konfirmasi |
| 12 | **Kumpul Keluarga** | Jadwal berikutnya (alamat terbuka sampai 12 jam setelah acara), peta, kehadiran dan daftar yang hadir, 12 bulan ke depan, arsip ("di rumah …") |
| 13 | **Pengurus jadwal** | Rencana 12 bulan, tukar jadwal, konfirmasi tuan rumah |
| 14 | **Kas** | Untuk semua: total, per kategori, dan daftar pengeluaran. Untuk bendahara: pencatatan dan foto bukti. Tutup buku, laporan PDF. |
| 15 | **Riwayat perubahan** | Siapa/apa/kapan + Batalkan (sesuai hak) |
| 16 | **Laporan** | Untuk asisten/admin: daftar laporan dan tindak lanjut |
| 17 | **Data yang disisihkan** | Pulihkan (izin); Hapus permanen satu kelompok atau semuanya (admin utama) |
| 18 | **Cetak/PDF cabang** | Format Daftar atau Bagan, berhalaman-halaman, tanpa kontak |
| 19 | **Kotak masuk** | Semua notifikasi |
| 20 | **Saya / Pengaturan** | Ukuran huruf, kontras, notifikasi, "Sedang berada di …", Tambah perangkat, Perangkat saya, Google, Keluar |
| 21 | **Admin: Anggota & Undangan** | Undang, peran, izin asisten (centang), perangkat, cabut, aktivitas terakhir, pemeriksaan berkala |
| 22 | **Admin: Akses sementara** | Buat kode + durasi, daftar akses aktif |
| 23 | **Admin: Keluarga asal** | Sakelar per pasangan, "Beri akses ke semua keturunan …", akses per orang |
| 24 | **Admin: Kontak** | Pembukaan per orang, kuota, unduh PDF berpassword |
| 25 | **Admin: Keamanan & Log** | Log login (kota/negara perkiraan, perangkat, waktu; IP mentah ≤ 30 hari), login mencurigakan, aktivitas tidak wajar, anggota yang ditahan |
| 26 | **Admin: Cadangan** | Status backup, snapshot, pulihkan, unduh backup, ekspor seluruh data, ukuran database |
| 27 | **Admin: Pengaturan aplikasi** | Kuota, batas akses sementara, kode perangkat, jam tenang, radius, ambang, jam pengingat |
| 28 | **Error / Sedang dipulihkan / Belum ada data / Database belum diperbarui** | Pesan jelas berbahasa Indonesia, tanpa penulisan data |
| 29 | **Privasi** (bisa dibuka sebelum dan sesudah login; bagian kontak, lokasi kabar, dan alamat pertemuan ditambahkan bersama fiturnya di Fase 2) | Bahasa sederhana: data apa yang disimpan dan berapa lama. Lokasi login hanya perkiraan kota/negara dari IP, tanpa GPS; IP mentah dihapus setelah 30 hari; database lokasi IP offline (atribusi DB-IP); kontak terenkripsi dan setiap pembukaan dicatat; lokasi kabar dihapus setelah 12 jam; alamat pertemuan dihapus 12 jam setelah acara; data offline dihapus saat keluar. Tanpa nama atau data keluarga. |

Navigasi bawah di HP: **Silsilah · Kabar · Kumpul · Cari · Saya**.

---

## 15. Tampilan Silsilah, Pencarian, Cetak, dan Aksesibilitas

### 15.1 Kartu dan istilah

- **Bagan dengan kartu sederhana** seperti aplikasi lama (ditetapkan saat perbaikan tampilan, Oktober 2026):
  - **Keturunan**: lingkaran simbol ♂/♀, NAMA (dengan "Alm./Almh." otomatis dan gelar), istilah Jawa kapital kecil (misalnya "PUTU"), dan "GEN.n" kecil di **pojok** kartu.
  - **Pangkal**: lingkaran simbol, NAMA, dan label "PANGKAL" (tanpa GEN).
  - **Pasangan**: **hanya** lingkaran simbol dan NAMA, tanpa label dan tanpa GEN; warnanya sudah menandakan pasangan.
  - Tahun lahir–wafat, nama panggilan, "Putra/Putri ke-n · dari istri ke-n", dan "Pasangan dari … · berpisah" **tidak** di kartu, tetapi di panel keterangan.
  - Label "Istri ke-n"/"Suami ke-n" di atas kartu pasangan **hanya** kalau orang itu menikah dengan lebih dari satu orang.
- **Warna kartu** (latar lembut + strip atas + lingkaran simbol), semuanya lolos tes kontras biasa dan kontras tinggi (`src/kontras.test.js`):
  - keturunan laki-laki biru, keturunan perempuan pink, pasangan laki-laki hijau sage, pasangan perempuan peach, jenis kelamin tidak diketahui abu;
  - **kedua** kartu pasangan pangkal emas (latar krem keemasan, bingkai emas); kalau wafat tetap emas, tanda wafat cukup strip atas dan lingkaran simbol hitam arang, ditambah "Alm./Almh.";
  - keturunan wafat: seluruh kartu hitam arang tua dengan tulisan terang; pasangan wafat: hitam arang yang lebih muda dengan tulisan putih; simbol ♂/♀ tetap berwarna sesuai jenis kelamin.
- **Garis**: setiap pernikahan punya ikon hati di antara kedua pasangan; garis ke anak keluar dari hati itu (turun lurus, lalu bercabang siku-siku ke setiap anak). Pernikahan yang berakhir karena berpisah: **ikon hati patah** (terbelah dua) **dan garis putus-putus**. Ditinggal wafat atau masih menikah: hati utuh, garis biasa.
- **Bagan** (putaran kedua tinjauan, Oktober 2026):
  - **Pernikahan berulang** disusun dari KIRI ke KANAN menurut waktu terjadinya, satu hati per pernikahan: istri ke-1 → istri ke-2 → istri ke-1 (menikah kembali) → istri ke-3. Pernikahan kembali tampil sebagai hati tersendiri dengan kartu pasangan yang muncul lagi, diberi keterangan kecil **"menikah kembali"** (label "Istri ke-n" tetap menurut pasangan yang berbeda). Anak-anak berada di bawah hati pernikahannya masing-masing, sehingga membaca bagan dari kiri ke kanan menghasilkan urutan kelahiran.
  - **Nomor urut** kecil (1, 2, 3, …) di pojok **kiri atas** kartu setiap anak **kandung** (sama dengan "Putra/Putri ke-n"; GEN.n tetap di pojok kanan atas). Anak sambung/angkat tanpa nomor.
  - Di bawah setiap pasangan orang tua, **semua** anak (kandung, sambung, angkat) diurutkan menurut **umur**, paling tua di kiri. Urutan anak kandung tidak pernah berubah; anak sambung/angkat disisipkan sebelum anak kandung pertama yang pasti lahir sesudahnya; anak kandung tanpa tanggal lahir tetap di tempat nomornya; anak sambung/angkat tanpa tanggal lahir di paling kanan (`src/lib/silsilah/anak.js`).
  - **Belum dewasa**: tunas daun kecil di pojok **kanan bawah** kartu, dengan baris legenda "Belum dewasa (di bawah 18 tahun)". Dihitung otomatis dari tanggal lahir paling akhir yang mungkin (sama dengan aturan undangan), hilang sendiri saat berusia 18 tahun, dan tidak tampil kalau tanggal lahir tidak diketahui atau orangnya sudah wafat.
  - **Legenda**: baris "Jenis kelamin tidak diketahui" **hanya** muncul selama masih ada orang yang jenis kelaminnya belum diketahui, hilang otomatis saat semuanya sudah diisi, dan muncul lagi kalau ada data baru yang belum lengkap (kartu abu tetap dipakai untuk mereka). Baris "Belum dewasa" juga hanya selama ada. Selalu ada: warna kartu, "Berpisah" (hati patah + garis putus-putus), dan "Putra/Putri ke-n (anak kandung)".
  - **Fokus pada cabang ini**: setelah tombol ini dipilih, ada dua pilihan: **"Hitung dari pangkal utama"** (GEN dan istilah Jawa seperti biasa) atau **"Hitung dari [nama orang itu]"**. Pada pilihan kedua, orang itu menjadi **GEN.0** dengan label **"PANGKAL CABANG"** (warna kartunya tetap warna keturunan; emas hanya untuk pasangan pangkal utama), anak-anaknya GEN.1 · Anak, cucunya GEN.2 · Putu, dan seterusnya; semua GEN dan istilah Jawa di kartu dan panel tampilan fokus dihitung ulang otomatis (dari letak di cabang itu, `src/lib/bagan/cabang.js`). Nomor silsilah tidak berubah. Selama mode itu aktif, pita di atas bagan menulis **"Generasi dihitung dari Bima · Kembali ke pangkal utama"**; tautan itu kembali ke hitungan pangkal utama di cabang yang sama. Alamatnya bisa dibagikan: `#/bagan?fokus=<id>&hitung=cabang`. Beralih ke cabang lain ("Naik ke …") mempertahankan pilihan hitungan.
  - **Tampilan awal**: di laptop seluruh bagan terlihat tetapi **tidak tertutup legenda atau bilah atas** (bagan diletakkan di atas legenda atau di kanannya, mana yang lebih besar). Di HP (lebar < 640 px) bagan **tidak** diperkecil sampai kartu tak terbaca: mulai dari ukuran yang terbaca dengan pasangan pangkal (atau pangkal cabang) di tengah, tepat di bawah bilah atas; tombol **"Lihat seluruh bagan"** menampilkan seluruh pohon. "Pusatkan" kembali ke tampilan awal.
- **Istilah generasi Jawa** tampil jelas, dengan label kecil **"GEN.n"**:
  - GEN.0 Pangkal, GEN.1 Anak, GEN.2 Putu, GEN.3 Buyut, GEN.4 Canggah, GEN.5 Wareng;
  - GEN.6 Udheg-udheg, GEN.7 Gantung siwur, GEN.8 Gropak senthe, GEN.9 Debog bosok, GEN.10 Galih asem;
  - mulai GEN.11, hanya "GEN.11", "GEN.12", dst., tanpa istilah.
- **Kedua orang tua sama-sama keturunan** (pernikahan antarsepupu):
  - GEN mengikuti **jalur yang paling dekat ke pangkal**.
  - Di bagan, anak tampil **sekali**, di bawah orang tua di jalur itu. Di samping setiap keturunan, pasangannya dari cabang lain tampil sebagai **kartu rujukan** yang dihubungkan dengan ikon hati: warna keturunan sesuai jenis kelaminnya, keterangan kecil "Dari cabang lain" dan tanda ↗; mengetuknya melompat ke kartu utamanya. Di tempat orang tua yang tidak memuat anaknya ada catatan kecil "Anak mereka ada di cabang …" yang bisa diketuk.
  - Panel keterangan menampilkan satu kalimat urutan per orang tua, misalnya "Putri ke-2 dari 3 bersaudara (pihak Gendis)", dan satu baris singkat "Lewat …: Canggah · Generasi ke-4" hanya kalau GEN kedua jalur berbeda. Tanpa kalimat penjelasan teknis.
- **Urutan lahir** (ditetapkan ulang Oktober 2026, putaran kedua tinjauan):
  - **"Putra ke-n"** (laki-laki) atau **"Putri ke-n"** (perempuan); kalau jenis kelamin belum diketahui "Putra/Putri ke-n". Kata **"Anak ke-n" tidak dipakai di mana pun** (kartu, panel, daftar anak, Daftar).
  - Hanya **anak kandung** orang tua itu yang bernomor, lintas semua pernikahannya (bagian 5.4). Anak sambung dan anak angkat **tidak bernomor**.
  - Di panel anak itu: satu kalimat tanpa label di bawah judul KETERANGAN PRIBADI, misalnya **"Putri ke-3 dari 11 bersaudara"** ("bersaudara" = jumlah anak kandung orang tua itu; anak kandung satu-satunya: "Putri tunggal"). Antarsepupu: satu kalimat per orang tua ("… (pihak Rangga)").
  - Di Daftar: **"Putra ke-6 · dari istri ke-1"**. "istri/suami ke-n" adalah urutan **pasangan yang berbeda**, menurut pernikahan pertama dengan pasangan itu. Contoh: istri ke-1 → anak 1–3, istri ke-2 → anak 4–5, kembali ke istri ke-1 → anak 6–7 ("dari istri ke-1"), istri ke-3 → anak 8–11. Bagian "· dari istri ke-n" hanya muncul kalau orang tua itu pernah punya lebih dari satu pasangan.
- **Anak sambung dan anak angkat** (diubah Oktober 2026; sebelumnya keterangannya hanya di panel anak itu sendiri):
  - Kartu di Bagan sama dengan saudaranya (istilah dan GEN sama), tetapi **tanpa nomor urut**.
  - Di panel anak itu: **"Anak sambung [nama orang tua sambungnya]"** atau **"Anak angkat [nama orang tua angkatnya]"** (kata lembut).
  - Di panel orang tuanya, bagian **ANAK**: anak kandung bernomor ("1. Nama", "2. Nama", …) dengan keterangan kecil "· dari istri ke-n"/"· dari suami ke-n" kalau orang tua itu menikah dengan lebih dari satu orang; anak sambung/angkat **tanpa nomor** dengan keterangan kecil "anak sambung"/"anak angkat". Semuanya disusun menurut umur (aturan yang sama dengan Bagan, bagian 15.1 "Bagan").
  - Di Daftar tidak ada kata "sambung"/"angkat"; anak sambung/angkat tampil tanpa keterangan urutan.
- **Pasangan**: di panel, "Pasangan dari [nama]" di bawah nama, tanpa istilah generasi. Kalau pernikahan itu berakhir karena berpisah, tertulis "· berpisah".
- **Kata "cerai"/"bercerai" tidak pernah tampil.** Pernikahan yang berakhir (cerai resmi, cerai agama/adat, atau ditinggal tanpa kabar) ditulis dengan kata netral **"Berpisah"**, tanpa menyebut caranya. Nilai di database tetap `'cerai'`.
- **Panel keterangan** (format aplikasi lama; di layar lebar di sisi kanan, di HP dari bawah):
  - atas: avatar dalam lingkaran berbingkai emas (sementara emoji sesuai jenis kelamin; komponen `Avatar` sudah siap menampilkan foto untuk Fase 3), NAMA, lalu **"Putu · Generasi ke-2"** (istilah Jawa dulu, bukan "Generasi ke-2 (Putu)");
  - **KETERANGAN PRIBADI** (dulu "Informasi Anggota"): kalimat urutan ("Putri ke-3 dari 11 bersaudara", atau "Anak sambung …"), lalu baris-baris. **Selalu tampil, ditulis "-" kalau belum diisi**: Panggilan, Jenis kelamin, Orang tua (satu baris, "Bima & Eka", keduanya bisa diketuk), Pekerjaan, Nomor silsilah. **Hanya kalau berlaku**: Status pernikahan (pilihan tetap, bagian 5.4; tidak tampil untuk anak di bawah umur atau yang wafat semasa kecil, kecuali ada data pernikahannya), Pasangan (hanya kalau ada data pernikahan; lebih dari satu pasangan: "Istri ke-1: … (berpisah)", dst.);
  - **RIWAYAT HIDUP**: Lahir (tempat, tanggal; selalu, "-" kalau belum diisi), Wafat (**hanya** untuk yang sudah wafat; tidak pernah "Wafat: -" untuk yang masih hidup), Catatan (selalu, "-" kalau kosong);
  - **ANAK** (kalau ada): lihat "Anak sambung dan anak angkat" di atas; lalu tempat tombol aksi (gaya tombol aplikasi lama).
- **Aturan tulisan** (dijaga `src/tulisan.test.jsx`): satu pernikahan tanpa "ke-1"; "Menikah tahun 1974" (bukan "Menikah · Menikah 1974"); tanpa kata ganda, penomoran yang tidak perlu, istilah teknis, atau kalimat yang bisa menyinggung; tanpa "Anak ke-", "cerai"/"bercerai", "Wafat: -" untuk yang masih hidup, dan "Belum menikah" yang tidak dipilih orangnya sendiri.
- **Nomor silsilah otomatis** di tampilan Daftar (misalnya 1.6.2).
  - **Ditetapkan di langkah 1.13:** pasangan pangkal = 1, anak ke-6 mereka = 1.6, anak ke-2 dari anak itu = 1.6.2. Untuk anak kandung, angka terakhir selalu sama dengan "Putra/Putri ke-n" di panel keterangan. **Anak sambung/angkat** tetap bernomor supaya keturunannya juga bernomor: sesudah semua anak kandung orang tua itu, menurut umur (Oktober 2026). Anak dari pasangan sepupu dinomori lewat jalur yang paling dekat ke pangkal. Pasangan yang bukan keturunan tidak bernomor ("-").
- **Nama di kartu** memuat gelar religius di depan dan gelar pendidikan di belakang: "Alm. KH. Nama, S.Ag.".

### 15.2 Pencarian

- Menampilkan **semua** hasil, masing-masing dengan jalur keluarga.
- Normalisasi ejaan: huruf kecil, tanpa diakritik, `oe→u`, `dj→j`, `tj→c`, `sj→sy`, `nj→ny`, `ch→kh`, `dl/dh/d`, `ts/s`, `th/t`, dan huruf ganda dianggap satu.
- Yang dicari: nama, nama panggilan, gelar, tempat lahir, dan pekerjaan. Kontak tidak termasuk, kecuali pencarian wilayah/nomor oleh yang berwenang.

### 15.3 Cetak/PDF per cabang

- **Pilihan hitungan generasi** (ditetapkan Oktober 2026): seperti "Fokus pada cabang ini" di Bagan, unduh PDF sebuah cabang memberi pilihan **"Hitung dari pangkal utama"** atau **"Hitung dari [nama orang yang difokuskan]"** (orang itu "Pangkal cabang" GEN.0, keturunannya dihitung ulang). Kalau PDF dibuat dari tampilan fokus yang sudah memakai salah satu pilihan, pilihan itu menjadi bawaan.
- Format **Daftar** (berjenjang) atau **Bagan**. Bagan dibagi ke beberapa halaman A4: halaman ringkasan, lalu satu sub-cabang per halaman (dipecah lagi kalau masih terlalu lebar), dengan catatan "→ lihat halaman 5".
- Dicetak lewat dialog cetak browser, dan bisa disimpan sebagai PDF.
- **Tidak pernah memuat kontak.**

### 15.4 Aksesibilitas dan kenyamanan

- Huruf dasar 18px, dengan pilihan Besar dan Sangat besar. Kontras minimal WCAG AA (teks utama diusahakan AAA), dan ada mode kontras tinggi.
- Area sentuh minimal 48px. Tombol memakai teks + ikon. Informasi tidak hanya dibedakan dengan warna.
- `lang="id"`, label ARIA, fokus terlihat, dan menghormati `prefers-reduced-motion`.
- **PWA**: bisa dipasang dengan ikon generik "Silsilah Keluarga". Ada banner versi baru.
- **Data offline**: data terakhir (silsilah, kabar, jadwal) disimpan di perangkat untuk dibaca saat offline.
  - **Ditetapkan di langkah 1.20:** salinan disimpan di IndexedDB `silsilah` (hanya kolom yang terdaftar, ditambah nama/peran/izin anggota dan akun loginnya). Kalau server tidak terjangkau saat aplikasi dibuka, aplikasi terbuka **hanya untuk membaca** salinan milik akun yang sama, dengan spanduk "Anda sedang offline". **Perangkat dengan akses sementara tidak menyimpan salinan sama sekali.** Kalau server menolak (bukan soal koneksi), salinan tidak dipakai.
  - **Data kontak dan lokasi anggota tidak pernah disimpan offline.**
  - Semua data offline dihapus saat keluar, saat akses sementara habis, dan saat perangkat dicabut.
- **noindex**: `<meta name="robots" content="noindex, nofollow">`. Judul dan pratinjau WhatsApp generik, tanpa nama.

### 15.5 Acuan desain: identitas visual aplikasi lama

Aturan tetap (prinsip 10): tampilan mengikuti aplikasi lama. Perubahan besar harus Anda setujui dulu. Berlaku di **semua** layar (Masuk, Selamat datang, Beranda, Bagan, Daftar, Saya, Perangkat, Privasi, Kotak masuk, dan layar baru).

**Token desain lama:** latar #FBF6EC dengan pola titik emas (radial-gradient rgba(166,124,30,0.12) 1px, jarak 26px); kartu #FFFFFF, sudut 12px, tepi #E2D9CC, bayangan halus; emas #A67C1E (hover #C59B3F); teks #2C221E; teks samar #7A6E65; garis #B89A6E; laki-laki #7FA6C4; perempuan #D998A8; tidak diketahui #A69C8C; wafat #4A423B; nama dengan huruf Cinzel 700 kapital; teks lain Plus Jakarta Sans. Huruf dipasang dari paket lokal (bukan Google Fonts), jadi tetap jalan offline.

**Penyesuaian demi kontras** (tes kontras yang sudah ada tetap berlaku): teks samar #554A42; emas untuk tulisan #8A6516; tombol utama emas tua #6E5110 dengan teks putih; garis ke anak #9A7A4C; pasangan wafat #5C554F (bukan ±#756D66, karena teks putih di sana kurang kontras). Warna asli tetap dipakai untuk hiasan (strip, bingkai, titik latar).

**Pengamatan video aplikasi lama** (diikuti sedekat mungkin):

- **Bilah atas** melayang di kiri atas: judul "SILSILAH KELUARGA" (Cinzel, emas), subjudul kecil "ARSIP WARISAN & SEJARAH", status kecil hijau tentang sinkronisasi; lalu kotak cari, tombol cari, + dan −, "Pusatkan", dan tombol aksi emas. Ada × untuk menyembunyikan bilah. Tombol untuk fitur yang belum ada (Tambah Anggota, Unduh PDF) baru ditampilkan saat fiturnya dibuat.
- **Legenda** di kiri bawah, bisa ditutup; saat ditutup tersisa tombol bulat kecil di pojok kiri bawah.
- Saat dibuka, **bagan tampil utuh** (diperkecil supaya seluruh pohon terlihat), lalu bisa diperbesar. (Sejak Oktober 2026: di HP mulai dari ukuran terbaca dengan tombol "Lihat seluruh bagan", lihat bagian 15.1.)
- **Kartu**: strip warna tipis di tepi atas, lingkaran kecil berisi simbol ♂/♀ menempel di tengah atas, NAMA kapital Cinzel (boleh dua baris), dan di bawahnya satu label kecil kapital (istilah). Kartu terpilih/hover: bingkai emas.
- **Pasangan** duduk tepat di samping keturunannya, dengan ikon **hati** di dalam lingkaran kecil di antara keduanya. Garis ke anak keluar dari ikon hati: turun lurus, lalu bercabang siku-siku ke setiap anak; garis tipis cokelat keemasan.
- **Panel detail** di sisi kanan, berlatar putih (di HP: lembar dari bawah atau layar penuh): avatar emoji di dalam lingkaran berbingkai emas, NAMA (Cinzel), istilah di bawahnya, lalu bagian "INFORMASI ANGGOTA" (sejak Oktober 2026 bernama "KETERANGAN PRIBADI") dan "RIWAYAT HIDUP" dengan judul kecil kapital berwarna emas. Tombol utama emas berbentuk kotak membulat; tombol hapus bergaris merah.

---

## 16. Rencana Migrasi Data

### 16.1 Bentuk data lama

Satu objek JSON bersarang berisi `id`, `name`, `gender`, `relation` (teks manual), `children[]`, `spouse` + `status`, `marriages[]`, `birthDate`/`birthPlace`/`deathDate`/`deathPlace` (teks bebas), dan `bio`.

### 16.2 Yang dipindahkan

**Semua struktur**, ditambah tanggal dan tempat yang sudah ada:

- nama → `full_name`;
- jenis kelamin;
- pernikahan dan urutannya (termasuk menikah lagi dengan pasangan yang sama), status cerai;
- hubungan orang tua–anak;
- urutan lahir (dari urutan di data lama dan teks "Anak Ketujuh");
- status wafat;
- **tanggal dan tempat lahir**, **tanggal dan tempat wafat** (diubah ke tanggal kabur);
- **isi "bio" → kolom catatan** (`notes`).

**Tidak** dipindahkan: kolom baru (gelar religius, gelar pendidikan, pekerjaan, alamat, nomor HP). Kolom-kolom ini tetap kosong dan dilengkapi sendiri oleh anggota.

**Jenis kelamin yang belum diketahui** (Oktober 2026): laporan migrasi (`laporan.md`) **wajib** mendaftar semua nama yang jenis kelaminnya belum diketahui, supaya Anda bisa memperbaikinya sendiri. Jenis kelamin **tidak pernah diisi asal** (misalnya ditebak dari nama); selama belum diisi, kartunya abu dan legenda menampilkan "Jenis kelamin tidak diketahui".

| Lama | Baru |
|---|---|
| simpul | `people` (+ `legacy_id`) |
| `name` | `full_name`. Nama yang mengandung gelar atau kurung **ditandai** di laporan. Usulan pemisahan gelar hanya diterapkan setelah Anda setujui; kalau tidak, nama dipindahkan apa adanya. |
| `gender` | `sex` |
| `spouse`, `marriages[]` | `unions` + `people` pasangan, satu baris per pernikahan sesuai urutan |
| `children` | `children` ke pernikahan yang sesuai. Tanpa pasangan → pernikahan dengan pasangan "tidak diketahui". |
| urutan anak di data lama + `relation` | `birth_ranks`. Selisih antara urutan data lama, teks `relation`, dan tanggal lahir dilaporkan. |
| status "Bercerai" | `cerai` (tampil "Berpisah") |
| status "Almarhum/ah", atau ada `deathDate`/`deathPlace` | `is_deceased = true` pada orang yang sesuai (ditandai "perlu dicek") |
| `birthDate`, `deathDate` (teks bebas) | `birth_*` / `death_*` (tanggal lengkap, bulan + tahun, tahun saja, atau "sekitar"). Teks yang gagal dibaca: tanggal dikosongkan, teks aslinya ditambahkan ke catatan dengan awalan "Tanggal dari data lama:", lalu ditandai "perlu dicek". |
| `birthPlace`, `deathPlace` | `birth_place`, `death_place` (apa adanya, hanya spasi berlebih yang dirapikan) |
| `bio` | `notes` |
| data pasangan dalam `spouse` (objek) | kolom yang sama pada `people` pasangan |
| `__phantom` | diabaikan |

### 16.3 Langkah

1. CSV backup 5 Oktober 2026 diletakkan di `data-pribadi/lama/`. Ini dilakukan **setelah** `.gitignore` dan pemindai aktif.
2. Skrip `scripts/migrasi-lama/ubah.js` (dites dengan data fiktif yang meniru bentuk lama) menghasilkan `data-pribadi/migrasi/hasil.json` dan `laporan.md`. Laporan berisi jumlah data, daftar "perlu dicek", selisih urutan anak, dan **daftar semua nama yang jenis kelaminnya belum diketahui** (wajib; tidak pernah diisi asal).
3. Anda meninjau laporan. Koreksi ditulis di `data-pribadi/migrasi/koreksi.json`, lalu skrip dijalankan ulang. Data sumber tidak diedit tangan.
4. **Uji di PGlite**: hasil diimpor ke database tes lengkap dengan semua file SQL. Skrip verifikasi membangun ulang pohon dan membandingkannya 100% dengan JSON lama (nama, pasangan orang tua–anak, pernikahan, status, jumlah).
5. Anda menelusuri hasilnya di **mode contoh** yang memuat file hasil lokal (tidak pernah di-*deploy*).
6. **Impor ke cloud**:
   - Ambil snapshot `sebelum_migrasi`.
   - Impor dalam **satu transaksi** dengan secret key dari `data-pribadi/.env` (diisi oleh Anda). Pelakunya tercatat sebagai "Migrasi".
   - Atur `root_union_id`.
   - Buat pohon keluarga asal untuk **pasangan khusus A dan B** (awalnya kosong; Anda mengisinya lewat aplikasi) dan atur aksesnya.
7. Verifikasi di cloud dengan skrip yang sama, lalu diperiksa oleh Anda dan 1–2 anggota keluarga senior.
8. Tabel lama sudah terkunci sejak langkah darurat. Setelah verifikasi, tabel di-*rename* menjadi `family_tree_lama`, disimpan minimal 3 bulan, dan **hanya dihapus atas keputusan Anda** (setelah didump ke repo backup).
9. Repo lama yang sudah privat bisa dihapus atau diarsipkan setelah verifikasi.

---

## 17. Tahapan Kerja

Setiap langkah kecil, bisa dites, dan selesai dengan commit + CI hijau. **Kode baru dimulai setelah Anda bilang "mulai".**

### Kelompok kerja (satu chat per kelompok)

Sisa Fase 1 dikerjakan per kelompok. Setiap chat mengerjakan **satu kelompok saja**, lalu berhenti dan melapor; kelompok berikutnya baru dimulai setelah Anda bilang "lanjut". Kolom terakhir adalah tugas manual Anda sebelum kelompok berikutnya.

| Kelompok | Langkah | Model · effort | Tugas manual Anda sesudahnya |
|---|---|---|---|
| ✅ 1 | 1.15 | Opus 5.5 · xhigh | – (selesai) |
| ✅ 2 | 1.16 | Opus 5.5 · high | – (selesai) |
| ✅ 3 | 1.17 + 1.18 | Sonnet 5.5 · high | – (selesai) |
| ✅ 4 | 1.19 | Opus 5.5 · high | – (selesai) |
| ✅ 5 | 1.20 | Opus 5.5 · high | – (selesai) |
| ✅ 6 | 1.21 + 1.22 | Sonnet 5.5 · high | – (selesai; opsional: lihat lewat mode contoh) |
| ✅ 6b | perbaikan tampilan menurut tinjauan Anda (identitas visual lama, warna kartu, isi kartu, garis, antarsepupu, panel, tulisan, mode contoh lengkap) | Opus 5.5 | – (selesai) |
| ✅ 6c | perbaikan putaran kedua menurut tinjauan Anda (A panel keterangan, B bagan, C fokus cabang, D mode contoh, E tes; lihat "Putaran kedua tinjauan tampilan" di bawah tabel ini) | Opus 5.5 | **tinjau lewat mode contoh** (prinsip 11), lalu bilang "lanjut" |
| 7 | 1.23 | Opus 5.5 · high | – |
| 8 | 1.24 + 1.25 | Sonnet 5.5 · high | – |
| 9 | 1.26 | Sonnet 5.5 · high | – |
| 10 | 1.27 (tanpa CSV asli) | Opus 5.5 · xhigh | letakkan CSV di `data-pribadi/lama/` |
| 11 | 1.27 (laporan CSV asli) + 1.28 | Opus 5.5 · high | paket tugas manual (CLI + login, age + passphrase, authenticator, Variables GitHub, URL Configuration, manual linking + MFA TOTP, secrets repo cadangan) |
| 12 | 1.29 | Sonnet 5.5 · high | jalankan SQL satu per satu, deploy functions, uji manual di HP/laptop |
| 13 | perbaikan hasil uji manual | Sonnet 5.5 · high | ⏰ B: verifikasi dua langkah GitHub/Supabase/Google |
| 14 | 1.30 | Opus 5.5 · high | jalankan SQL bootstrap, daftarkan DUA authenticator |
| 15 | 1.31 | Opus 5.5 · xhigh | secret key di `data-pribadi/.env`, tinjau laporan migrasi |
| – | 1.32 | manual | pilot 3–5 anggota |

Semua file SQL (001 dan seterusnya, serta `jadwal.sql`) **baru dijalankan di Supabase pada langkah 1.29** (kelompok 12).

**Putaran kedua tinjauan tampilan (kelompok 6c, Oktober 2026)**, ringkasan keputusan (rinciannya di bagian yang disebut):

- **Panel keterangan** (15.1): judul "KETERANGAN PRIBADI"; baris wajib ditulis "-" kalau kosong; "Wafat" hanya untuk yang sudah wafat; "Status pernikahan" dan "Pasangan" sesuai aturan.
- **Urutan anak** (5.4, 15.1): "Putra ke-n"/"Putri ke-n" (tidak pernah "Anak ke-n"), "Putri ke-3 dari 11 bersaudara"; hanya anak **kandung** yang bernomor dan dihitung (mengubah keputusan lama). SQL 003 (`private.is_birth_parent`) dan data contoh mengikuti.
- **Anak sambung/angkat** (15.1): tanpa nomor; "Anak sambung/angkat [nama]" di panelnya sendiri; di panel orang tua dengan keterangan kecil (mengubah aturan lama "hanya di panel anak itu").
- **Status pernikahan** (5.4): pilihan tetap; "Belum menikah" hanya pilihan orangnya sendiri (`people.marital_choice`, SL011).
- **"Berpisah"** menggantikan "cerai"/"bercerai" di semua tulisan; status berpisah hanya oleh salah satu pasangan, admin utama, atau izin `status_pernikahan` (SL010); pernikahan baru tidak pernah diblokir.
- **Bagan** (15.1): pernikahan berulang kiri ke kanan dengan "menikah kembali"; nomor urut di pojok; anak menurut umur; hati patah untuk berpisah; tunas daun untuk belum dewasa; legenda dinamis; tampilan awal laptop/HP.
- **Fokus cabang** (15.1, 15.3): "Hitung dari pangkal utama" atau "Hitung dari [nama]" (PANGKAL CABANG GEN.0), juga untuk PDF nanti.
- **"Disisihkan"** menggantikan "tempat sampah" (8.4): izin `sisihkan`, SQL `007_disisihkan_laporan.sql`.
- **Migrasi** (16.2, 16.3): laporan wajib mendaftar nama yang jenis kelaminnya belum diketahui; tidak pernah diisi asal.
- **Tes**: `src/tulisan.test.jsx` (tanpa "Anak ke-", "cerai", "tempat sampah", "Wafat: -" untuk yang masih hidup, "Belum menikah" otomatis; juga pesan SQL), `src/lib/silsilah/{anak,status,umur}.test.js`, `src/lib/bagan/cabang.test.js`, SQL 003/005, dan `src/contoh/kelengkapan.test.js`.

### Langkah Darurat

- ✅ Selesai: kunci tabel lama, matikan pendaftaran, repo lama privat.
- ⏳ Ditunda: 2FA dan penggantian kunci API. Keduanya muncul sebagai **pengingat ⏰** di tabel Fase 1 di bawah.

### Langkah 0: Persiapan

0.1 Semua pertanyaan sudah dijawab (bagian 21).
0.2 Tugas manual bagian 19.B.
0.3 Siapkan `data-pribadi/daftar-nama.txt` untuk pemindai (setelah langkah 1.1).

### Fase 1: Fondasi, Keamanan, Silsilah Inti, Migrasi

| # | Kerjakan | Tes |
|---|---|---|
| 1.1 | Buat repo `silsilah` (publik, kosong) dan `silsilah-cadangan` (privat, kosong) dengan `gh`. Kerangka repo gaya NUTRIHUB: JS, Vite, React, Tailwind, oxlint, Vitest, versi dipatok, `.nvmrc`, `.gitignore` dengan `data-pribadi/` dan `.env*`. | `npm test`, `npm run build` hijau. Isi `data-pribadi/` tidak terlihat oleh git. Kedua repo ada dengan visibilitas yang benar. |
| 1.2 | Pemindai `cek-data-pribadi` (pre-commit + CI) | Commit berisi nama dari daftar → ditolak. |
| 1.3 | Deploy Pages: `noindex`, `lang="id"`, `HashRouter`, `VITE_BASE_PATH` di satu tempat, mode contoh hanya di build pengembangan | Situs terbuka. Tes: build produksi tidak memuat mode contoh. |
| 1.4 | Kerangka tes PGlite + tiruan Supabase (`auth.uid/jwt`, `session_id`, `aal`, storage, Vault) | Tes kosong berjalan. |
| 1.5 | SQL 001: schema `private`, pencabutan hak default, `settings`, `app_migrations` | PGlite: anon tidak punya hak apa pun. |
| 1.6 | SQL 002: `people`, `unions` (pernikahan berulang dengan pasangan sama), `children` (kandung/sambung/angkat), `birth_ranks` (per orang tua), `origin_trees`, tanggal kabur | PGlite: constraint tanggal, pernikahan berulang diterima, anak dari pasangan sepupu punya dua urutan. |
| 1.7 | SQL 003: trigger `version`, anti-siklus, pangkal tanpa orang tua, konsistensi pohon, `birth_ranks` otomatis + peringatan | PGlite: semua aturan. |
| 1.8 | SQL 004: `members` (admin utama kebal), `devices` (jenis perangkat, kota/negara perkiraan), `invites` (aturan dewasa: 18+ atau menikah), `device_codes`, `auth_events`, `login_ips` (dihapus setelah 30 hari), fungsi `current_member/can_edit/has_perm/is_owner` | PGlite: perangkat dicabut/kedaluwarsa → tidak ada data; admin tanpa `aal2` → bukan admin; IP berumur > 30 hari terhapus; undangan untuk anak 16 tahun yang belum menikah ditolak. |
| 1.9 | SQL 005: RLS + hak silsilah dan pohon keluarga asal (`grant_all_descendants` dinamis, izinkan/tolak) | PGlite: matriks peran lengkap; keturunan baru otomatis mendapat akses. |
| 1.10 | SQL 006: `change_log`, undo (sendiri vs izin), deteksi aktivitas tidak wajar + penahanan | PGlite: anggota tidak bisa undo milik orang lain; penahanan aktif setelah ambang. |
| 1.11 | SQL 007: `reports`, menyisihkan data (izin), pulihkan, hapus permanen satu kelompok/semuanya (admin utama), "pindahkan ke orang tua lain" | PGlite. |
| 1.12 | SQL 008: `snapshots` (berdasarkan perubahan, bertingkat, khusus) + file jadwal `pg_cron` | PGlite: tanpa perubahan → tidak ada snapshot baru; perapian sesuai 30/12/12. |
| 1.13 | Logika murni: tanggal, "ke-n", graf, GEN + istilah Jawa (GEN.11+ tanpa istilah), jalur terdekat untuk pasangan sepupu, urutan lahir lintas pernikahan per orang tua, "istri/suami ke-n", label kartu dan detail, Alm./Almh., nomor silsilah, istilah kerabat pohon keluarga asal (`kerabat.js`) | Vitest dengan keluarga fiktif, termasuk contoh 1–3/4–5/6–7/8–11, pernikahan antarsepupu, dan Pakdhe/Paklik. |
| 1.14 | `teks/id.js` + pemetaan error + deteksi "sedang dipulihkan" dan "database belum diperbarui" | Tes: tidak ada pesan bahasa Inggris yang lolos. |
| ✅ | **Pengingat A: ganti kunci API** (bagian 2.4). **SELESAI 7 Oktober 2026:** publishable `aplikasi_silsilah`, secret `server_silsilah`, kunci lama dihapus, JWT-based dimatikan. Tersisa: uji `curl` dengan kunci lama dan Security Advisor (paling lambat di 1.29). | Kunci lama → error. |
| 1.15 | Edge Functions `pakai-undangan`, `pakai-kode` + RPC buat undangan/kode + klaim perangkat | Unit test + uji manual di HP. Link sekali pakai, 7 hari, kode 10 menit. |
| 1.16 | Perkiraan lokasi login dari IP: database DB-IP Lite **offline** (uji ukuran dan kelayakan di Edge Function; cadangan: tingkat negara saja), simpan kota/negara/jenis perangkat/waktu, IP mentah ≤ 30 hari, deteksi login mencurigakan, notifikasi admin (satu per satu atau ringkasan per jam; yang mencurigakan selalu langsung dengan "Cabut perangkat ini") | Tes: IP contoh → negara/kota benar; tidak ada permintaan jaringan ke layanan luar; perangkat dicabut yang mencoba lagi → notifikasi langsung. |
| 1.17 | Layar Masuk, Undangan/Kode, Selamat datang, Tambah perangkat (QR), Perangkat saya, Keluar (hapus data lokal), **halaman Privasi** | Manual: Android, iPhone (Safari + layar utama), laptop. Halaman Privasi bisa dibuka tanpa login dan tidak memuat data. |
| 1.18 | Akses sementara + hitung mundur + hapus data otomatis + notifikasi admin (kotak masuk) | Manual: akses 30 menit habis → keluar dan data terhapus; RLS menolak. |
| 1.19 | Verifikasi dua langkah admin (TOTP; passkey kalau tersedia) | Admin tanpa `aal2` tidak bisa membuka fungsi admin. |
| 1.20 | Lapisan data: muat semua, Realtime, cache offline tanpa kontak, layar error, **tanpa penulisan otomatis** (+ SQL 014: Realtime dan penanda data yang disisihkan) | Tes: Supabase gagal → tidak ada panggilan insert/update. |
| 1.21 | Layar Daftar + Detail (termasuk kedua jalur untuk pasangan sepupu) | Tes komponen dengan data fiktif. |
| 1.22 | Bagan kartu dasar (istilah Jawa, GEN, keterangan anak ke-n) | Dicek dengan data fiktif yang rumit. |
| 1.23 | Form orang/pernikahan/anak + `version` + merge + peringatan "baru saja diubah" | Dua browser. |
| 1.24 | Riwayat + Batalkan, Laporkan kesalahan + layar Laporan, Data yang disisihkan | Manual + tes. |
| 1.25 | Admin: Anggota & Undangan (aturan dewasa + centang "sudah dewasa"), izin asisten (centang), perangkat, cabut, log login | Manual. |
| 1.26 | Pohon keluarga asal: editor admin, istilah dari sudut pandang pasangan khusus, layar akses + tombol "Beri akses ke semua keturunan …" | PGlite + manual: yang tidak diberi akses tidak melihat apa pun. |
| 1.27 | Skrip migrasi `ubah` + `verifikasi` (struktur, tanggal/tempat lahir-wafat, bio → catatan) | Tes data fiktif, termasuk tanggal teks yang aneh; laporan dari CSV asli (lokal). |
| 1.28 | Repo privat `silsilah-cadangan`: workflow backup (hanya jika berubah, age+passphrase, Releases, retensi, uji pulih) + workflow bulanan pembaruan database lokasi IP (unduh CSV DB-IP City Lite → `npm run lokasi-ip:buat` → unggah `lokasi-ip.bin.gz` ke bucket privat `lokasi-ip`; kota ID+IT, negara untuk lainnya) | Workflow hijau; Anda berhasil membuka satu file dengan `age -d`. |
| 1.29 | Jalankan SQL 001–009 (dan seterusnya) di cloud, deploy Edge Functions, lalu `jadwal.sql` (pg_cron), cek hasil, Security Advisor, uji `curl` tanpa login → ditolak; uji dengan data fiktif, lalu reset | Semua lulus. |
| ⏰ | **Pengingat B untuk Anda: aktifkan verifikasi dua langkah** di GitHub, Supabase, dan Google (bagian 2.1). Ini **wajib sebelum 1.30**, karena setelah itu akun-akun ini menjaga data asli. | Anda konfirmasi ketiganya aktif. |
| 1.30 | Bootstrap admin utama (SQL dari saya) + TOTP | Anda masuk sebagai admin dengan `aal2`. |
| 1.31 | Migrasi ke cloud + verifikasi + pangkal + pohon keluarga asal A/B | Verifikasi 100% cocok. |
| 1.32 | Pilot: 3–5 anggota (termasuk 1–2 yang lebih tua) | Catatan masukan. |

### Fase 2: Kenyamanan, Data Kontak, Notifikasi, Kumpul Keluarga, Kabar Keluarga

**2A. Kenyamanan**

| # | Kerjakan | Tes |
|---|---|---|
| 2.1 | Bagan lengkap: banyak pernikahan, mode fokus, *breadcrumb*, Tampilkan saya, tambah dari kartu | Tes tata letak + HP. |
| 2.2 | Pencarian semua hasil + ejaan | Vitest. |
| 2.3 | Pengaturan huruf/kontras + audit aksesibilitas (axe) | Tanpa pelanggaran; tiga ukuran huruf. |
| 2.4 | PWA (pasang, versi baru, panduan iPhone dengan kode perangkat) | Lighthouse; mode pesawat. |
| 2.5 | Masuk dengan Google (hanya akun terdaftar) | Akun Google tak terdaftar → ditolak. |
| 2.6 | Cetak/PDF cabang (Daftar + Bagan berhalaman) | Cabang terbesar ke PDF tanpa kartu terpotong. |
| 2.7 | Admin: pulihkan snapshot, unduh backup, ekspor seluruh data, pemeriksaan akses berkala, pengingat unduh backup | Pulihkan di PGlite → data sama. |

**2B. Data kontak**

| # | Kerjakan | Tes |
|---|---|---|
| 2.8 | SQL 009: `private.contacts` terenkripsi (Vault), RPC buka/ganti, log, kuota per orang, tambah kuota, pencarian wilayah/nomor | PGlite: "lihat" ditolak, kuota ke-21 ditahan, orang sama tidak dihitung ulang. |
| 2.9 | UI Tampilkan 30 detik + tanda air; tidak ikut offline/cetak | Tes: cache offline dan hasil cetak tidak memuat kontak. |
| 2.10 | Unduh kontak PDF berpassword acak + notifikasi | PDF terbuka di HP/komputer biasa hanya dengan password. |

**2C. Notifikasi push**

| # | Kerjakan | Tes |
|---|---|---|
| 2.11 | Web Push: VAPID, langganan per perangkat, handler service worker, antrean, jam tenang per zona waktu, kotak masuk, notifikasi admin | Android + iPhone layar utama. |
| 2.12 | **Peluncuran ke semua anggota** (bertahap per cabang) | Pantau undangan dan error. |

**2D. Kumpul Keluarga**

| # | Kerjakan | Tes |
|---|---|---|
| 2.13 | SQL 010: `gatherings`, `rsvps`, `swaps`, RPC tuan rumah, pengingat dan cek H-14 | PGlite: tuan rumah tidak bisa mengubah tanggal. |
| 2.14 | Komponen peta bersama + pencarian tempat + pembaca link lokasi | Vitest untuk pembaca link (koordinat fiktif). |
| 2.15 | UI jadwal, rencana 12 bulan, detail tuan rumah, kehadiran, tukar jadwal, tombol Maps | Manual. |
| 2.16 | Bagikan ke WhatsApp (izin) | Pesan terisi benar. |
| 2.17 | SQL 011 + UI Kas: catatan, kategori, bukti foto (Storage), tutup buku, laporan PDF, total untuk semua | PGlite: bulan tertutup → perubahan ditolak. |

**2E. Kabar Keluarga**

| # | Kerjakan | Tes |
|---|---|---|
| 2.18 | SQL 012: `news` dan turunannya, batas harian, konfirmasi, sembunyikan, sematkan, laporan | PGlite. |
| 2.19 | UI kabar: jenis, tanggapan, komentar, arsip, "Kabar terkait" | Manual. |
| 2.20 | Lokasi kejadian: GPS sekali ambil, cari tempat, tempel link (Edge Function `baca-link-lokasi`), geser pin, sumber, riwayat, lokasi utama | Vitest + manual. |
| 2.21 | Notifikasi kabar: semua anggota, jam tenang, prioritas "dekat" (urutan a/b/c), tanpa alamat | Tes perhitungan jarak; isi notifikasi tidak memuat lokasi anggota. |
| 2.22 | Darurat: "Saya bisa membantu", bagikan lokasi, daftar dengan jarak (terbatas), Selesai | PGlite: anggota biasa hanya melihat jumlah. |
| 2.23 | Terhubung ke silsilah: kelahiran, pernikahan, wafat (menunggu konfirmasi) | Manual. |
| 2.24 | Kedaluwarsa lokasi anggota (12 jam / selesai, jarak tetap tersimpan), status "Sedang berada di …", penghapusan alamat pertemuan 12 jam setelah acara | PGlite: koordinat dan alamat terhapus tepat waktu. |
| 2.25 | Tes Playwright alur utama (mode contoh) + sesi uji coba dengan anggota yang lebih tua | CI hijau; daftar perbaikan. |

### Fase 3: Arsip Keluarga

- **Foto keluarga**: bucket privat, dikompres, URL bertanda tangan.
- **Foto anggota** (avatar di kartu dan panel keterangan). Persyaratan keamanan, **ditetapkan sekarang** (Oktober 2026):
  - Disimpan di bucket Storage **privat**; hanya bisa dilihat anggota yang login dari perangkat yang sah.
  - Ditampilkan lewat **signed URL yang kedaluwarsa dalam hitungan menit**. Ini mekanisme di belakang layar: foto **tetap tampil tanpa batas waktu dan tanpa hitung mundur** selama dibuka di perangkat anggota sendiri, dan aplikasi membuat link baru secara otomatis. Batas waktu tampil hanya berlaku di perangkat akses sementara (yang otomatis keluar saat waktunya habis).
  - Saat unggah, **semua metadata yang bisa dipakai melacak seseorang dihapus**, bukan hanya GPS: EXIF, XMP, IPTC, waktu pemotretan, merek/model/nomor seri perangkat, nama pemilik, dan thumbnail tersembunyi. Caranya: foto **digambar ulang menjadi file baru yang bersih**, dan nama file aslinya diganti.
  - Foto **dikecilkan otomatis** dan **tidak disimpan offline** di HP.
  - Foto anak di bawah umur hanya bisa diunggah oleh orang tuanya, admin utama, atau asisten yang diizinkan.
  - Setiap unggah/hapus tercatat; perlindungannya setara data kontak (bagian 7).
  - Mode contoh mendapat foto fiktif saat fitur ini dibuat (prinsip 12).
- **Cerita/kenangan**.
- **Pengingat ulang tahun**.
- **Tanggal Hijriah dan pengingat haul**.
- **Notulen dan foto Kumpul Keluarga**.

---

## 18. Panduan Ganti ke Domain Sendiri (nanti)

Aplikasi sudah disiapkan sejak awal, jadi tidak ada yang perlu dirombak.

1. **Beli domain**, misalnya `silsilah.contoh.id` (subdomain paling mudah).
2. **DNS** di penyedia domain:
   - Subdomain: buat record `CNAME silsilah → <akun>.github.io`.
   - Domain utama: buat record A ke IP GitHub Pages (185.199.108.153, .109.153, .110.153, .111.153).
3. **GitHub** repo `silsilah` → Settings → Pages → Custom domain → isi domain → Save → tunggu centang hijau → aktifkan **Enforce HTTPS**.
4. **GitHub** → Settings → Secrets and variables → Variables → ubah `VITE_BASE_PATH` dari `/silsilah/` menjadi `/` → jalankan ulang deploy.
5. **Supabase** → Authentication → URL Configuration: ubah Site URL dan tambahkan domain baru di Redirect URLs. Hapus alamat lama setelah semuanya pindah.
6. **Google Cloud** (kalau login Google aktif): tambahkan domain baru di *Authorized JavaScript origins*.
7. **Hal yang perlu diketahui**:
   - Login, data offline, notifikasi, dan pemasangan PWA tersimpan per alamat situs. Anggota perlu masuk lagi sekali di alamat baru: alamat lama otomatis diarahkan ke yang baru, dan anggota cukup memakai "Masuk dengan kode" dari perangkat lama yang masih terbuka, atau link baru dari admin.
   - Mereka juga perlu memasang ulang ikon di layar utama dan mengizinkan notifikasi lagi.
   - Passkey admin (kalau ada) perlu didaftarkan ulang.
   - Karena itu, **lebih baik pindah domain sebelum peluncuran ke semua anggota** kalau rencananya sudah ada.

---

## 19. Tugas Manual untuk Anda (berurutan)

### A. Langkah darurat (bagian 2)

1. ✅ Jalankan `supabase/000_kunci_tabel_lama.sql`. **Selesai.**
2. ✅ Matikan "Allow new users to sign up" dan periksa Users. **Selesai.**
3. ✅ Jadikan repo lama privat, situs 404, fork = 0. **Selesai.**
4. ✅ **Ganti kunci API** (bagian 2.4): **selesai 7 Oktober 2026** (kunci baru dibuat, kunci lama dan JWT-based dimatikan). Tersisa: uji `curl` dengan kunci lama dan Security Advisor, paling lambat di langkah 1.29.
5. ⏳ **Aktifkan verifikasi dua langkah** di GitHub, Supabase, dan Google (bagian 2.1). **Paling lambat sebelum langkah 1.30** (pengingat ⏰ B).
6. *(Kalau perlu)* Cari situs lama di Google dan ajukan penghapusan konten usang.

### B. Sebelum Fase 1

7. ~~Buat repo~~: **saya yang membuat** `silsilah` (publik) dan `silsilah-cadangan` (privat) dengan `gh` di langkah 1.1, termasuk mengatur Pages ke GitHub Actions lewat API. `gh` di Mac ini sudah login sebagai akun Anda dengan izin `repo`, jadi Anda tidak perlu menyiapkan apa pun untuk ini.
8. Pasang Supabase CLI (`brew install supabase/tap/supabase`, tanpa Docker), lalu jalankan `supabase login` sendiri. Baru dibutuhkan di langkah 1.15.
9. Pasang `age` (`brew install age`) untuk membuka backup. Baru dibutuhkan di langkah 1.28.
10. Buat **passphrase backup** yang panjang (misalnya 6–7 kata acak). Simpan di pengelola kata sandi **dan** salinan kertas di tempat aman. Jangan dikirim ke saya.
11. Siapkan aplikasi authenticator untuk TOTP admin (aplikasi Kata Sandi di iPhone bisa).

### C. Selama Fase 1 (saya beri tahu saat waktunya)

12. Repo `silsilah` → Settings → Secrets and variables → Actions → **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_BASE_PATH` = `/silsilah/`.
13. Supabase → Authentication → URL Configuration: Site URL = alamat Pages; Redirect URLs = alamat Pages + `http://localhost:5173`.
14. Supabase → Authentication: aktifkan **manual linking**, dan pastikan MFA TOTP aktif.
15. Jalankan file SQL 001–009 (dan file bernomor berikutnya yang sudah ada saat itu) satu per satu (langkah 1.29) di SQL Editor, lalu `jadwal.sql` (tugas otomatis pg_cron; kalau gagal, aktifkan dulu ekstensi pg_cron di Dashboard → Database → Extensions), dan kirimkan hasil pemeriksaannya ke saya.
16. *Deploy* Edge Functions `pakai-undangan`, `pakai-kode`, dan `cek-perangkat` (perintah ada di README, dijalankan oleh Anda). Sebelumnya isi Edge Functions → Secrets: `KUNCI_SERVER` (secret key `server_silsilah`; tempel langsung di dashboard, jangan ke chat) dan `ASAL_APLIKASI` (alamat Pages). Pastikan provider **Email** di Authentication aktif (dipakai untuk tautan masuk tanpa email terkirim), sementara "Allow new users to sign up" tetap mati.
17. Jalankan SQL **bootstrap admin utama**, ketuk link pertama Anda, lalu daftarkan TOTP (dan passkey kalau tersedia).
18. Repo `silsilah-cadangan` → Secrets: `SUPABASE_DB_URL` (connection string **Session pooler** dari Connect → berisi password database) dan `BACKUP_PASSPHRASE`.
19. Letakkan CSV backup di `data-pribadi/lama/` dan secret key Supabase di `data-pribadi/.env`.
20. Tinjau laporan migrasi dan isi koreksi bersama saya.
21. Setelah migrasi: periksa bersama 1–2 anggota senior, lalu tentukan asisten dan izinnya.

### D. Fase 2

22. Masukkan **VAPID keys** (saya buatkan) sebagai Edge Function secrets untuk notifikasi push.
23. *(Opsional)* **Google**: buat OAuth Client di Google Cloud Console (layar persetujuan "Silsilah Keluarga", redirect `https://<ref>.supabase.co/auth/v1/callback`), lalu masukkan ke Supabase → Providers → Google.
24. Kirim undangan lewat WhatsApp secara bertahap per cabang.
25. Unduh backup dua kali setahun dan coba buka (aplikasi akan mengingatkan).
26. Setelah ±3 bulan: putuskan kapan `family_tree_lama` dan repo lama dihapus.

---

## 20. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Data lama terbuka untuk umum | ✅ Teratasi: tabel dikunci, pendaftaran dimatikan, repo lama privat. |
| **Kunci API sudah diganti** (7 Oktober 2026); uji `curl` kunci lama dan Security Advisor belum dikonfirmasi | Kunci lama sudah dimatikan dan tabel terkunci. Uji `curl` dan Security Advisor dijalankan paling lambat di langkah 1.29. |
| **2FA belum aktif** di GitHub/Supabase/Google | Wajib sebelum langkah 1.30 (⏰ B), yaitu sebelum data asli masuk ke struktur baru. |
| Riwayat repo lama memuat nama dan kunci | Repo dijadikan privat, kunci legacy dimatikan, fork diperiksa, dan konten usang dihapus dari Google. |
| Link sekali pakai "habis" di browser yang salah (browser dalam aplikasi, pratinjau link) | Link baru dipakai setelah tombol Masuk ditekan; ada deteksi browser dalam aplikasi; admin bisa membuat ulang link. |
| iPhone: aplikasi layar utama terpisah dari Safari; push hanya untuk aplikasi terpasang | Masuk dengan kode perangkat, panduan bergambar, kotak masuk sebagai cadangan push. |
| Passkey/WebAuthn mungkin belum didukung Supabase Free | TOTP wajib (bisa dibuka dengan Face ID lewat aplikasi Kata Sandi iPhone); passkey ditambahkan begitu tersedia. |
| **Hanya satu admin utama** (titik lemah tunggal) | Asisten menangani pekerjaan harian; prosedur darurat penggantian admin lewat SQL tertulis di README; kode pemulihan TOTP dan akses akun Supabase/GitHub dengan 2FA disimpan dengan aman. |
| Passphrase backup hilang | Disimpan di dua tempat; pengingat uji buka dua kali setahun. |
| Passphrase tersimpan sebagai GitHub Secret | Hanya Anda yang punya akses tulis, 2FA wajib, dan secret tidak bisa dibaca kembali. |
| Project Free dijeda / aturan Supabase berubah | Backup harian membaca database; pesan "Sedang dipulihkan"; backup GitHub di luar Supabase. |
| Tidak ada project kedua untuk staging | Semua SQL dites di PGlite; mode contoh untuk UI; database produksi dipakai sebagai staging hanya sebelum migrasi; snapshot sebelum setiap perubahan skema. |
| Kesalahan RLS → kebocoran | Matriks tes PGlite di CI; data sensitif di schema `private` yang tidak terbuka ke API; uji `curl`; Security Advisor. |
| Data kontak bocor lewat foto layar | Tidak bisa dicegah sepenuhnya. Tanda air nama + waktu, tampil 30 detik, kuota harian, dan log per pembukaan membuat penyalahgunaan bisa dilacak. |
| Library PDF berpassword tidak andal di browser | Diuji di langkah 2.10 (enkripsi AES standar yang bisa dibuka di HP/komputer biasa). Kalau tidak ada yang layak, saya ajukan alternatif sebelum membangun. |
| Privasi lokasi | Tanpa pelacakan latar belakang, koordinat anggota dihapus setelah 12 jam, jarak dihitung di server, notifikasi tanpa lokasi anggota, alamat pertemuan dihapus 12 jam setelah acara. |
| Batas layanan OpenStreetMap/Nominatim | Pemakaian keluarga sangat kecil, pencarian hanya saat tombol ditekan, ada atribusi; penyedia bisa diganti di satu tempat. |
| Kabar keliru/hoaks dan kepanikan | Label "Belum dikonfirmasi", konfirmasi oleh asisten/admin, batas harian, laporan, sembunyikan; wafat tidak langsung mengubah silsilah. |
| Terlalu banyak notifikasi (anggota mematikan izin) | Jam tenang, prioritas hanya untuk duka/darurat yang dekat, mode ringkasan login untuk admin. |
| Integritas kas | Tutup buku bulanan, semua perubahan tercatat, membuka kembali hanya oleh admin utama dengan alasan. |
| Zona waktu (anggota di luar Indonesia, termasuk admin utama) | Jam tenang per zona waktu perangkat; jadwal ditampilkan dalam WIB beserta waktu setempat; kuota kontak direset pukul 00.00 WIB. |
| Perkiraan lokasi login dari IP meleset (jaringan seluler, VPN) | Selalu ditulis "sekitar …"; hanya untuk bahan pertimbangan admin, tidak memblokir apa pun secara otomatis. |
| Database lokasi IP offline terlalu besar untuk Edge Function | Hanya negara-negara yang relevan yang memuat data kota; cadangannya tingkat negara saja (diuji di 1.16). IP tetap tidak dikirim ke pihak ketiga. |
| Login mencurigakan palsu (misalnya anggota sedang bepergian ke luar negeri) | Notifikasi hanya meminta perhatian; admin memutuskan sendiri apakah menekan "Cabut perangkat ini". |
| Alamat pertemuan tertinggal di HP setelah acara | Aplikasi menyembunyikan dan membuangnya berdasarkan jam, walaupun offline; database menghapusnya paling lambat 12 jam setelah acara. |
| Kuota Free (500 MB DB, 1 GB Storage, Edge Functions, Realtime) | Perkiraan ukuran di bagian 9; foto dikompres; peringatan ukuran untuk admin. |
| Lingkup Fase 2 besar | Dikerjakan per blok (2A–2E); setiap blok bisa dipakai sendiri; peluncuran setelah 2C. |
| Kualitas data lama | Laporan "perlu dicek", koreksi terdokumentasi, verifikasi 100%, pemeriksaan oleh anggota senior. |
| UU PDP (data pribadi) | Hanya untuk anggota, kontak terenkripsi dan tercatat, lokasi sementara, hapus permanen atas permintaan; catatan privasi di layar Selamat datang. |

---

## 21. Pertanyaan

**Tidak ada pertanyaan terbuka.** Semua keputusan sudah tercatat di bagian-bagian terkait:

- Migrasi: struktur, tanggal/tempat, dan "bio" → catatan (16.2).
- Pernikahan antarsepupu: GEN mengikuti jalur yang paling dekat ke pangkal, kedua jalur ditampilkan, dan "Putra/Putri ke-n" dihitung per orang tua (5.4, 15.1).
- Putaran kedua tinjauan tampilan (Oktober 2026): "Putra/Putri ke-n" hanya untuk anak kandung; status pernikahan sebagai pilihan tetap ("Belum menikah" hanya pilihan sendiri); kata "Berpisah" menggantikan "cerai"; siapa yang boleh menandai pernikahan berakhir (5.4, 15.1).
- GEN.11 dan seterusnya tanpa istilah (5.4, 15.1).
- Pohon keluarga asal: akses dinamis untuk keturunan yang lahir nanti, istilah dari sudut pandang pasangan khusus (5.4).
- Undangan: 18 tahun ke atas atau sudah menikah; kalau tanggal lahir tidak diketahui, admin/asisten yang memutuskan (6.1).
- Lokasi: dipakai diam-diam selama 12 jam, lalu koordinat dihapus (5.9, 12).
- Daftar "bisa membantu": penulis, admin, asisten dengan izin "Konfirmasi kabar"; radius 50 km (4.2, 12).
- Anggota "hanya melihat": boleh mengisi kehadiran dan memberi tanggapan singkat (4.2).
- Kas: total per kategori dan daftar pengeluaran terbuka untuk semua; foto bukti terbatas (5.8, 11).
- Alamat pertemuan: terbuka sampai paling lambat 12 jam setelah acara; daftar nama yang hadir terbuka untuk semua (11).
- Pengingat hari H: 07.00 dan 2 jam sebelum acara (11).
- Zona waktu dan notifikasi login (6.1, 10).
- Pembuatan repo dengan `gh` di langkah 1.1.
