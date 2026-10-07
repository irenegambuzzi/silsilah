// Nomor silsilah otomatis untuk tampilan Daftar, misalnya "1.6.2":
// pasangan pangkal = 1, anak ke-6 mereka = 1.6, anak ke-2 dari anak itu = 1.6.2.
// Nomor mengikuti urutan lahir ("Anak ke-n"), jadi selalu sama dengan kartu.
// Anak dari pasangan sepupu dinomori lewat jalur yang paling dekat ke pangkal.
// Anak yang belum punya urutan lahir mendapat nomor sesudah yang terbesar,
// diurutkan menurut tanggal lahir. Pasangan yang bukan keturunan tidak bernomor.
import { bandingkanKabur, tanggalDari } from './tanggal.js'

export function hitungNomor(graf, { gen, jalur }) {
  // Urutan cadangan untuk anak tanpa urutan lahir.
  const cadangan = new Map()
  const tanpaUrutan = new Map() // orang tua → anak tanpa urutan lahir
  const terbesar = new Map() // orang tua → urutan terbesar yang ada
  for (const [id, daftar] of jalur) {
    const utama = daftar[0]
    if (!utama) continue
    const p = utama.orangTuaId
    if (utama.anakKe == null) {
      if (!tanpaUrutan.has(p)) tanpaUrutan.set(p, [])
      tanpaUrutan.get(p).push(id)
    } else {
      terbesar.set(p, Math.max(terbesar.get(p) ?? 0, utama.anakKe))
    }
  }
  for (const [p, anak] of tanpaUrutan) {
    anak.sort(
      (a, b) =>
        bandingkanKabur(tanggalDari(graf.orang.get(a), 'birth'), tanggalDari(graf.orang.get(b), 'birth')) ||
        (a < b ? -1 : 1)
    )
    anak.forEach((id, i) => cadangan.set(id, (terbesar.get(p) ?? 0) + i + 1))
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
      if (induk) hasil = `${induk}.${utama.anakKe ?? cadangan.get(id)}`
    }
    if (hasil) nomor.set(id, hasil)
    return hasil
  }
  for (const id of gen.keys()) hitung(id)
  return nomor
}
