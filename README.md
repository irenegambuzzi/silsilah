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

## Aturan repo

- **Tidak ada nama atau data keluarga di repo.** Data pribadi hanya di
  folder `data-pribadi/` (di-gitignore) dan di database.
- Versi library dipatok persis (`.npmrc` berisi `save-exact=true`).

## Edge Functions

`supabase/functions/pakai-undangan` (link undangan) dan
`supabase/functions/pakai-kode` (kode tambah perangkat / akses sementara).
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
```

`--no-verify-jwt` disengaja (juga tertulis di `supabase/config.toml`): yang
memanggil kedua fungsi ini belum login. Keamanannya dari token/kode itu
sendiri (sekali pakai, ber-hash, kedaluwarsa) dan batas percobaan di SQL 009.
Login memakai tautan masuk (magic link) tanpa email terkirim, jadi provider
**Email** di Authentication harus aktif, sedangkan "Allow new users to sign
up" tetap mati.
