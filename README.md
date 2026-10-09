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
| menu Daftar (atau `/#/daftar`) | daftar keluarga fiktif (urut cabang demi cabang; nomor silsilah tidak ditampilkan), dengan kotak pencarian; ketuk satu nama untuk membuka keterangannya |
| menu Bagan (atau `/#/bagan`) | bagan kartu keluarga fiktif. Di laptop mula-mula tampil utuh, tidak tertutup legenda; di HP mulai dari ukuran terbaca dengan pasangan pangkal di tengah (tombol "Lihat seluruh bagan" untuk melihat semuanya). Geser dengan satu jari (di laptop: seret dengan mouse atau tombol panah), perbesar/perkecil dengan dua jari (di laptop: Ctrl + roda mouse) atau tombol + / − ; "Pusatkan" kembali ke tampilan awal. Ketuk satu kartu → panel keterangan di kanan (di HP: dari bawah) dengan "Fokus pada cabang ini" (pilih "Hitung dari pangkal utama" atau "Hitung dari [nama]"). Di Saya, coba ukuran huruf Sangat besar dan Kontras tinggi: bagan ikut berubah |
| offline | setelah data termuat, matikan internet (atau DevTools → Network → Offline) lalu muat ulang halaman: aplikasi terbuka dari salinan di perangkat, dengan spanduk "Anda sedang offline". Nyalakan lagi internet: spanduk hilang. Dengan kode `AKSES234` tidak ada salinan (perangkat pinjaman) |

### Kasus khusus di data contoh

Data contoh harus selalu memuat semua kasus yang sudah didukung (tes
`src/contoh/kelengkapan.test.js`). Cari namanya di Bagan atau Daftar (kotak
cari di bilah atas Bagan), lalu ketuk kartunya untuk membuka panel:

| Kasus | Di mana |
|---|---|
| Pasangan pangkal, keduanya wafat | Alm. Raksa & Almh. Selara (kartu emas, strip dan simbol hitam arang, label "PANGKAL"). Panel Selara: "Ditinggal wafat pasangan" |
| Label kartu pasangan | Semua kartu pasangan yang bukan keturunan berlabel kecil "PASANGAN" tanpa GEN, misalnya Eka, Gita, Umar, Harvel, Alm. H. Halvin (kartu arang, label putih), Hj. Dara (pasangan khusus) |
| Pernikahan berulang, anak 1–11 lintas pernikahan | Bima: dari kiri ke kanan Eka (istri ke-1) → Fitri (istri ke-2) → Eka lagi ("menikah kembali") → Gita (istri ke-3). Nomor urut 1–11 di pojok kiri atas kartu anak-anaknya, urut dari kiri ke kanan. Panel Bima: daftar anak "1. Tamran · dari istri ke-1" … "11. Rangga · dari istri ke-3" |
| Berpisah (hati patah + garis putus-putus) | Tiga pernikahan pertama Bima; panel Eka/Fitri: "Pasangan dari Bima · berpisah", status "Berpisah" |
| Berpisah tanpa jalur resmi, lalu menikah lagi | Kirana (anak Bima): Suami ke-1 Danuarta (berpisah, catatan "Berpisah tanpa jalur resmi"), Suami ke-2 Harvel |
| Pernikahan baru, pernikahan sebelumnya belum ditandai berakhir | Qori: Istri ke-1 Nadira dan Istri ke-2 Ravela, keduanya "Menikah" (hati utuh, garis biasa) |
| Ditinggal wafat lalu menikah lagi | Ika: Suami ke-1 Alm. H. Halvin, Suami ke-2 Joval, S.E. Juga Hj. Dara (istri Alm. Tirwan): status "Ditinggal wafat pasangan" |
| Keturunan wafat / pasangan wafat | Alm. Tirwan (kartu hitam arang) / Alm. H. Halvin (kartu arang lebih muda); panel keduanya punya baris "Wafat" |
| Anak wafat saat bayi | Almh. Sekar, anak Ika (dengan catatan; tanpa baris status pernikahan) |
| Anak sambung LEBIH TUA dari anak kandung | Vino (anak sambung Cahya, 1972) di kiri Wati (1977) di bawah hati Cahya & Umar, tanpa nomor urut. Panel Vino: "Orang tua: Umar & Cahya (ibu sambung)" (keduanya bisa diketuk) dan "Anak sambung Cahya". Panel Cahya: "Vino · anak sambung", "1. Wati" |
| Anak sambung LEBIH MUDA dari anak kandung | Galen (2003) dan Elvina (2006), anak Harvel: panel Kirana menulis "1. Celvia" (2001), "Galen · anak sambung", "Elvina · anak sambung", "2. Fajrin" (2010). Panel Elvina: "Orang tua: Harvel & Kirana (ibu sambung)" |
| Pasangan dengan anak dari pernikahan sebelumnya | Harvel (pasangan Kirana): bagian Anak berisi SEMUA anaknya, bernomor dari sudut pandang Harvel: "1. Galen · dari pernikahan sebelumnya", "2. Elvina · dari pernikahan sebelumnya", "3. Fajrin". Juga Umar: "1. Vino · dari pernikahan sebelumnya", "2. Wati". Panel pasangan lain (Eka, Gita, Hj. Dara, Alm. H. Halvin, Joval, Danuarta, Sinta, Laila, Fitri) juga menampilkan anak-anaknya |
| Anak angkat | Yoga (anak angkat Lorvan & Sinta, di antara Kelvan dan Arum menurut umur): tanpa nomor urut; panel Yoga: "Orang tua angkat: Lorvan & Sinta" (keduanya bisa diketuk) dan "Anak angkat Lorvan & Sinta"; panel Lorvan: "1. Kelvan", "Yoga · anak angkat", "2. Arum" |
| "Putra/Putri ke-n dari n bersaudara" | panel Mega: "Putri ke-6 dari 11 bersaudara"; panel Wati: "Putri tunggal" (Vino anak sambung, tidak dihitung) |
| Antarsepupu, generasi sama | Tamran & Wati, anaknya Nirvo di bawah Tamran (pihak laki-laki); panel Nirvo: "Putra tunggal" sekali saja (sama bagi ayah dan ibunya) |
| Antarsepupu, generasi berbeda | Rangga & Gendis, anaknya Hasna di bawah Rangga; panel Hasna: "Putri tunggal" sekali dan "Lewat Gendis: Canggah · Generasi ke-4"; di samping Gendis catatan "Anak mereka ada di cabang Rangga" |
| Antarsepupu, jalur IBU lebih dekat ke pangkal | Arum (putri Lorvan, GEN.2) & Dorvi, S.Kom. (cucu Bima, GEN.3): anaknya Bintang tetap di bawah Dorvi (pihak laki-laki) dengan GEN.4 · CANGGAH (bukan GEN.3 lewat Arum). Panel Bintang: "Canggah · Generasi ke-4", "Putra tunggal", "Lewat Arum: Buyut · Generasi ke-3". Di samping Arum (cabang Lorvan): kartu rujukan Dorvi dan catatan "Anak mereka ada di cabang Dorvi, S.Kom." |
| Pasangan tidak diketahui | Lintang, anaknya Arya (status pernikahan "-") |
| Jenis kelamin tidak diketahui | Ragil, anak Alm. Tirwan (kartu abu, "Putra/Putri ke-3"); baris legenda "Jenis kelamin tidak diketahui" hanya muncul selama ada orang seperti ini |
| Dewasa tanpa data pernikahan / memilih "Belum menikah" | Oka ("Status pernikahan: -", tanpa baris Pasangan) / Putri ("Status pernikahan: Belum menikah") |
| Kolom kosong ("-") | Oka: Panggilan, Pekerjaan, Catatan "-"; pasangan seperti Gita: Orang tua "-" |
| Anak di bawah umur (tunas daun di pojok kanan bawah kartu) | Bayu, Nala, Ragil, Bintang, Hasna (tanggal lahir lengkap), Fajrin (4 Juli 2010, tanggal lengkap) |
| Fokus cabang dihitung dari orangnya | ketuk Bima → "Fokus pada cabang ini" → "Hitung dari Bima": Bima dan ketiga istrinya (Eka, Fitri, Gita) "PANGKAL CABANG" GEN.0, anaknya GEN.1 · Anak, dengan pita "Generasi dihitung dari Bima · Kembali ke pangkal utama" dan tombol "Keluar dari fokus" (juga di bilah atas, dan tetap ada saat bilah disembunyikan). Tombol Kembali di browser juga keluar dari fokus. Alamat langsung: `/#/bagan?fokus=bima&hitung=cabang` |
| Gelar religius / pendidikan | H. Halvin, Hj. Dara / Dorvi, S.Kom., Laras, S.Ked., Joval, S.E. |
| Nama panggilan | Dorvi, Joval, Hj. Dara, H. Halvin |
| Tanggal kabur | H. Halvin "sekitar 1968"; Hj. Dara "Juni 1978"; tahun saja di banyak orang; tanggal lengkap: Dorvi, Fajrin, Hasna |
| Pekerjaan / catatan | Dorvi, Laras, Joval, H. Halvin, Alm. Tirwan, Harvel / Almh. Sekar, Alm. Tirwan |
| Pohon keluarga asal | Eka (pasangan khusus A) dan Hj. Dara (pasangan khusus B). Hanya dimuat untuk admin utama (kode `UTAMA234`); layarnya belum dibuat |
| Alamat dan nomor HP fiktif | `src/contoh/kontakContoh.js` (26 orang); layar data kontak belum dibuat |
| Nomor silsilah | tidak tampil di mana pun (panel, Daftar, kartu); Daftar tetap diurutkan cabang demi cabang |

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

