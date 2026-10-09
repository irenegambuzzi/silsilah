import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'

describe('nomor silsilah', () => {
  const s = susunSilsilah(bangunKeluargaFiktif())

  it('pasangan pangkal = 1, anak mengikuti urutan lahir', () => {
    expect(s.nomor.get('raksa')).toBe('1')
    expect(s.nomor.get('selara')).toBe('1')
    expect(s.nomor.get('bima')).toBe('1.1')
    expect(s.nomor.get('cahya')).toBe('1.2')
    expect(s.nomor.get('lorvan')).toBe('1.3')
  })

  it('cucu dan cicit: 1.1.1, 1.1.11, 1.1.11.1', () => {
    expect(s.nomor.get('tamran')).toBe('1.1.1')
    expect(s.nomor.get('rangga')).toBe('1.1.11')
    expect(s.nomor.get('hasna')).toBe('1.1.11.1')
  })

  it('angka terakhir anak kandung = "Putra/Putri ke-n"; anak sambung/angkat sesudah semua anak kandung', () => {
    expect(s.nomor.get('wati')).toBe('1.2.1')
    expect(s.nomor.get('vino')).toBe('1.2.2') // anak sambung, walaupun lebih tua
    expect(s.nomor.get('kelvan')).toBe('1.3.1')
    expect(s.nomor.get('yoga')).toBe('1.3.2')
  })

  it('anak pasangan sepupu dinomori lewat jalur terdekat', () => {
    expect(s.nomor.get('nirvo')).toBe('1.1.1.1')
    expect(s.nomor.get('gendis')).toBe('1.3.1.1')
  })

  it('pasangan yang bukan keturunan tidak bernomor', () => {
    expect(s.nomor.has('eka')).toBe(false)
    expect(s.nomor.has('umar')).toBe(false)
  })

  it('tidak ada dua keturunan dengan nomor yang sama (selain pasangan pangkal)', () => {
    const semua = [...s.nomor].filter(([id]) => id !== 'raksa' && id !== 'selara').map(([, n]) => n)
    expect(new Set(semua).size).toBe(semua.length)
  })

  it('anak kandung tanpa urutan lahir mendapat nomor sesudah yang bernomor, menurut tanggal lahir', () => {
    const d = bangunKeluargaFiktif()
    d.birth_ranks = d.birth_ranks.filter((r) => !(r.parent_id === 'bima' && ['tamran', 'ika'].includes(r.child_id)))
    const t = susunSilsilah(d)
    expect(t.nomor.get('tirwan')).toBe('1.1.1')
    expect(t.nomor.get('rangga')).toBe('1.1.9')
    expect(t.nomor.get('tamran')).toBe('1.1.10')
    expect(t.nomor.get('ika')).toBe('1.1.11')
  })
})
