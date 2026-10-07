// Pilihan tampilan: ukuran huruf dan kontras (PLAN.md 15.4). Disimpan di
// perangkat dan diterapkan sebelum aplikasi tampil, supaya tidak berkedip.
import { KUNCI, bacaTersimpan, tulisTersimpan } from './penyimpanan.js'

export const UKURAN_HURUF = ['normal', 'besar', 'sangatBesar']
export const TAMPILAN_BAWAAN = { ukuran: 'normal', kontras: false }

export function bacaTampilan() {
  let isi = {}
  try {
    isi = JSON.parse(bacaTersimpan(KUNCI.tampilan) ?? '{}') ?? {}
  } catch {
    isi = {}
  }
  return {
    ukuran: UKURAN_HURUF.includes(isi.ukuran) ? isi.ukuran : TAMPILAN_BAWAAN.ukuran,
    kontras: isi.kontras === true,
  }
}

// Menulis atribut di <html>; CSS (index.css) yang mengatur ukurannya.
export function terapkanTampilan(tampilan, akar = globalThis.document?.documentElement) {
  if (!akar) return
  akar.dataset.ukuran = tampilan.ukuran
  if (tampilan.kontras) akar.dataset.kontras = 'tinggi'
  else delete akar.dataset.kontras
}

export function simpanTampilan(tampilan) {
  tulisTersimpan(KUNCI.tampilan, JSON.stringify(tampilan))
  terapkanTampilan(tampilan)
}

export const muatTampilanTersimpan = () => terapkanTampilan(bacaTampilan())
