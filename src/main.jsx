import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { modeContohAktif } from './lib/modeContoh'
import { muatTampilanTersimpan } from './lib/tampilan'
import './index.css'

// Ukuran huruf dan kontras pilihan pengguna, sebelum layar pertama tampil.
muatTampilanTersimpan()

async function mulai() {
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
