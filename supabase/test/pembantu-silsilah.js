// Pembantu tes untuk menyusun keluarga FIKTIF di database tes (sebagai
// pemilik database, jadi RLS tidak berlaku; trigger tetap berlaku).
import { baris } from './tiruan-supabase.js'

const sisip = async (db, tabel, data) => {
  const kolom = Object.keys(data)
  const [r] = await baris(
    db,
    `insert into public.${tabel} (${kolom.join(', ')})
     values (${kolom.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    Object.values(data)
  )
  return r
}

export const pembantuSilsilah = (db) => ({
  orang: async (nama, extra = {}) => (await sisip(db, 'people', { full_name: nama, ...extra })).id,
  nikah: async (p1, p2, extra = {}) =>
    (await sisip(db, 'unions', { partner1_id: p1, partner2_id: p2, ...extra })).id,
  anak: async (unionId, childId, kind = 'kandung', bio) =>
    (await sisip(db, 'children', {
      union_id: unionId,
      child_id: childId,
      kind,
      biological_parent: bio === undefined ? { kandung: 'keduanya', sambung: 'partner2', angkat: null }[kind] : bio,
    })).id,
  pohonAsal: async (anchorId, extra = {}) =>
    (await sisip(db, 'origin_trees', { anchor_person_id: anchorId, ...extra })).id,
  aturPangkal: (unionId) => db.query(`update public.settings set root_union_id = $1`, [unionId]),
  // Urutan lahir anak-anak seorang orang tua: [{ child_id, rank }] urut.
  urutan: async (parentId) =>
    baris(db, `select child_id, rank from public.birth_ranks where parent_id = $1 order by rank`, [parentId]),
  satu: async (sql, params) => (await baris(db, sql, params))[0],
})
