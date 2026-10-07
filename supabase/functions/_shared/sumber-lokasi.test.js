import { afterEach, describe, expect, it, vi } from 'vitest'
import zlib from 'node:zlib'
import { buatPencariLokasi } from './sumber-lokasi.js'
import { susunDataLokasi } from './lokasi.js'

const DATA = susunDataLokasi({
  v4: [{ awal: 0xc0000200, indeks: 1 }, { awal: 0xc0000300, indeks: 0 }],
  v6: [],
  teks: ['', 'ID\tKota Contoh'],
  tanggal: 0,
})
const GZ = new Uint8Array(zlib.gzipSync(DATA))

afterEach(() => vi.restoreAllMocks())

describe('buatPencariLokasi', () => {
  it('data dimuat SEKALI (gzip dibuka), lalu dipakai untuk semua permintaan', async () => {
    const unduh = vi.fn(async () => GZ)
    const cari = buatPencariLokasi(unduh)
    expect(await cari('192.0.2.9')).toEqual({ approx_country: 'ID', approx_country_name: 'Indonesia', approx_city: 'Kota Contoh' })
    expect(await cari('192.0.3.9')).toEqual({})
    expect(await cari('bukan ip')).toEqual({})
    expect(unduh).toHaveBeenCalledTimes(1)
  })

  it('data belum ada di Storage → login tetap jalan tanpa lokasi; dicoba lagi setelah jeda', async () => {
    let waktu = 0
    const unduh = vi.fn(async () => { throw new Error('tidak ada') })
    const cari = buatPencariLokasi(unduh, { jedaUlangMs: 600000, sekarang: () => waktu })
    expect(await cari('192.0.2.9')).toEqual({})
    expect(await cari('192.0.2.9')).toEqual({})
    expect(unduh).toHaveBeenCalledTimes(1)
    waktu = 600001
    unduh.mockImplementation(async () => DATA)
    expect(await cari('192.0.2.9')).toEqual({ approx_country: 'ID', approx_country_name: 'Indonesia', approx_city: 'Kota Contoh' })
    expect(unduh).toHaveBeenCalledTimes(2)
  })

  it('unduhan lambat tidak menahan login lebih dari batas waktu', async () => {
    let lepas
    const cari = buatPencariLokasi(() => new Promise((r) => { lepas = r }), { batasWaktuMs: 20 })
    const mulai = Date.now()
    expect(await cari('192.0.2.9')).toEqual({})
    expect(Date.now() - mulai).toBeLessThan(1000)
    lepas(DATA)
    await new Promise((r) => setTimeout(r, 10))
    expect(await cari('192.0.2.9')).toEqual({ approx_country: 'ID', approx_country_name: 'Indonesia', approx_city: 'Kota Contoh' })
  })

  it('nama negara bahasa Indonesia; kode aneh → null', async () => {
    const { namaNegara } = await import('./sumber-lokasi.js')
    expect([namaNegara('IT'), namaNegara('NG'), namaNegara('SA'), namaNegara('NL')]).toEqual(['Italia', 'Nigeria', 'Arab Saudi', 'Belanda'])
    expect(namaNegara('QQ')).toBeNull()
    expect(namaNegara('bukan kode')).toBeNull()
  })

  it('tidak memakai fetch (data hanya dari fungsi unduh yang diberikan)', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    await buatPencariLokasi(async () => GZ)('192.0.2.9')
    expect(fetch).not.toHaveBeenCalled()
  })
})
