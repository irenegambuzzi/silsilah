// Kolom yang dimuat aplikasi untuk setiap tabel silsilah. HANYA kolom ini
// yang pernah dipegang di memori dan disimpan di salinan offline; kolom
// lain apa pun yang dikirim server (termasuk kolom yang ditambahkan nanti)
// dibuang. Data kontak (alamat, nomor HP) tidak ada di tabel-tabel ini dan
// tidak boleh masuk daftar ini (kolom.test.js menjaganya).

const BERSAMA = ['version', 'created_at', 'updated_at', 'updated_by', 'deleted_at']

export const KOLOM = {
  people: [
    'id', 'tree_id', 'full_name', 'nickname', 'religious_title', 'academic_title', 'sex',
    'birth_y', 'birth_m', 'birth_d', 'birth_approx', 'birth_place',
    'is_deceased', 'death_y', 'death_m', 'death_d', 'death_approx', 'death_place',
    'occupation', 'notes', 'marital_choice', ...BERSAMA,
  ],
  unions: [
    'id', 'tree_id', 'partner1_id', 'partner2_id', 'status',
    'marriage_y', 'marriage_m', 'marriage_d', 'marriage_approx',
    'end_y', 'end_m', 'end_d', 'end_approx', 'sort_order', 'notes', ...BERSAMA,
  ],
  children: ['id', 'tree_id', 'union_id', 'child_id', 'kind', 'biological_parent', ...BERSAMA],
  birth_ranks: ['tree_id', 'parent_id', 'child_id', 'rank', 'version', 'updated_at'],
  origin_trees: ['id', 'anchor_person_id', 'is_active'],
}

// Dari baris settings (satu baris) hanya dua ini yang dipakai tampilan.
export const KOLOM_PENGATURAN = ['root_union_id', 'generation_terms']

// Tabel yang punya tempat sampah (kolom deleted_at).
export const PUNYA_TEMPAT_SAMPAH = new Set(['people', 'unions', 'children'])

export const TABEL_SILSILAH = Object.keys(KOLOM)

export const pilihKolom = (daftar, baris) =>
  Object.fromEntries(daftar.filter((k) => Object.hasOwn(baris ?? {}, k)).map((k) => [k, baris[k]]))

// Penanda satu baris: id, kecuali urutan lahir (orang tua + anak). null
// kalau penandanya tidak lengkap.
export const kunciBaris = (tabel, b) =>
  tabel === 'birth_ranks'
    ? (b?.parent_id && b?.child_id ? `${b.parent_id}|${b.child_id}` : null)
    : (b?.id ?? null)

// Data silsilah dari server (atau salinan), hanya dengan kolom yang diizinkan.
export function saringData(data) {
  const hasil = {}
  for (const t of TABEL_SILSILAH) hasil[t] = (data?.[t] ?? []).map((b) => pilihKolom(KOLOM[t], b))
  hasil.root_union_id = data?.root_union_id ?? null
  hasil.generation_terms = Array.isArray(data?.generation_terms) ? data.generation_terms.map(String) : null
  return hasil
}

// "Belum ada data": silsilah utama tidak berisi satu orang pun.
export const dataKosong = (data) => !data.people.some((p) => (p.tree_id ?? null) === null)
