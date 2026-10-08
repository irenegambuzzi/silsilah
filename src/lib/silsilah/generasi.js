// Generasi (GEN), jalur ke pangkal, dan istilah generasi Jawa.
//
// GEN.0 = pasangan pangkal. Anak seorang keturunan = GEN orang tuanya + 1.
// Pasangan yang bukan keturunan tidak punya GEN. Kalau KEDUA orang tua
// keturunan (pernikahan antarsepupu), GEN mengikuti jalur yang paling dekat
// ke pangkal; kedua jalur tetap dicatat di `jalur`.
import { teks } from '../../teks/id.js'
import { orangTuaUnion, pasanganDi, urutanLahir } from './graf.js'
import { jenisPasangan, pasanganBerurutan } from './urutan.js'

const KATA = teks.silsilah

// Bawaan dari settings (PLAN.md bagian 5.4). Mulai GEN.11 tanpa istilah.
export const DAFTAR_GENERASI = [
  'Pangkal', 'Anak', 'Putu', 'Buyut', 'Canggah', 'Wareng',
  'Udheg-udheg', 'Gantung siwur', 'Gropak senthe', 'Debog bosok', 'Galih asem',
]

export const labelGen = (gen) => `GEN.${gen}`
export const istilahGenerasi = (gen, daftar = DAFTAR_GENERASI) => daftar[gen] ?? null

// "Buyut · Generasi ke-3" (istilah Jawa dulu), atau "Generasi ke-12" kalau
// tidak ada istilahnya.
export function teksGenerasi(gen, daftar = DAFTAR_GENERASI) {
  const istilah = istilahGenerasi(gen, daftar)
  return [istilah, `${KATA.generasiKe}${gen}`].filter(Boolean).join(' · ')
}

// Mengembalikan:
//   gen    Map orang → GEN (hanya keturunan, termasuk pasangan pangkal)
//   jalur  Map orang → daftar jalur, yang paling dekat ke pangkal DI DEPAN:
//          { orangTuaId, unionId, kind, gen (GEN orang itu lewat jalur ini),
//            anakKe (urutan lahir di antara anak orang tua itu, atau null),
//            pasanganKe: { ke, jumlah, jenis } (pasangan orang tua yang mana) }
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
      for (const p of orangTuaUnion(graf.unions.get(t.union_id))) {
        const g = hitung(p)
        if (g != null && (terbaik === null || g + 1 < terbaik)) terbaik = g + 1
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
      for (const p of orangTuaUnion(u)) {
        if (!gen.has(p)) continue
        daftar.push({
          orangTuaId: p,
          unionId: u.id,
          kind: t.kind,
          gen: gen.get(p) + 1,
          anakKe: urutanLahir(graf, p, id),
          pasanganKe: infoPasangan(graf, p, u),
        })
      }
    }
    // Sort stabil: jalur yang sama dekatnya tetap menurut urutan data
    // (pihak partner1 lebih dulu).
    daftar.sort((a, b) => a.gen - b.gen)
    jalur.set(id, daftar)
  }
  return { gen, jalur }
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
