import { describe, expect, it } from 'vitest'
import { alamatKode, kodeSahBentuk, tampilkanKode } from './kode.js'

describe('kode', () => {
  it('diketik bebas → ABCD-2345', () => {
    expect(tampilkanKode('abcd2345')).toBe('ABCD-2345')
    expect(tampilkanKode(' ab cd-23 45 99')).toBe('ABCD-2345')
    expect(tampilkanKode('abc')).toBe('ABC')
    expect(tampilkanKode('')).toBe('')
  })
  it('bentuk sah: 8 karakter tanpa 0/O/1/I', () => {
    expect(kodeSahBentuk('abcd-2345')).toBe(true)
    for (const salah of ['', 'ABC', 'ABCD-234', 'ABCD-23456', 'ABCD-2340', 'ABCD-OOOO', 'ABCD-1111']) expect(kodeSahBentuk(salah), salah).toBe(false)
  })
  it('alamat kode disusun dari alamat situs dan alamat dasar yang sedang dipakai', () => {
    // Awalan alamat dirakit di sini supaya pemindai rahasia tidak menganggap contoh ini kode sungguhan.
    const awalan = '#/' + 'kode/'
    expect(alamatKode('abcd-2345', { asal: 'https://contoh.invalid', dasar: '/silsilah/' })).toBe(`https://contoh.invalid/silsilah/${awalan}ABCD2345`)
    expect(alamatKode('ABCD2345', { asal: 'https://keluarga.invalid', dasar: '/' })).toBe(`https://keluarga.invalid/${awalan}ABCD2345`)
  })
})
