import { afterEach, describe, expect, it, vi } from 'vitest'
import { bacaDataLokasi, cariLokasi, susunDataLokasi } from './lokasi.js'
import { uraiIp } from './ip.js'

const contoh = () => susunDataLokasi({
  v4: [{ awal: 0, indeks: 0 }, { awal: 0xc0000200, indeks: 1 }, { awal: 0xc0000300, indeks: 2 }, { awal: 0xc0000400, indeks: 0 }],
  v6: [{ hi: 0x20010db8, lo: 0, indeks: 3 }, { hi: 0x20010db8, lo: 1, indeks: 0 }],
  teks: ['', 'ID\tKota Contoh', 'NG\t', 'IT\tKota Lain Contoh'],
  tanggal: 20261001,
})

afterEach(() => vi.restoreAllMocks())

describe('format file data lokasi', () => {
  it('ditulis lalu dibaca kembali dengan isi yang sama', () => {
    const d = bacaDataLokasi(contoh())
    expect(d.tanggal).toBe(20261001)
    expect(d.teks).toHaveLength(4)
    expect(cariLokasi(d, uraiIp('192.0.2.1'))).toEqual({ approx_country: 'ID', approx_city: 'Kota Contoh' })
    expect(cariLokasi(d, uraiIp('192.0.3.1'))).toEqual({ approx_country: 'NG', approx_city: null })
    expect(cariLokasi(d, uraiIp('192.0.4.1'))).toBeNull()
    expect(cariLokasi(d, uraiIp('2001:db8::abcd'))).toEqual({ approx_country: 'IT', approx_city: 'Kota Lain Contoh' })
    expect(cariLokasi(d, uraiIp('2001:db8:0:1::'))).toBeNull()
    expect(cariLokasi(d, uraiIp('2001:db7::'))).toBeNull()
    expect(cariLokasi(d, null)).toBeNull()
    expect(cariLokasi(null, uraiIp('192.0.2.1'))).toBeNull()
  })
  it('file rusak atau asing ditolak', () => {
    expect(() => bacaDataLokasi(new Uint8Array(10))).toThrow()
    expect(() => bacaDataLokasi(new TextEncoder().encode('bukan data lokasi sama sekali, sungguh'))).toThrow()
    const terpotong = contoh().slice(0, -3)
    expect(() => bacaDataLokasi(terpotong)).toThrow()
  })
  it('file yang tidak rata 4 byte di memori tetap terbaca', () => {
    const asli = contoh()
    const geser = new Uint8Array(asli.length + 1)
    geser.set(asli, 1)
    expect(cariLokasi(bacaDataLokasi(geser.subarray(1)), uraiIp('192.0.2.1')).approx_city).toBe('Kota Contoh')
  })
  it('mencari lokasi TIDAK memakai jaringan sama sekali', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const d = bacaDataLokasi(contoh())
    for (let i = 0; i < 1000; i++) cariLokasi(d, { versi: 4, n: (i * 2654435761) >>> 0 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
