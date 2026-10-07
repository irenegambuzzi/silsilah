// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { KUNCI } from './penyimpanan.js'
import { TAMPILAN_BAWAAN, bacaTampilan, simpanTampilan, terapkanTampilan } from './tampilan.js'

const akarTiruan = () => ({ dataset: {} })

describe('tampilan', () => {
  it('bawaan: huruf normal dan kontras biasa', () => {
    localStorage.clear()
    expect(bacaTampilan()).toEqual(TAMPILAN_BAWAAN)
  })
  it('nilai rusak atau tidak dikenal diganti nilai bawaan', () => {
    for (const isi of ['bukan json', '{"ukuran":"raksasa","kontras":"ya"}', 'null', '[]']) {
      localStorage.setItem(KUNCI.tampilan, isi)
      expect(bacaTampilan()).toEqual(TAMPILAN_BAWAAN)
    }
  })
  it('disimpan dan dibaca kembali', () => {
    simpanTampilan({ ukuran: 'sangatBesar', kontras: true })
    expect(bacaTampilan()).toEqual({ ukuran: 'sangatBesar', kontras: true })
    expect(document.documentElement.dataset.ukuran).toBe('sangatBesar')
    expect(document.documentElement.dataset.kontras).toBe('tinggi')
    localStorage.clear()
    delete document.documentElement.dataset.ukuran
    delete document.documentElement.dataset.kontras
  })
  it('terapkanTampilan menulis dan menghapus atribut kontras', () => {
    const akar = akarTiruan()
    terapkanTampilan({ ukuran: 'besar', kontras: true }, akar)
    expect(akar.dataset).toEqual({ ukuran: 'besar', kontras: 'tinggi' })
    terapkanTampilan({ ukuran: 'normal', kontras: false }, akar)
    expect(akar.dataset).toEqual({ ukuran: 'normal' })
  })
})
