import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { susunBagan } from './susun.js'
import { UKURAN, tataBagan } from './tata.js'

const data = bangunKeluargaFiktif()
const bagan = susunBagan(susunSilsilah(data))
const t = tataBagan(bagan.akar)
const W = UKURAN.lebarKartu
const H = UKURAN.tinggiKartu
const kotak = () =>
  [...t.letak].filter(([k]) => /^[op]:/.test(k)).map(([kunci, { x, y }]) => ({ kunci, x, y, x2: x + W, y2: y + H }))
const garisKe = (id) => t.garis.find((g) => g.jenis === 'anak' && g.kunci.endsWith(`>${id}`))
const hati = (kunci) => t.hati.find((h) => h.kunci === kunci)

describe('tataBagan', () => {
  it('semua koordinat di dalam ukuran bagan, tidak negatif', () => {
    for (const k of kotak()) {
      expect(k.x).toBeGreaterThanOrEqual(0)
      expect(k.y).toBeGreaterThanOrEqual(0)
      expect(k.x2).toBeLessThanOrEqual(t.lebar + 1e-9)
      expect(k.y2).toBeLessThanOrEqual(t.tinggi + 1e-9)
    }
  })

  it('tidak ada kartu yang bertumpuk', () => {
    const semua = kotak()
    for (let i = 0; i < semua.length; i++) {
      for (let j = i + 1; j < semua.length; j++) {
        const a = semua[i]
        const b = semua[j]
        const tumpuk = a.x < b.x2 - 1e-9 && b.x < a.x2 - 1e-9 && a.y < b.y2 - 1e-9 && b.y < a.y2 - 1e-9
        expect(tumpuk, `${a.kunci} dan ${b.kunci}`).toBe(false)
      }
    }
  })

  it('satu pasangan: duduk tepat di samping keturunannya, hati di antara keduanya', () => {
    const cahya = t.letak.get('o:cahya')
    const umar = t.letak.get('p:cahya:0')
    expect(umar.y).toBe(cahya.y)
    expect(umar.x).toBeCloseTo(cahya.x + W + UKURAN.jarakHati)
    expect(hati('h:cahya:0')).toMatchObject({ x: cahya.x + W + UKURAN.jarakHati / 2, y: cahya.y + H / 2 })
  })

  it('garis ke anak keluar dari hati orang tuanya: turun lurus, lalu siku-siku ke anak', () => {
    const h = hati('h:cahya:0')
    for (const id of ['vino', 'wati']) {
      const g = garisKe(id)
      const anak = t.letak.get(`o:${id}`)
      expect(g.kunci.startsWith('h:cahya:0>')).toBe(true)
      expect(g.titik[0]).toEqual([h.x, h.y + UKURAN.jariHati])
      expect(g.titik[1][0]).toBe(h.x) // turun lurus
      expect(g.titik[2][1]).toBe(g.titik[1][1]) // mendatar
      expect(g.titik[3]).toEqual([anak.x + W / 2, anak.y]) // tepat ke atas kartu anak
    }
  })

  it('lebih dari satu pasangan: setiap pernikahan punya hati dan garis ke anaknya sendiri', () => {
    const bima = bagan.simpul.get('bima')
    bima.pasangan.forEach((k, i) => {
      const h = hati(`h:bima:${i}`)
      expect(h).toBeTruthy()
      for (const a of k.anak) expect(garisKe(a.id).kunci).toBe(`h:bima:${i}>${a.id}`)
      // pasangan di bawah keturunan, dengan label "Istri ke-n" di atasnya
      expect(t.letak.get(`p:bima:${i}`).y).toBeGreaterThan(t.letak.get('o:bima').y + H)
      expect(t.letak.get(`l:bima:${i}`).y).toBeLessThan(t.letak.get(`p:bima:${i}`).y)
    })
  })

  it('garis putus-putus HANYA untuk pernikahan yang bercerai', () => {
    const putus = t.garis.filter((g) => g.putus)
    expect(putus.length).toBeGreaterThan(0)
    for (const g of putus) expect(g.jenis).toBe('nikah')
    // Bima: Eka (cerai) dan Fitri (cerai) putus-putus; Gita (menikah) tidak.
    const nikahBima = (i) => t.garis.filter((g) => g.kunci.startsWith(`n:bima:${i}:`))
    expect(nikahBima(0).every((g) => g.putus)).toBe(true)
    expect(nikahBima(1).every((g) => g.putus)).toBe(true)
    expect(nikahBima(2).some((g) => g.putus)).toBe(false)
    // Pasangan pangkal (sama-sama sudah wafat, tidak bercerai): garis biasa.
    expect(t.garis.filter((g) => g.kunci.startsWith('n:raksa:')).some((g) => g.putus)).toBe(false)
    expect(t.garis.filter((g) => g.jenis === 'anak').some((g) => g.putus)).toBe(false)
  })

  it('anak dari pernikahan antarsepupu hanya punya SATU garis masuk', () => {
    expect(t.garis.filter((g) => g.kunci.endsWith('>hasna'))).toHaveLength(1)
    expect(t.garis.filter((g) => g.kunci.endsWith('>nirvo'))).toHaveLength(1)
  })

  it('tanpa pasangan: kartu sendiri, tanpa hati', () => {
    const satu = { id: 'a', kartu: {}, pasangan: [], anak: [] }
    const h = tataBagan(satu)
    expect(h.lebar).toBe(W)
    expect(h.tinggi).toBe(H)
    expect(h.hati).toEqual([])
  })
})
