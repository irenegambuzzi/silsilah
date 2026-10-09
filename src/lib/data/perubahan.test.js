import { describe, expect, it } from 'vitest'
import { saringData } from './kolom.js'
import { terapkanPerubahan } from './perubahan.js'

const awal = () =>
  saringData({
    people: [
      { id: 'a', tree_id: null, full_name: 'A Contoh', version: 2 },
      { id: 'b', tree_id: null, full_name: 'B Contoh', version: 1 },
    ],
    children: [{ id: 'c1', union_id: 'u', child_id: 'b', version: 1 }],
    birth_ranks: [{ parent_id: 'a', child_id: 'b', rank: 1, version: 1 }],
    root_union_id: 'u',
  })
const ev = (table, eventType, baru, lama) => ({ table, eventType, new: baru ?? {}, old: lama ?? {} })

describe('terapkanPerubahan', () => {
  it('INSERT menambah baris (hanya kolom yang diizinkan)', () => {
    const d = terapkanPerubahan(awal(), ev('people', 'INSERT', { id: 'c', tree_id: null, full_name: 'C Contoh', version: 1, phone: '0812' }))
    expect(d.people.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(d.people[2]).not.toHaveProperty('phone')
  })

  it('UPDATE mengganti baris; versi yang lebih lama diabaikan', () => {
    const d = terapkanPerubahan(awal(), ev('people', 'UPDATE', { id: 'a', tree_id: null, full_name: 'A Baru', version: 3 }))
    expect(d.people[0].full_name).toBe('A Baru')
    const lama = terapkanPerubahan(d, ev('people', 'UPDATE', { id: 'a', tree_id: null, full_name: 'A Lama', version: 2 }))
    expect(lama.people[0].full_name).toBe('A Baru')
  })

  it('UPDATE yang menyisihkan (deleted_at terisi) membuang baris', () => {
    const d = terapkanPerubahan(awal(), ev('people', 'UPDATE', { id: 'b', full_name: 'B Contoh', version: 2, deleted_at: '2026-10-08T00:00:00Z' }))
    expect(d.people.map((p) => p.id)).toEqual(['a'])
  })

  it('penanda sync_removals membuang baris (untuk yang tidak melihat data yang disisihkan)', () => {
    const d = terapkanPerubahan(awal(), ev('sync_removals', 'INSERT', { table_name: 'children', row_id: 'c1', tree_id: null }))
    expect(d.children).toEqual([])
  })

  it('DELETE (hapus permanen) membuang baris; urutan lahir memakai orang tua + anak', () => {
    let d = terapkanPerubahan(awal(), ev('people', 'DELETE', null, { id: 'b' }))
    expect(d.people.map((p) => p.id)).toEqual(['a'])
    d = terapkanPerubahan(d, ev('birth_ranks', 'DELETE', null, { parent_id: 'a', child_id: 'b' }))
    expect(d.birth_ranks).toEqual([])
  })

  it('pengaturan: pangkal dan istilah generasi', () => {
    const d = terapkanPerubahan(awal(), ev('settings', 'UPDATE', { root_union_id: 'u2', generation_terms: ['P', 'A'], contact_quota_member: 5 }))
    expect(d.root_union_id).toBe('u2')
    expect(d.generation_terms).toEqual(['P', 'A'])
    expect(d).not.toHaveProperty('contact_quota_member')
  })

  it('tabel atau peristiwa tak dikenal, dan baris tanpa penanda, tidak mengubah apa pun', () => {
    const d = awal()
    expect(terapkanPerubahan(d, ev('contacts', 'INSERT', { person_id: 'a', phone: '0812' }))).toBe(d)
    expect(terapkanPerubahan(d, ev('people', 'TRUNCATE'))).toBe(d)
    expect(terapkanPerubahan(d, ev('people', 'INSERT', { full_name: 'Tanpa id' }))).toBe(d)
    expect(terapkanPerubahan(d, ev('sync_removals', 'INSERT', { table_name: 'members', row_id: 'x' }))).toBe(d)
  })

  it('data lama tidak diubah (fungsi murni)', () => {
    const d = awal()
    const salin = structuredClone(d)
    terapkanPerubahan(d, ev('people', 'UPDATE', { id: 'a', full_name: 'Lain', version: 9 }))
    expect(d).toEqual(salin)
  })
})
