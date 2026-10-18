// Konfigurasi KHUSUS `npm run uji:nama-asli` (SEMENTARA, HANYA LOKAL;
// putaran 7c, bagian B): server pengembangan yang hanya mendengar di
// 127.0.0.1 (port 5177, tidak bentrok dengan 5176), dengan middleware yang
// membaca nama dari folder data pribadi saat halaman uji dibuka.
// Build produksi tidak pernah memakai file ini (vite.config.js).
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vite'
import dasar from './vite.config.js'
import { ujiNamaAsli } from './scripts/uji-nama-asli/plugin.mjs'

const FOLDER = path.join(import.meta.dirname, 'data-pribadi')

export default mergeConfig(
  dasar,
  defineConfig({
    plugins: [ujiNamaAsli({ folder: FOLDER })],
    server: {
      host: '127.0.0.1',
      port: 5177,
      strictPort: true,
      // File di folder data pribadi tidak pernah dilayani langsung.
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/data-pribadi/**'] },
    },
    // Cache dependensi terpisah, supaya tidak mengganggu server
    // pengembangan lain yang sedang jalan (isinya hanya library, tanpa nama).
    cacheDir: 'node_modules/.vite-uji-nama-asli',
  })
)
