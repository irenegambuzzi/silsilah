import { describe, expect, it } from 'vitest'
import { formatJam, formatTanggalJam, sisaMenitDetik, sisaWaktuPanjang } from './waktu.js'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

describe('waktu', () => {
  it('jam dua angka dengan titik (menurut zona waktu perangkat)', () => {
    expect(formatJam(new Date(2026, 9, 7, 8, 5))).toBe('08.05')
    expect(formatJam(new Date(2026, 9, 7, 15, 30))).toBe('15.30')
  })
  it('tanggal dan jam', () => {
    expect(formatTanggalJam(new Date(2026, 9, 7, 15, 30), BULAN)).toBe('7 Oktober 2026, 15.30')
  })
  it('hitung mundur menit:detik, tidak pernah negatif', () => {
    expect(sisaMenitDetik(600000)).toBe('10:00')
    expect(sisaMenitDetik(65000)).toBe('1:05')
    expect(sisaMenitDetik(999)).toBe('0:01')
    expect(sisaMenitDetik(-5000)).toBe('0:00')
  })
  it('sisa waktu panjang dalam bahasa Indonesia', () => {
    expect(sisaWaktuPanjang(30000)).toBe('1 menit')
    expect(sisaWaktuPanjang(0)).toBe('kurang dari 1 menit')
    expect(sisaWaktuPanjang(25 * 60000)).toBe('25 menit')
    expect(sisaWaktuPanjang(60 * 60000)).toBe('1 jam')
    expect(sisaWaktuPanjang(95 * 60000)).toBe('1 jam 35 menit')
  })
})
