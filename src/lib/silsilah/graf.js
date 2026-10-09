// Graf silsilah: indeks dari baris-baris database (people, unions,
// children, birth_ranks) supaya pencarian orang tua, anak, dan pernikahan
// cepat. Masukan berupa baris persis seperti dari database:
//
//   { people, unions, children, birth_ranks, root_union_id }
//
// `pohon` null = silsilah utama; terisi = satu pohon keluarga asal (id di
// origin_trees). Baris yang disisihkan diabaikan. Id hanya
// dianggap penanda, jadi bentuknya bebas (uuid atau teks).
import { urutkanPernikahan } from './urutan.js'

const aktif = (baris) => !baris.deleted_at
const kunciUrutan = (orangTua, anak) => `${orangTua}|${anak}`

export function bangunGraf(data, { pohon = null } = {}) {
  const orang = new Map(data.people.filter(aktif).map((p) => [p.id, p]))

  const unions = new Map()
  for (const u of data.unions) {
    if (!aktif(u) || (u.tree_id ?? null) !== pohon || !orang.has(u.partner1_id)) continue
    // Pasangan yang orangnya sudah disisihkan dianggap tidak diketahui.
    unions.set(u.id, orang.has(u.partner2_id) ? u : { ...u, partner2_id: null })
  }

  const tautan = new Map() // anak → baris children (hubungan ke orang tua)
  const anakUnion = new Map() // pernikahan → baris children
  for (const c of data.children) {
    if (!aktif(c) || (c.tree_id ?? null) !== pohon) continue
    if (!unions.has(c.union_id) || !orang.has(c.child_id)) continue
    if (!tautan.has(c.child_id)) tautan.set(c.child_id, [])
    tautan.get(c.child_id).push(c)
    if (!anakUnion.has(c.union_id)) anakUnion.set(c.union_id, [])
    anakUnion.get(c.union_id).push(c)
  }

  const mentah = new Map()
  for (const u of unions.values()) {
    for (const id of [u.partner1_id, u.partner2_id]) {
      if (!id) continue
      if (!mentah.has(id)) mentah.set(id, [])
      mentah.get(id).push(u)
    }
  }
  const pernikahan = new Map([...mentah].map(([id, daftar]) => [id, urutkanPernikahan(daftar, id)]))

  const ranks = new Map()
  for (const r of data.birth_ranks ?? []) {
    if ((r.tree_id ?? null) === pohon) ranks.set(kunciUrutan(r.parent_id, r.child_id), r.rank)
  }

  const rootUnionId =
    pohon === null && unions.has(data.root_union_id) ? data.root_union_id : null

  return { pohon, orang, unions, tautan, anakUnion, pernikahan, ranks, rootUnionId }
}

// Urutan lahir `anak` di antara semua anak `orangTua` (null kalau tidak ada).
export const urutanLahir = (graf, orangTua, anak) =>
  graf.ranks.get(kunciUrutan(orangTua, anak)) ?? null

export const orangTuaUnion = (union) => [union.partner1_id, union.partner2_id].filter(Boolean)

export const pasanganDi = (union, orangId) =>
  (union.partner1_id === orangId ? union.partner2_id : union.partner1_id) ?? null
