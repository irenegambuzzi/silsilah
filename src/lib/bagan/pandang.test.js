import { describe, expect, it } from 'vitest'
import { SKALA_MAX, SKALA_MIN, TEPI, batasiSkala, geser, jagaTerlihat, pandangAwal, pasDiLayar, pusatkan, zoomDi } from './pandang.js'

const bingkai = { lebar: 400, tinggi: 600 }

describe('zoomDi', () => {
  it('titik di bawah jari tetap di tempatnya', () => {
    const p = { x: 30, y: -20, k: 1 }
    const titik = { x: 200, y: 300 }
    const baru = zoomDi(p, 2, titik)
    // koordinat isi di bawah titik sebelum dan sesudah harus sama
    expect((titik.x - p.x) / p.k).toBeCloseTo((titik.x - baru.x) / baru.k)
    expect((titik.y - p.y) / p.k).toBeCloseTo((titik.y - baru.y) / baru.k)
    expect(baru.k).toBe(2)
  })
  it('skala dibatasi', () => {
    expect(zoomDi({ x: 0, y: 0, k: 1 }, 1000, { x: 0, y: 0 }).k).toBe(SKALA_MAX)
    expect(zoomDi({ x: 0, y: 0, k: 1 }, 0.0001, { x: 0, y: 0 }).k).toBe(SKALA_MIN)
    expect(batasiSkala(1)).toBe(1)
  })
})

describe('geser dan jagaTerlihat', () => {
  it('geser menambah x dan y', () => {
    expect(geser({ x: 1, y: 2, k: 1 }, 10, -5)).toEqual({ x: 11, y: -3, k: 1 })
  })
  it('bagan tidak bisa digeser sampai hilang dari bingkai', () => {
    const isi = { lebar: 2000, tinggi: 1000 }
    const jauhKiri = jagaTerlihat({ x: -99999, y: -99999, k: 1 }, isi, bingkai)
    expect(jauhKiri.x).toBe(80 - 2000)
    expect(jauhKiri.y).toBe(80 - 1000)
    const jauhKanan = jagaTerlihat({ x: 99999, y: 99999, k: 1 }, isi, bingkai)
    expect(jauhKanan.x).toBe(400 - 80)
    expect(jauhKanan.y).toBe(600 - 80)
  })
  it('posisi yang wajar tidak diubah', () => {
    const p = { x: -300, y: 40, k: 0.8 }
    expect(jagaTerlihat(p, { lebar: 2000, tinggi: 1000 }, bingkai)).toEqual(p)
  })
})

describe('tampilan awal', () => {
  it('bagan kecil: ukuran asli dan di tengah', () => {
    const p = pandangAwal({ lebar: 200, tinggi: 200 }, bingkai)
    expect(p).toEqual({ k: 1, x: 100, y: TEPI })
  })
  it('bagan lebar: diperkecil sampai seluruh bagan terlihat, berpusat', () => {
    const isi = { lebar: 4000, tinggi: 1000 }
    const p = pandangAwal(isi, bingkai)
    expect(p).toEqual(pasDiLayar(isi, bingkai))
    expect(isi.lebar * p.k).toBeLessThanOrEqual(bingkai.lebar - 2 * TEPI + 1e-6)
  })
  it('"Pas di layar" memuat seluruh bagan, walau sangat kecil', () => {
    const isi = { lebar: 4000, tinggi: 3000 }
    const p = pasDiLayar(isi, bingkai)
    expect(isi.lebar * p.k).toBeLessThanOrEqual(bingkai.lebar - 2 * TEPI + 1e-6)
    expect(isi.tinggi * p.k).toBeLessThanOrEqual(bingkai.tinggi - 2 * TEPI + 1e-6)
  })
  it('pusatkan menaruh titik isi di tengah bingkai', () => {
    const p = pusatkan({ x: 0, y: 0, k: 2 }, { x: 500, y: 300 }, bingkai)
    expect(500 * 2 + p.x).toBe(200)
    expect(300 * 2 + p.y).toBe(300)
  })
})
