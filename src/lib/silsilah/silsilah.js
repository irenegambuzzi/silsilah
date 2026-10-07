// Pintu masuk: menyusun semua turunan silsilah utama (graf, GEN, jalur,
// nomor silsilah) sekali, lalu dipakai oleh labelKartu dan labelDetail.
// Pohon keluarga asal memakai kerabat.js.
import { bangunGraf } from './graf.js'
import { DAFTAR_GENERASI, hitungGenerasi } from './generasi.js'
import { hitungNomor } from './nomor.js'

// `daftarGenerasi` boleh diganti dengan settings.istilah generasi.
export function susunSilsilah(data, { daftarGenerasi = DAFTAR_GENERASI } = {}) {
  const graf = bangunGraf(data)
  const hasil = hitungGenerasi(graf)
  return { graf, ...hasil, nomor: hitungNomor(graf, hasil), daftarGenerasi }
}
