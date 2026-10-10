import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { bangunGraf } from './graf.js'
import { DAFTAR_GENERASI, hitungGenerasi, istilahGenerasi, labelGen, teksGenerasi } from './generasi.js'

const hitung = (data) => hitungGenerasi(bangunGraf(data))

describe('istilah generasi', () => {
  it('GEN.0 sampai GEN.10 punya istilah Jawa, GEN.11 dan seterusnya tidak', () => {
    expect(DAFTAR_GENERASI.map((_, i) => `${labelGen(i)} ${istilahGenerasi(i)}`)).toEqual([
      'GEN.0 Leluhur',
      'GEN.1 Anak',
      'GEN.2 Putu',
      'GEN.3 Buyut',
      'GEN.4 Canggah',
      'GEN.5 Wareng',
      'GEN.6 Udheg-udheg',
      'GEN.7 Gantung siwur',
      'GEN.8 Gropak senthe',
      'GEN.9 Debog bosok',
      'GEN.10 Galih asem',
    ])
    expect(istilahGenerasi(11)).toBeNull()
    expect(labelGen(11)).toBe('GEN.11')
    expect(labelGen(12)).toBe('GEN.12')
  })

  it('teks keterangan: istilah Jawa dulu, "Buyut · Generasi ke-3"; mulai GEN.11 tanpa istilah', () => {
    expect(teksGenerasi(3)).toBe('Buyut · Generasi ke-3')
    expect(teksGenerasi(10)).toBe('Galih asem · Generasi ke-10')
    expect(teksGenerasi(11)).toBe('Generasi ke-11')
    expect(teksGenerasi(2, ['A', 'B', 'C'])).toBe('C · Generasi ke-2')
    expect(teksGenerasi(2)).not.toMatch(/\(/)
  })
})

describe('hitungGenerasi', () => {
  const data = bangunKeluargaFiktif()
  const { gen, jalur } = hitung(data)

  it('pasangan pangkal GEN.0, anak GEN.1, dan seterusnya', () => {
    expect(gen.get('raksa')).toBe(0)
    expect(gen.get('selara')).toBe(0)
    expect(gen.get('bima')).toBe(1)
    expect(gen.get('tamran')).toBe(2)
    expect(gen.get('gendis')).toBe(3)
  })

  it('pasangan yang bukan keturunan tidak punya GEN', () => {
    for (const id of ['eka', 'fitri', 'gita', 'umar', 'sinta', 'laila']) expect(gen.has(id)).toBe(false)
  })

  it('letak: anak sambung dan anak angkat di generasi yang sama dengan saudaranya', () => {
    // `gen` menentukan letak di bagan dan nomor silsilah; apakah GEN-nya
    // DITAMPILKAN diatur `tanpaGen` (di bawah).
    expect(gen.get('vino')).toBe(gen.get('wati'))
    expect(gen.get('yoga')).toBe(gen.get('kelvan'))
  })

  it('anak dari pasangan sepupu mengikuti pihak LAKI-LAKI (ayah lebih dekat ke pangkal)', () => {
    // Rangga GEN.2, Gendis GEN.3 → Hasna lewat Rangga GEN.3.
    expect(gen.get('hasna')).toBe(3)
    expect(jalur.get('hasna').map((j) => [j.orangTuaId, j.gen, j.pihakIbu])).toEqual([
      ['rangga', 3, false],
      ['gendis', 4, true],
    ])
  })

  it('anak dari pasangan sepupu mengikuti pihak LAKI-LAKI walaupun jalur ibu lebih dekat ke pangkal', () => {
    // Arum (ibu) GEN.2, Dorvi (ayah) GEN.3 → Bintang GEN.4 lewat Dorvi, bukan GEN.3 lewat Arum.
    // Pernikahannya dicatat dengan Arum sebagai partner1: urutan data tidak berpengaruh.
    expect(data.unions.find((u) => u.id === 'u18').partner1_id).toBe('arum')
    expect(gen.get('bintang')).toBe(4)
    expect(jalur.get('bintang').map((j) => [j.orangTuaId, j.gen, j.pihakIbu])).toEqual([
      ['dorvi', 4, false],
      ['arum', 3, true],
    ])
  })

  it('generasi sama: tetap pihak laki-laki, juga kalau pihak perempuan dicatat sebagai partner1', () => {
    expect(gen.get('nirvo')).toBe(3)
    expect(jalur.get('nirvo').map((j) => j.orangTuaId)).toEqual(['tamran', 'wati'])
    const d = bangunKeluargaFiktif()
    Object.assign(d.unions.find((u) => u.id === 'u9'), { partner1_id: 'wati', partner2_id: 'tamran' })
    expect(hitung(d).jalur.get('nirvo').map((j) => j.orangTuaId)).toEqual(['tamran', 'wati'])
  })

  it('jenis kelamin salah satu pihak belum diketahui: aturan lama, jalur yang paling dekat ke pangkal', () => {
    const d = bangunKeluargaFiktif()
    d.people.find((p) => p.id === 'dorvi').sex = null
    const h = hitung(d)
    expect(h.gen.get('bintang')).toBe(3)
    expect(h.jalur.get('bintang').map((j) => [j.orangTuaId, j.pihakIbu])).toEqual([['arum', false], ['dorvi', false]])
  })

  it('keturunan anak antarsepupu ikut dihitung dari pihak laki-laki', () => {
    const d = bangunKeluargaFiktif()
    d.people.push({ ...d.people.find((p) => p.id === 'bintang'), id: 'cucu', full_name: 'Cucu', birth_y: 2045 })
    d.unions.push({ id: 'ub', tree_id: null, partner1_id: 'bintang', partner2_id: null, status: 'menikah', deleted_at: null })
    d.children.push({ id: 'c-ub', tree_id: null, union_id: 'ub', child_id: 'cucu', kind: 'kandung', biological_parent: 'keduanya', deleted_at: null })
    expect(hitung(d).gen.get('cucu')).toBe(5)
  })

  it('urutan ke-n dan pasangan ke-n per jalur', () => {
    const j = jalur.get('hasna')
    expect(j.map((x) => x.anakKe)).toEqual([1, 1])
    // Dua orang tua, masing-masing hanya punya satu pasangan.
    expect(j.map((x) => x.pasanganKe.jumlah)).toEqual([1, 1])
  })

  it('urutan lahir dan istri ke-n untuk 11 anak Bima (contoh 1–3, 4–5, 6–7, 8–11)', () => {
    const anak = ['tamran', 'ika', 'tirwan', 'kirana', 'lintang', 'mega', 'nanda', 'oka', 'putri', 'qori', 'rangga']
    const dari = anak.map((a) => {
      const j = jalur.get(a)[0]
      return [j.anakKe, j.pasanganKe.ke, j.pasanganKe.jenis]
    })
    expect(dari).toEqual([
      [1, 1, 'istri'], [2, 1, 'istri'], [3, 1, 'istri'],
      [4, 2, 'istri'], [5, 2, 'istri'],
      [6, 1, 'istri'], [7, 1, 'istri'],
      [8, 3, 'istri'], [9, 3, 'istri'], [10, 3, 'istri'], [11, 3, 'istri'],
    ])
    expect(jalur.get('tamran')[0].pasanganKe.jumlah).toBe(3)
  })

  it('urutan lahir hanya untuk anak kandung: anak sambung dan anak angkat tidak bernomor', () => {
    expect(jalur.get('vino')[0]).toMatchObject({ kandung: false, anakKe: null })
    expect(jalur.get('wati')[0]).toMatchObject({ kandung: true, anakKe: 1 })
    expect(jalur.get('yoga')[0]).toMatchObject({ kandung: false, anakKe: null })
    expect(jalur.get('kelvan')[0]).toMatchObject({ kandung: true, anakKe: 1 })
  })

  it('pasangan pangkal tidak punya jalur', () => {
    expect(jalur.get('raksa')).toEqual([])
  })

  it('GEN.11 dan seterusnya dihitung walau tanpa istilah', () => {
    const d = { people: [], unions: [], children: [], birth_ranks: [], root_union_id: 'u0' }
    const p = (id) => d.people.push({ id, full_name: id, deleted_at: null })
    p('a0'); p('b0')
    d.unions.push({ id: 'u0', tree_id: null, partner1_id: 'a0', partner2_id: 'b0', deleted_at: null })
    let induk = 'u0'
    for (let i = 1; i <= 12; i++) {
      p(`a${i}`)
      d.children.push({ id: `c${i}`, tree_id: null, union_id: induk, child_id: `a${i}`, kind: 'kandung', deleted_at: null })
      d.unions.push({ id: `u${i}`, tree_id: null, partner1_id: `a${i}`, partner2_id: null, deleted_at: null })
      induk = `u${i}`
    }
    const { gen: g } = hitung(d)
    expect(g.get('a12')).toBe(12)
    expect(istilahGenerasi(g.get('a12'))).toBeNull()
  })

  it('baris yang disisihkan diabaikan', () => {
    const d = bangunKeluargaFiktif()
    d.children.find((c) => c.child_id === 'bima').deleted_at = '2026-02-01T00:00:00Z'
    const { gen: g } = hitung(d)
    expect(g.has('bima')).toBe(false)
    expect(g.has('tamran')).toBe(false) // keturunan ikut tidak terhubung
  })

  it('data yang berputar (siklus) tidak membuat hitungan macet', () => {
    const d = { people: [], unions: [], children: [], birth_ranks: [], root_union_id: null }
    for (const id of ['a', 'b']) d.people.push({ id, full_name: id, deleted_at: null })
    d.unions.push({ id: 'ua', tree_id: null, partner1_id: 'a', partner2_id: null, deleted_at: null })
    d.unions.push({ id: 'ub', tree_id: null, partner1_id: 'b', partner2_id: null, deleted_at: null })
    d.children.push({ id: 'c1', tree_id: null, union_id: 'ua', child_id: 'b', kind: 'kandung', deleted_at: null })
    d.children.push({ id: 'c2', tree_id: null, union_id: 'ub', child_id: 'a', kind: 'kandung', deleted_at: null })
    expect(hitung(d).gen.size).toBe(0)
  })
})

// Putaran keenam tinjauan: GEN hanya lewat orang tua kandung atau angkat.
describe('tanpaGen: keturunan tanpa garis darah atau angkat', () => {
  const { gen, tanpaGen } = hitung(bangunKeluargaFiktif())

  it('di data contoh: Galen, Elvina, Vino, dan anak-anak Vino; tidak ada yang lain', () => {
    expect([...tanpaGen].sort()).toEqual(['bagaskara', 'elvina', 'galen', 'sadevan-b', 'vino'])
    // Tetap di `gen` (letak di bagan dan urutan Daftar tidak berubah).
    for (const id of tanpaGen) expect(gen.has(id), id).toBe(true)
  })

  it('anak sambung dengan orang tua kandung keturunan (Celvia), anak angkat (Yoga) dan keturunannya tetap ber-GEN', () => {
    for (const id of ['celvia', 'fajrin', 'yoga', 'ratrisa-a', 'wati', 'kirana', 'cahya', 'raksa', 'selara']) {
      expect(tanpaGen.has(id), id).toBe(false)
    }
  })

  const kecil = () => {
    const d = { people: [], unions: [], children: [], birth_ranks: [], root_union_id: 'u0' }
    const p = (id, sex = 'L') => d.people.push({ id, full_name: id, sex, deleted_at: null })
    const u = (id, a, b) => d.unions.push({ id, tree_id: null, partner1_id: a, partner2_id: b, deleted_at: null })
    const c = (union, anak, kind = 'kandung', bio = { kandung: 'keduanya', angkat: null }[kind]) =>
      d.children.push({ id: `${union}-${anak}`, tree_id: null, union_id: union, child_id: anak, kind, biological_parent: bio, deleted_at: null })
    p('a'); p('b', 'P'); u('u0', 'a', 'b')
    p('k'); c('u0', 'k') // keturunan
    p('q', 'P'); u('u1', 'k', 'q')
    return { d, p, u, c }
  }

  it('anak sambung yang orang tua kandungnya keturunan (partner1) tetap ber-GEN; bawaan pasangan (partner2) tidak', () => {
    const { d, p, c } = kecil()
    p('darah'); c('u1', 'darah', 'sambung', 'partner1')
    p('bawaan'); c('u1', 'bawaan', 'sambung', 'partner2')
    const h = hitung(d)
    expect(h.tanpaGen.has('darah')).toBe(false)
    expect(h.tanpaGen.has('bawaan')).toBe(true)
  })

  it('keturunan anak bawaan juga tanpa GEN, termasuk anak angkatnya', () => {
    const { d, p, u, c } = kecil()
    p('bawaan'); c('u1', 'bawaan', 'sambung', 'partner2')
    p('r', 'P'); u('u2', 'bawaan', 'r')
    p('cucu'); c('u2', 'cucu')
    p('angkat'); c('u2', 'angkat', 'angkat')
    const h = hitung(d)
    for (const id of ['bawaan', 'cucu', 'angkat']) expect(h.tanpaGen.has(id), id).toBe(true)
    expect(h.gen.get('cucu')).toBe(3) // letaknya tetap
  })
})
