import { pasanganDi } from '../silsilah/graf.js'
import { hitungGenerasiCabang } from '../silsilah/generasi.js'
import { kartuDiBagan, susunBagan } from './susun.js'

// Fokus pada satu cabang dengan generasi dihitung dari orang yang difokuskan
// ("Hitung dari [nama]", PLAN.md bagian 15.1): orang itu diperlakukan
// seperti leluhur (putaran ketujuh): GEN.0 dengan label "Awal cabang", lalu
// GEN dan istilah Jawa keturunannya dihitung dengan aturan yang sama seperti
// dari leluhur utama, termasuk aturan anak sambung dan anak angkat
// (generasi.js, hitungGenerasiCabang). Nomor silsilah TIDAK berubah (tetap
// dari pangkal utama).
//
// PASANGAN orang itu (yang bukan keturunan) juga berlabel "Awal cabang"
// dengan GEN.0, seperti kedua pasangan pangkal utama (putaran ketiga
// tinjauan); warnanya tetap warna pasangan.
//
// Hasilnya turunan silsilah baru untuk susunBagan/labelKartu/labelDetail.
export function silsilahCabang(s, id) {
  if (!id) return s
  const pasangan = new Set()
  for (const u of s.graf.pernikahan.get(id) ?? []) {
    const p = pasanganDi(u, id)
    if (p) pasangan.add(p)
  }
  const pasanganCabang = new Set([...pasangan].filter((p) => !s.gen.has(p)))
  return { ...s, ...hitungGenerasiCabang(s, id, pasangan), pangkalCabang: id, pasanganCabang }
}

// Tampilan satu cabang (mode fokus, putaran ketujuh), SAMA untuk Bagan,
// Daftar, dan halaman orang: bagan yang dimulai dari orang itu dengan semua
// keturunannya, dan label yang dihitung dari orang itu kalau `hitung`.
//   sTampil  turunan silsilah untuk label kartu, panel, dan Daftar
//   bagan    susunBagan dengan fokus (akar: orang itu)
//   kartu    kartu UTAMA di cabang (keturunan dan pasangan yang bukan keturunan)
//   rujukan  kartu "Dari cabang lain" yang tampil di cabang
//   anggota  Set id dari `kartu`: orang di cabang ini (pencarian, Daftar,
//            nama yang bisa diketuk di panel)
//   nama     nama orang itu (pita fokus)
export function tampilanCabang(s, id, hitung = false) {
  const sTampil = hitung ? silsilahCabang(s, id) : s
  const bagan = susunBagan(sTampil, { fokus: id })
  const { utama, rujukan } = kartuDiBagan(bagan.akar)
  return { sTampil, bagan, kartu: utama, rujukan, anggota: new Set(utama.map((k) => k.id)), nama: bagan.akar.kartu.nama }
}
