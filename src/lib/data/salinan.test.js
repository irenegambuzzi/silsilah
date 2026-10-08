// Salinan offline di IndexedDB (tiruan fake-indexeddb). Data FIKTIF.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { bacaSalinan, generasiPenghapusan, hapusDataLokal, simpanSalinan } from '../penyimpanan.js'
import { bacaSalinanUntuk, susunSalinan, tulisSalinan } from './salinan.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const anggota = { id: 'anggota-1', nama: 'Bu Contoh', peran: 'anggota', pemilik: false, izin: [] }
const data = {
  people: [{ id: 'a', tree_id: null, full_name: 'A Contoh', phone: '081234567890', address_enc: 'rahasia', region_lat: -7.1 }],
  unions: [],
  children: [],
  birth_ranks: [],
  origin_trees: [],
  root_union_id: null,
  generation_terms: null,
  contacts: [{ person_id: 'a', phone: '081234567890' }],
}

describe('salinan offline', () => {
  it('ditulis dan dibaca kembali untuk akun yang sama', async () => {
    expect(await tulisSalinan({ akun: 'akun-1', anggota, data }, generasiPenghapusan())).toBe(true)
    const s = await bacaSalinanUntuk('akun-1')
    expect(s.anggota).toEqual(anggota)
    expect(s.data.people.map((p) => p.full_name)).toEqual(['A Contoh'])
    expect(Date.parse(s.disimpanPada)).not.toBeNaN()
  })

  it('TIDAK PERNAH berisi data kontak atau lokasi, walaupun ada di data yang diberikan', async () => {
    await tulisSalinan({ akun: 'akun-1', anggota: { ...anggota, telepon: '0812' }, data }, generasiPenghapusan())
    const mentah = JSON.stringify(await bacaSalinan())
    expect(mentah).not.toMatch(/0812|rahasia|address|phone|region|contacts|telepon|-7\.1/)
  })

  it('akun lain tidak bisa memakai salinan ini', async () => {
    await tulisSalinan({ akun: 'akun-1', anggota, data }, generasiPenghapusan())
    expect(await bacaSalinanUntuk('akun-2')).toBeNull()
    expect(await bacaSalinanUntuk(null)).toBeNull()
  })

  it('format lain (versi aplikasi lain) tidak dipakai', async () => {
    await simpanSalinan({ ...susunSalinan({ akun: 'akun-1', anggota, data }), format: 99 }, generasiPenghapusan())
    expect(await bacaSalinanUntuk('akun-1')).toBeNull()
  })

  it('keluar menghapus salinan', async () => {
    await tulisSalinan({ akun: 'akun-1', anggota, data }, generasiPenghapusan())
    const hasil = await hapusDataLokal()
    expect(hasil.basisData).toBe(1)
    expect(await bacaSalinan()).toBeNull()
  })

  it('penulisan yang dimulai sebelum keluar tidak tertulis sesudahnya', async () => {
    const gen = generasiPenghapusan()
    await hapusDataLokal()
    expect(await tulisSalinan({ akun: 'akun-1', anggota, data }, gen)).toBe(false)
    expect(await bacaSalinan()).toBeNull()
  })

  it('penulisan yang sedang berjalan saat keluar ikut terhapus', async () => {
    const tulis = tulisSalinan({ akun: 'akun-1', anggota, data }, generasiPenghapusan())
    const hapus = hapusDataLokal()
    await Promise.all([tulis, hapus])
    expect(await bacaSalinan()).toBeNull()
  })

  it('tanpa IndexedDB (browser lama/mode privat ketat): tidak ada salinan, tanpa galat', async () => {
    const tanpa = {}
    expect(await simpanSalinan({ x: 1 }, generasiPenghapusan(), tanpa)).toBe(false)
    expect(await bacaSalinan(tanpa)).toBeNull()
  })
})
