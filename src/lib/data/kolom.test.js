import { describe, expect, it } from 'vitest'
import { KOLOM, KOLOM_PENGATURAN, dataKosong, kunciBaris, pilihKolom, saringData } from './kolom.js'

// Nama kolom yang berbau data kontak atau lokasi. Tidak satu pun boleh
// dimuat lapisan data, apalagi masuk salinan offline.
const MIRIP_KONTAK = /phone|hp|telp|telepon|nomor|address|alamat|kontak|contact|email|lat|lng|lokasi|location|region|wilayah|ip\b|_enc$|hash/i

describe('kolom yang dimuat', () => {
  it('tidak ada kolom kontak, lokasi, atau rahasia di daftar mana pun', () => {
    const semua = [...Object.values(KOLOM).flat(), ...KOLOM_PENGATURAN]
    expect(semua.filter((k) => MIRIP_KONTAK.test(k))).toEqual([])
  })

  it('pola di atas memang menangkap nama kolom kontak (tes untuk tes)', () => {
    for (const k of ['phone_enc', 'address_enc', 'phone_hash', 'region_lat', 'region_lng', 'alamat', 'nomor_hp', 'email']) {
      expect(k).toMatch(MIRIP_KONTAK)
    }
  })

  it('kolom yang tidak terdaftar dibuang', () => {
    const b = pilihKolom(KOLOM.people, { id: 'a', full_name: 'Contoh', phone: '0812', alamat: 'Jalan', legacy_id: 'x' })
    expect(b).toEqual({ id: 'a', full_name: 'Contoh' })
  })

  it('saringData membersihkan semua tabel dan pengaturan', () => {
    const d = saringData({
      people: [{ id: 'a', full_name: 'A', address_enc: 'rahasia' }],
      unions: [{ id: 'u', partner1_id: 'a', phone_hash: 'x' }],
      origin_trees: [{ id: 't', anchor_person_id: 'a', grant_all_descendants: true }],
      root_union_id: 'u',
      generation_terms: ['Pangkal', 'Anak'],
      contacts: [{ person_id: 'a', phone: '0812' }],
    })
    expect(d).toEqual({
      people: [{ id: 'a', full_name: 'A' }],
      unions: [{ id: 'u', partner1_id: 'a' }],
      children: [],
      birth_ranks: [],
      origin_trees: [{ id: 't', anchor_person_id: 'a' }],
      root_union_id: 'u',
      generation_terms: ['Pangkal', 'Anak'],
    })
    expect(JSON.stringify(d)).not.toMatch(/0812|rahasia|contacts/)
  })

  it('penanda baris: id, atau orang tua + anak untuk urutan lahir; null kalau tidak lengkap', () => {
    expect(kunciBaris('people', { id: 'a' })).toBe('a')
    expect(kunciBaris('birth_ranks', { parent_id: 'p', child_id: 'c' })).toBe('p|c')
    expect(kunciBaris('birth_ranks', { parent_id: 'p' })).toBeNull()
    expect(kunciBaris('people', {})).toBeNull()
  })

  it('"belum ada data" = silsilah utama tanpa orang (pohon keluarga asal tidak dihitung)', () => {
    expect(dataKosong(saringData({}))).toBe(true)
    expect(dataKosong(saringData({ people: [{ id: 'x', tree_id: 't' }] }))).toBe(true)
    expect(dataKosong(saringData({ people: [{ id: 'a', tree_id: null }] }))).toBe(false)
  })
})
