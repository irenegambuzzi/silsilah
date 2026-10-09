import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { statusPernikahan } from './status.js'

const dengan = (ubah) => {
  const d = bangunKeluargaFiktif()
  ubah(d)
  return susunSilsilah(d)
}
const orang = (d, id) => d.people.find((p) => p.id === id)
const nikah = (d, id) => d.unions.find((u) => u.id === id)

describe('status pernikahan (pilihan tetap)', () => {
  const s = susunSilsilah(bangunKeluargaFiktif())

  it('ada pernikahan yang masih berjalan → Menikah', () => {
    expect(statusPernikahan(s, 'bima')).toBe('menikah') // pernikahan ke-4 (Gita)
    expect(statusPernikahan(s, 'ika')).toBe('menikah') // suami ke-1 wafat, menikah lagi
    expect(statusPernikahan(s, 'cahya')).toBe('menikah')
  })

  it('pernikahan terakhir berakhir karena berpisah → Berpisah', () => {
    expect(statusPernikahan(s, 'eka')).toBe('berpisah')
    expect(statusPernikahan(s, 'fitri')).toBe('berpisah')
  })

  it('pasangan dalam pernikahan terakhir wafat → Ditinggal wafat pasangan', () => {
    expect(statusPernikahan(s, 'dara')).toBe('ditinggal_wafat')
    // Keduanya wafat: hanya yang ditinggal lebih dulu.
    expect(statusPernikahan(s, 'selara')).toBe('ditinggal_wafat') // Raksa wafat 1990, Selara 2001
    expect(statusPernikahan(s, 'raksa')).toBe('menikah')
  })

  it('pernikahan baru tanpa menandai yang lama berakhir: tetap Menikah', () => {
    const t = dengan((d) => {
      nikah(d, 'u2').status = 'menikah'
    })
    expect(statusPernikahan(t, 'bima')).toBe('menikah')
    expect(statusPernikahan(t, 'fitri')).toBe('menikah')
  })

  it('berpisah lalu menikah lagi: mengikuti pernikahan terakhir', () => {
    const t = dengan((d) => {
      nikah(d, 'u4').status = 'cerai'
    })
    expect(statusPernikahan(t, 'bima')).toBe('berpisah')
  })

  it('tanpa data pernikahan → null ("-"), BUKAN "Belum menikah"', () => {
    expect(statusPernikahan(s, 'oka')).toBeNull()
    expect(statusPernikahan(s, 'bayu')).toBeNull()
  })

  it('"Belum menikah" hanya kalau orangnya sendiri memilihnya', () => {
    const t = dengan((d) => {
      orang(d, 'oka').marital_choice = 'belum_menikah'
    })
    expect(statusPernikahan(t, 'oka')).toBe('belum_menikah')
  })

  it('data pernikahan mengalahkan pilihan lama "Belum menikah"', () => {
    const t = dengan((d) => {
      orang(d, 'gita').marital_choice = 'belum_menikah'
    })
    expect(statusPernikahan(t, 'gita')).toBe('menikah')
  })

  it('status pernikahan terakhir tidak diketahui → null', () => {
    expect(statusPernikahan(s, 'lintang')).toBeNull()
  })
})
