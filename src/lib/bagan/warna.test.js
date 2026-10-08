import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { labelKartu } from '../silsilah/kartu.js'
import { WARNA_LEGENDA, warnaKartu } from './warna.js'

const k = (jenis, sex, wafat = false) => warnaKartu({ jenis, sex, wafat })

describe('warna kartu (aturan Irene)', () => {
  it('keturunan: laki-laki biru, perempuan pink', () => {
    expect(k('keturunan', 'L')).toBe('keturunan-l')
    expect(k('keturunan', 'P')).toBe('keturunan-p')
  })
  it('pasangan yang bukan keturunan: laki-laki hijau sage, perempuan peach', () => {
    expect(k('pasangan', 'L')).toBe('pasangan-l')
    expect(k('pasangan', 'P')).toBe('pasangan-p')
  })
  it('jenis kelamin tidak diketahui: abu', () => {
    expect(k('keturunan', null)).toBe('x')
    expect(k('pasangan', null)).toBe('x')
  })
  it('kedua kartu pangkal emas, juga kalau sudah wafat', () => {
    expect(k('pangkal', 'L')).toBe('pangkal')
    expect(k('pangkal', 'P', true)).toBe('pangkal')
  })
  it('wafat: keturunan dan pasangan punya warna sendiri, apa pun jenis kelaminnya', () => {
    expect(k('keturunan', 'L', true)).toBe('keturunan-wafat')
    expect(k('keturunan', null, true)).toBe('keturunan-wafat')
    expect(k('pasangan', 'P', true)).toBe('pasangan-wafat')
  })
  it('pasangan yang juga keturunan (antarsepupu) memakai warna keturunan', () => {
    const s = susunSilsilah(bangunKeluargaFiktif())
    expect(warnaKartu(labelKartu(s, 'gendis'))).toBe('keturunan-p')
    expect(warnaKartu(labelKartu(s, 'eka'))).toBe('pasangan-p')
    expect(warnaKartu(labelKartu(s, 'raksa'))).toBe('pangkal')
  })
  it('setiap warna punya aturan CSS dan nama di legenda', () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'index.css'), 'utf8')
    for (const w of WARNA_LEGENDA) expect(css).toContain(`[data-warna='${w}']`)
  })
})
