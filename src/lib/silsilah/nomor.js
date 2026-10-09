// Nomor silsilah otomatis untuk tampilan Daftar, misalnya "1.6.2":
// pasangan pangkal = 1, anak ke-6 mereka = 1.6, anak ke-2 dari anak itu = 1.6.2.
// Untuk anak kandung, angka terakhir selalu sama dengan "Putra/Putri ke-n".
// Anak sambung dan anak angkat tidak punya "Putra/Putri ke-n", tetapi tetap
// bernomor (supaya keturunannya juga bernomor): sesudah semua anak kandung
// orang tua itu, menurut umur. Anak dari pasangan sepupu dinomori lewat
// jalur pertamanya (pihak laki-laki, sama dengan letaknya di bagan).
// Pasangan yang bukan keturunan tidak bernomor. Nomor ini TIDAK pernah
// ditampilkan (panel, Daftar, kartu); hanya untuk mengurutkan Daftar.
import { anakOrangTua } from './anak.js'

export function hitungNomor(graf, { gen, jalur }) {
  // Angka terakhir setiap anak di bawah orang tua jalur utamanya.
  const angka = (id, utama) => {
    const { ke, kandung, semua } = anakOrangTua(graf, utama.orangTuaId)
    if (ke.has(id)) return ke.get(id)
    const lain = semua.filter((a) => !a.kandung).map((a) => a.id)
    const i = lain.indexOf(id)
    return i < 0 ? null : kandung.length + i + 1
  }

  const nomor = new Map()
  const hitung = (id, ditempuh = new Set()) => {
    if (nomor.has(id)) return nomor.get(id)
    if (!gen.has(id) || ditempuh.has(id)) return null
    const utama = jalur.get(id)?.[0]
    let hasil = null
    if (gen.get(id) === 0 || !utama) {
      hasil = '1'
    } else {
      ditempuh.add(id)
      const induk = hitung(utama.orangTuaId, ditempuh)
      ditempuh.delete(id)
      const n = angka(id, utama)
      if (induk && n != null) hasil = `${induk}.${n}`
    }
    if (hasil) nomor.set(id, hasil)
    return hasil
  }
  for (const id of gen.keys()) hitung(id)
  return nomor
}
