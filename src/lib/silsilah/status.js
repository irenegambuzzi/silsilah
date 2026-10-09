// Status pernikahan seseorang: PILIHAN TETAP, bukan teks bebas
// (PLAN.md bagian 15.1). Empat pilihan:
//   'belum_menikah'   hanya kalau orangnya SENDIRI memilihnya
//                     (people.marital_choice) dan tidak ada data pernikahan;
//                     aplikasi tidak pernah menyimpulkannya sendiri
//   'menikah'         ada pernikahan yang masih berjalan
//   'berpisah'        pernikahan terakhir berakhir karena berpisah
//   'ditinggal_wafat' pasangan dalam pernikahan terakhir sudah wafat
// null = belum diketahui (tampil "-"): tanpa data pernikahan dan belum
// memilih, atau status pernikahan terakhir tidak diketahui.
import { pasanganDi } from './graf.js'
import { pastiSesudah } from './anak.js'
import { tanggalDari } from './tanggal.js'

export function statusPernikahan(s, id) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const unions = s.graf.pernikahan.get(id) ?? []
  if (unions.length === 0) return orang.marital_choice === 'belum_menikah' ? 'belum_menikah' : null

  const pasangan = (u) => {
    const p = pasanganDi(u, id)
    return p ? s.graf.orang.get(p) : null
  }
  // Pernikahan yang masih berjalan. Pernikahan baru tidak membuat yang lama
  // berakhir; hanya status berpisah atau wafatnya pasangan.
  if (unions.some((u) => u.status === 'menikah' && !pasangan(u)?.is_deceased)) return 'menikah'

  const terakhir = unions.at(-1)
  if (terakhir.status === 'cerai') return 'berpisah'
  const p = pasangan(terakhir)
  if (p?.is_deceased) {
    // Keduanya sudah wafat: "ditinggal" hanya kalau pasangannya PASTI wafat lebih dulu.
    if (!orang.is_deceased || pastiSesudah(tanggalDari(orang, 'death'), tanggalDari(p, 'death'))) return 'ditinggal_wafat'
    return terakhir.status === 'menikah' ? 'menikah' : null
  }
  return null
}
