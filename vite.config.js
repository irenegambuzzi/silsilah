import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Alamat dasar situs ditentukan di SATU tempat ini, dari VITE_BASE_PATH.
// Di GitHub Pages: '/silsilah/'. Di domain sendiri: '/'. Pindah domain
// cukup mengubah variabel itu (lihat PLAN.md bagian 18); semua yang lain
// (manifest, service worker, link) harus memakai import.meta.env.BASE_URL.
const BASE = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss()],
})
