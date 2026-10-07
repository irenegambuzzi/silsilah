// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { AWALAN, KUNCI, bacaAksesBerakhir, hapusDataLokal, simpanAksesBerakhir } from './penyimpanan.js'

// Penyimpanan tiruan seperti localStorage.
const penyimpananTiruan = (isi = {}) => {
  const d = new Map(Object.entries(isi))
  return {
    get length() { return d.size },
    key: (i) => [...d.keys()][i] ?? null,
    getItem: (k) => d.get(k) ?? null,
    setItem: (k, v) => d.set(k, String(v)),
    removeItem: (k) => d.delete(k),
    ada: (k) => d.has(k),
    kunci: () => [...d.keys()],
  }
}

describe('hapusDataLokal', () => {
  it('menghapus HANYA yang berawalan "silsilah"; data proyek lain di alamat yang sama tidak tersentuh', async () => {
    const lokal = penyimpananTiruan({ 'silsilah-auth': 'a', 'silsilah-salinan-orang': 'b', 'nutrihub-sesi': 'c', tema: 'gelap', silsilahX: 'd' })
    const sesi = penyimpananTiruan({ 'silsilah-x': '1', lain: '2' })
    const hasil = await hapusDataLokal({ localStorage: lokal, sessionStorage: sesi })
    expect(lokal.kunci().sort()).toEqual(['nutrihub-sesi', 'tema'])
    expect(sesi.kunci()).toEqual(['lain'])
    expect(hasil).toMatchObject({ penyimpananLokal: 3, penyimpananSesi: 1 })
  })

  it('pilihan tampilan (bukan data keluarga) dipertahankan', async () => {
    const lokal = penyimpananTiruan({ [KUNCI.tampilan]: '{"ukuran":"besar"}', [KUNCI.auth]: 'sesi' })
    await hapusDataLokal({ localStorage: lokal })
    expect(lokal.kunci()).toEqual([KUNCI.tampilan])
  })

  it('basis data dan cache: hanya yang berawalan "silsilah"', async () => {
    const hapusDb = vi.fn(() => {
      const r = {}
      setTimeout(() => r.onsuccess?.(), 0)
      return r
    })
    const hapusCache = vi.fn(async () => true)
    const hasil = await hapusDataLokal({
      indexedDB: { databases: async () => [{ name: 'silsilah-data' }, { name: 'silsilah-kabar' }, { name: 'nutrihub' }], deleteDatabase: hapusDb },
      caches: { keys: async () => ['silsilah-v1', 'nutrihub-v1'], delete: hapusCache },
    })
    expect(hapusDb.mock.calls.map((c) => c[0])).toEqual(['silsilah-data', 'silsilah-kabar'])
    expect(hapusCache.mock.calls.map((c) => c[0])).toEqual(['silsilah-v1'])
    expect(hasil).toMatchObject({ basisData: 2, cache: 1 })
  })

  it('browser tanpa indexedDB.databases(): tetap mencoba nama bawaan', async () => {
    const hapusDb = vi.fn(() => { const r = {}; setTimeout(() => r.onsuccess?.(), 0); return r })
    await hapusDataLokal({ indexedDB: { deleteDatabase: hapusDb } })
    expect(hapusDb).toHaveBeenCalledWith('silsilah')
  })

  it('tidak pernah melempar galat, walaupun penyimpanan menolak (mode pribadi, diblokir)', async () => {
    const rusak = { get length() { throw new Error('diblokir') }, key() { throw new Error('diblokir') }, removeItem() { throw new Error('diblokir') } }
    await expect(hapusDataLokal({
      localStorage: rusak,
      sessionStorage: rusak,
      indexedDB: { databases: async () => { throw new Error('ditolak') } },
      caches: { keys: async () => { throw new Error('ditolak') } },
    })).resolves.toMatchObject({ penyimpananLokal: 0 })
  })

  it('satu bagian gagal tidak menghentikan bagian lain', async () => {
    const lokal = penyimpananTiruan({ 'silsilah-a': '1' })
    await hapusDataLokal({ localStorage: lokal, indexedDB: { databases: async () => { throw new Error('x') } } })
    expect(lokal.kunci()).toEqual([])
  })

  it('semua kunci aplikasi berawalan "silsilah" (kalau tidak, tidak ikut terhapus)', () => {
    for (const k of Object.values(KUNCI)) expect(k.startsWith(AWALAN), k).toBe(true)
  })
})

describe('akses berakhir', () => {
  it('disimpan sebagai waktu ISO, dan nilai rusak dianggap tidak ada', () => {
    localStorage.clear()
    expect(bacaAksesBerakhir()).toBeNull()
    simpanAksesBerakhir('2026-10-07T08:30:00Z')
    expect(bacaAksesBerakhir()).toBe('2026-10-07T08:30:00.000Z')
    localStorage.setItem(KUNCI.aksesBerakhir, 'bukan waktu')
    expect(bacaAksesBerakhir()).toBeNull()
    simpanAksesBerakhir(null)
    expect(localStorage.getItem(KUNCI.aksesBerakhir)).toBeNull()
  })
})
