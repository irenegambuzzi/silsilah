# Silsilah Keluarga

Aplikasi web silsilah keluarga, khusus untuk anggota keluarga yang diundang.
Rencana lengkap: [PLAN.md](PLAN.md).

## Stack

- Vite + React (JavaScript), Tailwind CSS v4
- Supabase (Postgres + RLS) — menyusul
- Hosting: GitHub Pages — menyusul

## Pengembangan

1. Node 22 (lihat `.nvmrc`).
2. `npm install`
3. `npm run dev` — menjalankan aplikasi di komputer sendiri.
4. `npm test` — menjalankan semua tes.
5. `npm run lint` — memeriksa kode.

## Mencoba tampilan (mode contoh)

`npm run dev:contoh` menjalankan aplikasi dengan server tiruan di memori dan
data fiktif, tanpa database. Hanya ada di build pengembangan; tes build
memastikan tidak ikut ke produksi. Alamat yang bisa dicoba (setelah menjalankan
perintah itu, buka alamat yang tampil di Terminal):

| Alamat | Hasil |
|---|---|
| `/#/u/` + 43 huruf `A` | link undangan berhasil → "Selamat datang" |
| `/#/u/` + 43 huruf `B` / `C` / `E` / `D` | sudah dipakai / kedaluwarsa / dibatalkan / gangguan server |
| kode `ABCD2345` di layar Masuk | masuk sebagai perangkat tambahan |
| kode `AKSES234` | masuk dengan akses sementara 30 menit (spanduk hitung mundur; data dihapus saat habis) |
| kode `PENGURUS` | masuk sebagai asisten admin: Kotak masuk berisi contoh pemberitahuan, dan menu Saya → "Beri akses sementara" (pilih "Bu Contoh", buat kode, lalu pakai kode itu di jendela lain) |
| kode `UTAMA234` | masuk sebagai admin utama: layar admin (Saya → "Beri akses sementara") terkunci sampai verifikasi dua langkah. Authenticator di mode contoh **tiruan**: kode yang diterima hanya `123456` (kunci/QR yang tampil bukan kunci sungguhan) |
| `/#/privasi` | halaman Privasi |
| Beranda setelah masuk | jumlah orang di silsilah contoh (keluarga fiktif): tanda data silsilah sudah termuat |
| menu Daftar (atau `/#/daftar`) | daftar keluarga fiktif menurut nomor silsilah, dengan kotak pencarian; ketuk satu nama untuk membuka keterangannya |
| menu Bagan (atau `/#/bagan`) | bagan kartu keluarga fiktif, mula-mula tampil utuh. Geser dengan satu jari (di laptop: seret dengan mouse atau tombol panah), perbesar/perkecil dengan dua jari (di laptop: Ctrl + roda mouse) atau tombol + / − ; "Pusatkan" kembali ke seluruh bagan. Ketuk satu kartu → panel keterangan di kanan (di HP: dari bawah) dengan "Fokus pada cabang ini". Di Saya, coba ukuran huruf Sangat besar dan Kontras tinggi: bagan ikut berubah |
| offline | setelah data termuat, matikan internet (atau DevTools → Network → Offline) lalu muat ulang halaman: aplikasi terbuka dari salinan di perangkat, dengan spanduk "Anda sedang offline". Nyalakan lagi internet: spanduk hilang. Dengan kode `AKSES234` tidak ada salinan (perangkat pinjaman) |

### Kasus khusus di data contoh

Data contoh harus selalu memuat semua kasus yang sudah didukung (tes
`src/contoh/kelengkapan.test.js`). Cari namanya di Bagan atau Daftar:

| Kasus | Di mana |
|---|---|
| Pasangan pangkal, keduanya wafat | Alm. Raksa & Almh. Selara (kartu emas, strip dan simbol hitam arang) |
| Banyak pernikahan, menikah lagi dengan pasangan yang sama, cerai | Bima: Istri ke-1 Eka (dua kali menikah, bercerai), Istri ke-2 Fitri (bercerai), Istri ke-3 Gita. Garis putus-putus = bercerai |
| Ditinggal wafat lalu menikah lagi | Ika: Suami ke-1 Alm. H. Halvin, Suami ke-2 Joval, S.E. Juga Hj. Dara (istri Alm. Tirwan) |
| Keturunan wafat / pasangan wafat | Alm. Tirwan (kartu hitam arang) / Alm. H. Halvin (kartu arang lebih muda) |
| Anak wafat saat bayi | Almh. Sekar, anak Ika (dengan catatan) |
| Anak sambung / anak angkat | Vino (anak Cahya & Umar) / Yoga (anak Lorvan & Sinta): keterangannya hanya di panel anak itu |
| Antarsepupu, generasi sama | Tamran & Wati, anaknya Nirvo |
| Antarsepupu, generasi berbeda | Rangga & Gendis, anaknya Hasna |
| Pasangan tidak diketahui | Lintang, anaknya Arya |
| Jenis kelamin tidak diketahui | Ragil, anak Alm. Tirwan (kartu abu) |
| Gelar religius / pendidikan | H. Halvin, Hj. Dara / Dorvi, S.Kom., Laras, S.Ked., Joval, S.E. |
| Nama panggilan | Dorvi, Joval, Hj. Dara, H. Halvin |
| Tanggal kabur | H. Halvin "sekitar 1968"; Hj. Dara "Juni 1978"; tahun saja di banyak orang; tanggal lengkap: Dorvi |
| Pekerjaan / catatan | Dorvi, Laras, Joval, H. Halvin, Alm. Tirwan / Almh. Sekar, Alm. Tirwan |
| Anak di bawah umur | Bayu, Nala, Ragil, Hasna |
| Pohon keluarga asal | Eka (pasangan khusus A) dan Hj. Dara (pasangan khusus B). Hanya dimuat untuk admin utama (kode `UTAMA234`); layarnya belum dibuat |
| Alamat dan nomor HP fiktif | `src/contoh/kontakContoh.js` (24 orang); layar data kontak belum dibuat |

## Menyambungkan ke database

Aplikasi membaca dua variabel build (isi di Settings → Secrets and variables →
Actions → Variables di GitHub, atau di berkas `.env.local` untuk pengembangan;
keduanya aman untuk publik, bukan rahasia):

- `VITE_SUPABASE_URL`: alamat project Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key (`sb_publishable_…`)

Tanpa keduanya, aplikasi menampilkan "Aplikasi belum siap".

## Aturan repo

- **Tidak ada nama atau data keluarga di repo.** Data pribadi hanya di
  folder `data-pribadi/` (di-gitignore) dan di database.
- Versi library dipatok persis (`.npmrc` berisi `save-exact=true`).

## Edge Functions

`supabase/functions/pakai-undangan` (link undangan),
`supabase/functions/pakai-kode` (kode tambah perangkat / akses sementara), dan
`supabase/functions/cek-perangkat` (dipanggil setiap aplikasi dibuka: terakhir
aktif, dan laporan ke admin kalau perangkat yang sudah dicabut dibuka lagi).
Logikanya ada di `supabase/functions/_shared/` dan dites di Node bersama
database tes (`npm test`). Database tetap diatur lewat file SQL bernomor di
SQL Editor, bukan lewat CLI.

Pengaturan (Supabase → Edge Functions → Secrets). **Isi kunci tidak pernah
ditulis di repo, chat, atau email.**

| Nama | Isi |
|---|---|
| `KUNCI_SERVER` | secret key project (`sb_secret_…`) |
| `ASAL_APLIKASI` | alamat situs, misalnya `https://<akun>.github.io` (beberapa: pisahkan dengan koma) |
| `DOMAIN_EMAIL_SINTETIS` | opsional; bawaan `silsilah.invalid` (tidak ada email yang dikirim) |

Deploy (Supabase CLI, tanpa Docker), dari folder repo:

```
supabase functions deploy pakai-undangan --use-api --no-verify-jwt --project-ref <ref>
supabase functions deploy pakai-kode --use-api --no-verify-jwt --project-ref <ref>
supabase functions deploy cek-perangkat --use-api --no-verify-jwt --project-ref <ref>
```

`--no-verify-jwt` disengaja (juga tertulis di `supabase/config.toml`): yang
memanggil `pakai-undangan` dan `pakai-kode` belum login, dan `cek-perangkat`
memeriksa token login sendiri (`getClaims`). Keamanannya dari token/kode itu
sendiri (sekali pakai, ber-hash, kedaluwarsa) dan batas percobaan di SQL 009.
Login memakai tautan masuk (magic link) tanpa email terkirim, jadi provider
**Email** di Authentication harus aktif, sedangkan "Allow new users to sign
up" tetap mati.

## Verifikasi dua langkah admin utama

Admin utama masuk seperti anggota lain, lalu memasukkan kode 6 angka dari
aplikasi authenticator (TOTP; misalnya aplikasi Kata Sandi di iPhone, bagian
Kode Verifikasi). Tanpa itu, database memperlakukan admin utama sebagai
anggota biasa (`is_owner()` di SQL 004 menuntut sesi `aal2`), dan aplikasi
mengunci semua layar `/admin/…`. Verifikasi berlaku per perangkat, sampai
perangkat itu keluar.

- Pengaturan Supabase: Authentication → Multi-Factor → **TOTP aktif** (bawaan
  menyala). Passkey/WebAuthn Supabase masih beta (diumumkan Mei 2026, API
  eksperimental), jadi belum dipakai; begitu juga kode pemulihan bawaan
  Supabase (eksperimental).
- Daftarkan **dua** authenticator: "Utama" dan "Cadangan" (HP/tablet kedua,
  atau kunci yang ditampilkan saat mendaftar, disalin ke kertas dan disimpan
  bersama passphrase backup). Menu Saya → Verifikasi dua langkah.
- Setiap authenticator yang ditambah atau dihapus dicatat dan dilaporkan ke
  kotak masuk admin utama (pemeriksaan setiap 10 menit, `jadwal.sql`), juga
  kalau perubahannya tidak lewat aplikasi.

**Kalau HP atau aplikasi authenticator hilang**, dari yang paling ringan:

1. **Masih ada authenticator cadangan**: masuk dengan kode cadangan, lalu
   Saya → Verifikasi dua langkah → hapus authenticator yang hilang dan
   daftarkan yang baru. Cabut HP yang hilang di Saya → Perangkat saya.
2. **Tidak ada cadangan, tetapi masih ada perangkat admin lain yang sudah
   terverifikasi** (misalnya laptop): lakukan hal yang sama dari perangkat itu.
   HP yang dicabut tidak bisa membaca data atau menjalankan fungsi admin lagi.
   Kalau sesudahnya muncul pemberitahuan "Authenticator baru" yang tidak Anda
   kenal, langsung ke langkah 3.
3. **Prosedur darurat** (pemilik akun Supabase, dari SQL Editor; akun Supabase
   dilindungi verifikasi dua langkahnya sendiri): jalankan
   `supabase/darurat/pulihkan_dua_langkah_admin.sql` setelah mengganti
   `KETIK-DI-SINI` dengan `PULIHKAN`. Semua authenticator admin utama dihapus,
   semua perangkat dan sesi login admin utama diakhiri (HP yang hilang
   langsung tidak bisa membuka apa pun), dan keluar satu link masuk baru
   (sekali pakai, 7 hari). Buka link itu di HP baru, lalu daftarkan
   authenticator baru. Data keluarga tidak disentuh.

Karena itu **verifikasi dua langkah akun Supabase dan GitHub (pengingat ⏰ B)
adalah kunci terakhir**: siapa pun yang menguasai akun Supabase bisa
menjalankan prosedur darurat.

## Perkiraan lokasi login

Edge Function memperkirakan kota/negara dari alamat IP **di memori**, memakai
file `lokasi-ip.bin.gz` di Storage privat (bucket `lokasi-ip`). Alamat IP tidak
dikirim ke layanan lain, dan tidak ada GPS atau koordinat.

- Data: DB-IP "IP to City Lite" (db-ip.com, lisensi CC BY 4.0; atribusi di
  halaman Privasi). Kota untuk **Indonesia dan Italia**, negara saja untuk
  negara lain: ±6,9 MB (±2,6 MB terkompresi). Kota untuk semua negara ±76 MB,
  melebihi batas file Storage paket gratis (50 MB) dan terlalu berat untuk
  Edge Function.
- Membuat file (dipakai workflow bulanan, langkah 1.28):
  `npm run lokasi-ip:buat -- dbip-city-lite-2026-10.csv.gz lokasi-ip.bin.gz --tanggal 2026-10`
- Selama file belum diunggah, login tetap jalan dengan "lokasi tidak diketahui".

