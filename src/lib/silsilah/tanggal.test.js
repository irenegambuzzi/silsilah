import { describe, expect, it } from 'vitest'
import { bandingkanKabur, formatTanggal, tahunHidup, tanggalDari, teksPeristiwa, teksWaktu } from './tanggal.js'

describe('formatTanggal', () => {
  it('menulis tanggal lengkap, bulan-tahun, dan tahun saja', () => {
    expect(formatTanggal({ y: 1950, m: 3, d: 12 })).toBe('12 Maret 1950')
    expect(formatTanggal({ y: 1950, m: 3, d: null })).toBe('Maret 1950')
    expect(formatTanggal({ y: 1950, m: null, d: null })).toBe('1950')
  })

  it('menandai perkiraan', () => {
    expect(formatTanggal({ y: 1950, m: null, d: null, approx: true })).toBe('sekitar 1950')
    expect(formatTanggal({ y: 1950, m: 3, d: null, approx: true })).toBe('sekitar Maret 1950')
  })

  it('kosong kalau tahun tidak diketahui', () => {
    expect(formatTanggal({ y: null, m: null, d: null })).toBe('')
    expect(formatTanggal(null)).toBe('')
  })

  it('membaca kolom database dengan awalan', () => {
    const orang = { birth_y: 1950, birth_m: 3, birth_d: null, birth_approx: true }
    expect(formatTanggal(tanggalDari(orang, 'birth'))).toBe('sekitar Maret 1950')
    expect(formatTanggal(tanggalDari(orang, 'death'))).toBe('')
  })
})

describe('bandingkanKabur', () => {
  it('mengurutkan menurut tahun, bulan, lalu hari', () => {
    const t = (y, m, d) => ({ y, m, d })
    expect(bandingkanKabur(t(1950, 3, 1), t(1951, 1, 1))).toBeLessThan(0)
    expect(bandingkanKabur(t(1950, 3, 1), t(1950, 2, 28))).toBeGreaterThan(0)
    expect(bandingkanKabur(t(1950, 3, 1), t(1950, 3, 2))).toBeLessThan(0)
    expect(bandingkanKabur(t(1950, 3, 1), t(1950, 3, 1))).toBe(0)
  })

  it('bagian yang tidak diketahui ditaruh di akhir', () => {
    const t = (y, m, d) => ({ y, m, d })
    expect(bandingkanKabur(t(1950, null, null), t(1950, 12, 31))).toBeGreaterThan(0)
    expect(bandingkanKabur(t(null, null, null), t(2100, 1, 1))).toBeGreaterThan(0)
  })
})

describe('tahunHidup', () => {
  const dasar = { birth_y: null, birth_approx: false, is_deceased: false, death_y: null, death_approx: false }
  it('masih hidup: hanya tahun lahir', () => {
    expect(tahunHidup({ ...dasar, birth_y: 1971 })).toBe('1971')
    expect(tahunHidup(dasar)).toBe('')
  })
  it('sudah wafat: tahun lahir–wafat, dengan ? untuk yang tidak diketahui', () => {
    const wafat = { ...dasar, is_deceased: true }
    expect(tahunHidup({ ...wafat, birth_y: 1920, death_y: 1990 })).toBe('1920–1990')
    expect(tahunHidup({ ...wafat, birth_y: 1920 })).toBe('1920–?')
    expect(tahunHidup({ ...wafat, death_y: 1990 })).toBe('?–1990')
    expect(tahunHidup(wafat)).toBe('')
  })
  it('perkiraan diberi tanda ±', () => {
    expect(tahunHidup({ ...dasar, birth_y: 1950, birth_approx: true })).toBe('±1950')
  })
})

describe('teksPeristiwa', () => {
  it('menggabungkan tempat dan tanggal: "Kota, 12 Maret 1950"', () => {
    const orang = { birth_y: 1950, birth_m: 3, birth_d: 12, birth_place: 'Kota Contoh' }
    expect(teksPeristiwa(orang, 'birth')).toBe('Kota Contoh, 12 Maret 1950')
    expect(teksPeristiwa({ birth_place: 'Kota Contoh' }, 'birth')).toBe('Kota Contoh')
    expect(teksPeristiwa({ birth_y: 1950, birth_approx: true }, 'birth')).toBe('sekitar 1950')
    expect(teksPeristiwa({}, 'death')).toBe('')
  })

  it('waktu untuk kalimat: "tahun 1974", "sekitar tahun 1974", "pada 2 Juni 1974"', () => {
    expect(teksWaktu({ y: 1974 })).toBe('tahun 1974')
    expect(teksWaktu({ y: 1974, approx: true })).toBe('sekitar tahun 1974')
    expect(teksWaktu({ y: 1974, m: 6 })).toBe('pada Juni 1974')
    expect(teksWaktu({ y: 1974, m: 6, d: 2 })).toBe('pada 2 Juni 1974')
    expect(teksWaktu({ y: 1974, m: 6, approx: true })).toBe('sekitar Juni 1974')
    expect(teksWaktu({ y: null })).toBe('')
  })
})
