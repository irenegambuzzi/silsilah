import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { modeContohAktif } from './lib/modeContoh'
import { muatTampilanTersimpan } from './lib/tampilan'
import { hashTanpaFokus } from './lib/fokus/alamatAwal'
import './index.css'

// Ukuran huruf dan kontras pilihan pengguna, sebelum layar pertama tampil.
muatTampilanTersimpan()

// Dibuka baru: selalu mulai tanpa fokus cabang, walaupun alamatnya berisi fokus.
const hashBersih = hashTanpaFokus(window.location.hash)
if (hashBersih !== null) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hashBersih}`)

async function mulai() {
  // HALAMAN UJI NAMA ASLI (npm run uji:nama-asli, sementara, hanya lokal):
  // seluruh layar diganti halaman uji, tanpa aplikasi, login, atau spanduk
  // mode contoh. Di build produksi cabang ini dibuang.
  if (import.meta.env.DEV && import.meta.env.VITE_UJI_NAMA_ASLI === '1') {
    const { default: UjiNamaAsli } = await import('./uji/UjiNamaAsli.jsx')
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <UjiNamaAsli />
      </StrictMode>
    )
    return
  }
  let klien
  // MODE CONTOH: hanya di build pengembangan (npm run dev:contoh). Di build
  // produksi cabang ini dibuang, jadi server tiruan tidak pernah ikut terkirim.
  // (import.meta.env.DEV ditulis langsung di sini supaya bundler bisa membuang cabang ini.)
  if (import.meta.env.DEV && modeContohAktif) {
    const { buatKlienContoh } = await import('./contoh/klienContoh.js')
    klien = buatKlienContoh()
  }
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App {...(klien ? { klien } : {})} />
    </StrictMode>
  )
}
mulai()
