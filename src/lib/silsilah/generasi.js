// Generasi (GEN), jalur ke pangkal, dan istilah generasi Jawa.
//
// GEN.0 = pasangan pangkal. Anak seorang keturunan = GEN orang tuanya + 1.
// Pasangan yang bukan keturunan tidak punya GEN.
//
// Kalau KEDUA orang tua keturunan (pernikahan antarsepupu, beda atau sama
// generasi), anak SELALU mengikuti pihak LAKI-LAKI: GEN, istilah Jawa, dan
// letaknya di bagan (susun.js memakai jalur pertama), supaya posisi di bagan
// dan GEN selalu cocok (putaran ketiga tinjauan, Oktober 2026). Jalur pihak
// ibu tetap dicatat di `jalur` (pihakIbu: true). Kalau jenis kelamin salah
// satu orang tua belum diketahui, berlaku aturan lama: jalur yang paling
// dekat ke pangkal (kalau sama dekat, pihak partner1).
import { teks } from '../../teks/id.js'
import { orangTuaUnion, pasanganDi } from './graf.js'
import { anakOrangTua, kandungUntuk } from './anak.js'
import { jenisPasangan, pasanganBerurutan } from './urutan.js'

const KATA = teks.silsilah

// Bawaan dari settings (PLAN.md bagian 5.4). Mulai GEN.11 tanpa istilah.
// GEN.0 SELALU "Leluhur" (teks.silsilah.leluhur, putaran keenam), juga kalau
// settings.generation_terms masih memuat "Pangkal" (bawaan SQL 001).
export const DAFTAR_GENERASI = [
  KATA.leluhur, 'Anak', 'Putu', 'Buyut', 'Canggah', 'Wareng',
  'Udheg-udheg', 'Gantung siwur', 'Gropak senthe', 'Debog bosok', 'Galih asem',
]

export const labelGen = (gen) => `GEN.${gen}`
export const istilahGenerasi = (gen, daftar = DAFTAR_GENERASI) => (gen === 0 ? KATA.leluhur : (daftar[gen] ?? null))

// "Buyut · Generasi ke-3" (istilah Jawa dulu), atau "Generasi ke-12" kalau
// tidak ada istilahnya.
export function teksGenerasi(gen, daftar = DAFTAR_GENERASI) {
  const istilah = istilahGenerasi(gen, daftar)
  return [istilah, `${KATA.generasiKe}${gen}`].filter(Boolean).join(' · ')
}

// Mengembalikan:
//   gen    Map orang → GEN (hanya keturunan, termasuk pasangan pangkal)
//   jalur  Map orang → daftar jalur, jalur yang menentukan GEN DI DEPAN
//          (pihak ayah untuk anak antarsepupu, selain itu yang paling dekat):
//          { orangTuaId, unionId, kind, gen (GEN orang itu lewat jalur ini),
//            pihakIbu (jalur ibu di pernikahan antarsepupu: tidak dipakai
//                      untuk GEN dan letak di bagan),
//            kandung (orang tua ini orang tua kandungnya),
//            anakKe (urutan lahir di antara anak KANDUNG orang tua itu;
//                    null untuk anak sambung/angkat),
//            pasanganKe: { ke, jumlah, jenis } (pasangan orang tua yang mana) }
//   tanpaGen Set keturunan yang GEN dan istilahnya tidak ditampilkan (lihat
//          hitungTanpaGen)
export function hitungGenerasi(graf) {
  const gen = new Map()
  const root = graf.rootUnionId ? graf.unions.get(graf.rootUnionId) : null
  if (root) for (const id of orangTuaUnion(root)) gen.set(id, 0)

  const tidakAda = new Set()
  const diproses = new Set()
  // Siklus tidak mungkin terjadi (database menolaknya); penjaga ini hanya
  // supaya data yang rusak tidak membuat hitungan berputar tanpa henti.
  const hitung = (id) => {
    if (gen.has(id)) return gen.get(id)
    if (tidakAda.has(id) || diproses.has(id)) return null
    diproses.add(id)
    let terbaik = null
    for (const t of graf.tautan.get(id) ?? []) {
      const u = graf.unions.get(t.union_id)
      const ortu = orangTuaUnion(u).map((p) => [p, hitung(p)]).filter(([, g]) => g != null)
      const ibu = ortu.length === 2 ? pihakIbu(graf, u) : null
      for (const [p, g] of ortu) {
        if (p !== ibu && (terbaik === null || g + 1 < terbaik)) terbaik = g + 1
      }
    }
    diproses.delete(id)
    if (terbaik === null) tidakAda.add(id)
    else gen.set(id, terbaik)
    return terbaik
  }
  for (const id of graf.orang.keys()) hitung(id)

  const jalur = new Map()
  for (const id of gen.keys()) {
    const daftar = []
    for (const t of graf.tautan.get(id) ?? []) {
      const u = graf.unions.get(t.union_id)
      const ibu = orangTuaUnion(u).every((p) => gen.has(p)) ? pihakIbu(graf, u) : null
      for (const p of orangTuaUnion(u)) {
        if (!gen.has(p)) continue
        const kandung = kandungUntuk(t, u, p)
        daftar.push({
          orangTuaId: p,
          unionId: u.id,
          kind: t.kind,
          gen: gen.get(p) + 1,
          pihakIbu: p === ibu,
          kandung,
          anakKe: kandung ? (anakOrangTua(graf, p).ke.get(id) ?? null) : null,
          pasanganKe: infoPasangan(graf, p, u),
        })
      }
    }
    // Pihak ibu antarsepupu di belakang; selain itu yang paling dekat dulu.
    // Sort stabil: jalur yang sama dekatnya tetap menurut urutan data
    // (pihak partner1 lebih dulu).
    daftar.sort((a, b) => Number(a.pihakIbu) - Number(b.pihakIbu) || a.gen - b.gen)
    jalur.set(id, daftar)
  }
  return { gen, jalur, tanpaGen: hitungTanpaGen(gen, jalur) }
}

// Keturunan TANPA GEN dan istilah Jawa (putaran keenam tinjauan, Oktober
// 2026): yang tidak punya satu pun jalur ke pangkal lewat orang tua KANDUNG
// atau orang tua ANGKAT. Contohnya anak bawaan pasangan (Vino, anak Umar;
// Cahya hanya ibu sambungnya), dan keturunan mereka. Anak sambung yang salah
// satu orang tua kandungnya keturunan (Celvia) dan anak angkat (Yoga)
// beserta keturunannya tetap ber-GEN. Orangnya tetap di `gen`/`jalur`, jadi
// letak di bagan, warna kartu, dan nomor silsilah (urutan Daftar) tidak
// berubah; hanya GEN dan istilahnya yang tidak ditampilkan.
function hitungTanpaGen(gen, jalur) {
  const bergaris = new Map()
  const cek = (id) => {
    if (gen.get(id) === 0) return true
    if (bergaris.has(id)) return bergaris.get(id)
    bergaris.set(id, false) // penjaga data rusak (siklus)
    const hasil = (jalur.get(id) ?? []).some((j) => (j.kandung || j.kind === 'angkat') && cek(j.orangTuaId))
    bergaris.set(id, hasil)
    return hasil
  }
  return new Set([...gen.keys()].filter((id) => !cek(id)))
}

// Pernikahan `u` antara dua keturunan: id pihak perempuan kalau jenis
// kelamin KEDUA orang tua diketahui (laki-laki dan perempuan); null kalau
// belum diketahui (aturan lama: jalur terdekat).
export function pihakIbu(graf, u) {
  const [a, b] = [u.partner1_id, u.partner2_id].map((id) => (id ? graf.orang.get(id) : null))
  if (!a || !b) return null
  if (a.sex === 'L' && b.sex === 'P') return b.id
  if (a.sex === 'P' && b.sex === 'L') return a.id
  return null
}

// Orang tua `p` di pernikahan `u`: pasangan keberapa (menurut pernikahan
// pertama dengan masing-masing pasangan), dari berapa pasangan seluruhnya.
function infoPasangan(graf, p, u) {
  const daftar = pasanganBerurutan(graf.pernikahan.get(p) ?? [], p)
  const indeks = daftar.findIndex((x) => x.unionIds.includes(u.id))
  if (indeks < 0) return null
  const pasangan = pasanganDi(u, p)
  return {
    ke: indeks + 1,
    jumlah: daftar.length,
    jenis: jenisPasangan(pasangan ? graf.orang.get(pasangan) : null),
  }
}
