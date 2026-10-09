import { describe, expect, it } from 'vitest'
import { belumDewasa, masihAnak } from './umur.js'

const hari = new Date(2026, 9, 9) // 9 Oktober 2026

describe('belum dewasa (di bawah 18 tahun)', () => {
  it('tanggal lahir lengkap: tepat di hari ulang tahun ke-18 sudah dewasa', () => {
    expect(belumDewasa({ birth_y: 2008, birth_m: 10, birth_d: 10 }, hari)).toBe(true)
    expect(belumDewasa({ birth_y: 2008, birth_m: 10, birth_d: 9 }, hari)).toBe(false)
  })
  it('hanya tahun atau bulan: dihitung dari tanggal lahir paling akhir yang mungkin', () => {
    expect(belumDewasa({ birth_y: 2008 }, hari)).toBe(true) // bisa lahir 31 Desember 2008
    expect(belumDewasa({ birth_y: 2007 }, hari)).toBe(false)
    expect(belumDewasa({ birth_y: 2008, birth_m: 9 }, hari)).toBe(false)
    expect(belumDewasa({ birth_y: 2008, birth_m: 10 }, hari)).toBe(true)
  })
  it('hilang sendiri setelah berusia 18 tahun', () => {
    expect(belumDewasa({ birth_y: 2013 }, hari)).toBe(true)
    expect(belumDewasa({ birth_y: 2013 }, new Date(2032, 0, 1))).toBe(false)
  })
  it('tanggal lahir tidak diketahui, atau sudah wafat: tidak ditandai', () => {
    expect(belumDewasa({ birth_y: null }, hari)).toBe(false)
    expect(belumDewasa({ birth_y: 2020, is_deceased: true, death_y: 2021 }, hari)).toBe(false)
  })
})

describe('masih anak (panel keterangan)', () => {
  it('di bawah umur, atau wafat sebelum 18 tahun', () => {
    expect(masihAnak({ birth_y: 2013 }, hari)).toBe(true)
    expect(masihAnak({ birth_y: 1998, is_deceased: true, death_y: 1998 }, hari)).toBe(true)
    expect(masihAnak({ birth_y: 1975, is_deceased: true, death_y: 2015 }, hari)).toBe(false)
  })
  it('wafat tanpa tahun wafat: tidak diketahui, jadi bukan anak', () => {
    expect(masihAnak({ birth_y: 1950, is_deceased: true }, hari)).toBe(false)
  })
})
