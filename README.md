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
| kode `AKSES234` | masuk dengan akses sementara 30 menit |
| `/#/privasi` | halaman Privasi |

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

