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
