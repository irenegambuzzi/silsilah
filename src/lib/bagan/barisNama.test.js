import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { namaKartu } from '../silsilah/nama.js'
import { BATAS_SATU_BARIS, JARAK_BARIS, LEBAR_DALAM, TINGGI_NAMA, TINGKAT_NAMA, UKURAN_NAMA, barisNamaKartu, cobaUkuran, lebarBaris } from './barisNama.js'
import { GELAR, NAMA } from './lebarHuruf.js'
import { PILIHAN_UKURAN } from '../../contoh/pilihanUkuran.js'

const data = bangunKeluargaFiktif()
const orang = (id) => data.people.find((p) => p.id === id)
const susun = (id, ukuran) => barisNamaKartu(namaKartu(orang(id)), ukuran)
const teksBaris = (h) =>
  h.baris.map((b) => b.map((x) => `${x.depan ? `${x.depan} ` : ''}${x.kata}${x.belakang ? `, ${x.belakang}` : ''}`).join(' '))
const bergelar = (n) => Boolean(n.depan || n.belakang)
// Susunan memenuhi semua batas pada ukuran `rem` / tingkat `ukuran`.
const muat = (h, n) =>
  h.baris.length <= (bergelar(n) ? 3 : 2) &&
  h.baris.every((b) => lebarBaris(b, h.rem) <= LEBAR_DALAM) &&
  (h.baris.length > 1 || n.kata.length === 1 || lebarBaris(h.baris[0], h.rem) <= LEBAR_DALAM * BATAS_SATU_BARIS) &&
  h.baris.length * h.rem * JARAK_BARIS[h.ukuran] <= TINGGI_NAMA + 1e-9

// Putaran ketujuh, bagian 5; putaran 7b, bagian B: ukuran terbesar yang muat.
describe('barisNamaKartu', () => {
  it('satu baris kalau muat dalam 85% lebar dalam kartu', () => {
    for (const id of ['mega', 'ratrisa-k', 'sadevan-a', 'ayundra', 'halvin', 'dorvi']) {
      const h = susun(id)
      expect(h.baris, id).toHaveLength(1)
      expect(lebarBaris(h.baris[0], h.rem), id).toBeLessThanOrEqual(LEBAR_DALAM * BATAS_SATU_BARIS)
    }
    expect(teksBaris(susun('ratrisa-k'))).toEqual(['Ratrisa Kemuntari'])
  })

  it('ukuran TERBESAR yang muat (contoh putaran 7b)', () => {
    expect(susun('mega')).toMatchObject({ ukuran: 'besar' })
    expect(susun('ratrisa-k')).toMatchObject({ ukuran: 'besar' })
    expect(susun('sadevan-b')).toMatchObject({ ukuran: 'besar' })
    expect(teksBaris(susun('sadevan-b'))).toEqual(['Sadevan Bramasta', 'Wiratmaja, S.T.'])
    // Bergelar: tiga baris, lebih besar dari sebelumnya (dulu kecil, dua baris).
    expect(susun('bagaskara')).toMatchObject({ ukuran: 'besar', rem: UKURAN_NAMA.besar })
    expect(teksBaris(susun('bagaskara'))).toEqual(['Alm. H. Bagaskara', 'Wiryawan Adinata', 'Mahardika, S.H.'])
    expect(teksBaris(susun('selvarani'))).toEqual(['Hj. Selvarani', 'Kusumaningtyas', 'Prameswari, S.Pd.'])
    // Tanpa gelar: paling banyak dua baris; pada ukuran besar tidak muat, jadi sedang.
    expect(susun('ratrisa-a')).toMatchObject({ ukuran: 'sedang' })
    expect(teksBaris(susun('ratrisa-a'))).toEqual(['Ratrisa Anindya', 'Maharsi Wijayakusuma'])
  })

  it('setiap ukuran yang lebih besar memang tidak muat; ukuran yang dipakai muat (semua nama, semua pilihan A–E)', () => {
    for (const p of PILIHAN_UKURAN) {
      for (const o of data.people) {
        const n = namaKartu(o)
        if (n.kata.length === 0) continue
        const h = barisNamaKartu(n, p.ukuran)
        expect(muat(h, n), `${p.huruf} ${o.id}`).toBe(true)
        // Semua tingkat yang lebih besar: tidak ada susunan yang muat.
        for (const t of TINGKAT_NAMA.slice(0, TINGKAT_NAMA.indexOf(h.ukuran))) {
          expect(cobaUkuran(n, t, p.ukuran), `${p.huruf} ${o.id} ${t}`).toBeNull()
        }
      }
    }
  })

  it('dipotong di antara kata, sepanjang mungkin seimbang; gelar menempel', () => {
    const n = namaKartu(orang('bagaskara'))
    const h = barisNamaKartu(n)
    const terlebar = Math.max(...h.baris.map((b) => lebarBaris(b, h.rem)))
    const semua = h.baris.flat()
    for (let i = 1; i < semua.length; i++) {
      for (let j = i + 1; j < semua.length; j++) {
        const lain = [semua.slice(0, i), semua.slice(i, j), semua.slice(j)]
        expect(Math.max(...lain.map((b) => lebarBaris(b, h.rem)))).toBeGreaterThanOrEqual(terlebar - 1e-9)
      }
    }
    expect(h.baris[0][0].depan).toBe('Alm. H.')
    expect(h.baris.at(-1).at(-1).belakang).toBe('S.H.')
  })

  it('tinggi kartu tetap: tiga baris yang tidak muat di tinggi kartu turun satu tingkat', () => {
    // Pilihan E: tiga baris pada ukuran besar dan sedang lebih tinggi dari tempat nama.
    const e = PILIHAN_UKURAN[4].ukuran
    expect(3 * e.besar * JARAK_BARIS.besar).toBeGreaterThan(TINGGI_NAMA)
    const h = susun('bagaskara', e)
    expect(h.baris).toHaveLength(3)
    expect(h.baris.length * h.rem * JARAK_BARIS[h.ukuran]).toBeLessThanOrEqual(TINGGI_NAMA)
  })

  it('nama tanpa gelar paling banyak dua baris, juga 6 kata; satu kata yang sangat panjang tetap satu baris', () => {
    const h = barisNamaKartu(namaKartu({ full_name: 'Satu Dua Tiga Empat Lima Enam' }))
    expect(h.baris).toHaveLength(2)
    const panjang = barisNamaKartu(namaKartu({ full_name: 'Kusumaningtyaswardhani' }))
    expect(panjang.baris).toHaveLength(1)
    expect(panjang.ukuran).not.toBe('besar')
    expect(lebarBaris(panjang.baris[0], panjang.rem)).toBeLessThanOrEqual(LEBAR_DALAM)
    // Satu kata buatan yang tidak muat pada ukuran mana pun: cadangan terkecil, tetap utuh (tanpa "…").
    const ekstrem = barisNamaKartu(namaKartu({ full_name: 'Kusumaningtyaswardhaniprameswari' }))
    expect(ekstrem).toMatchObject({ ukuran: 'terkecil' })
    expect(ekstrem.baris.flat().map((b) => b.kata)).toEqual(['Kusumaningtyaswardhaniprameswari'])
  })

  it('semua kata dan gelar tetap ada, urutannya sama; tidak ada yang melebihi lebar kartu', () => {
    for (const p of data.people) {
      const n = namaKartu(p)
      if (n.kata.length === 0) continue
      const h = barisNamaKartu(n)
      expect(h.baris.length, p.id).toBeLessThanOrEqual(bergelar(n) ? 3 : 2)
      expect(h.baris.flat().map((b) => b.kata), p.id).toEqual(n.kata)
      expect(h.baris[0][0].depan, p.id).toBe(n.depan)
      expect(h.baris.at(-1).at(-1).belakang, p.id).toBe(n.belakang)
      for (const b of h.baris) expect(lebarBaris(b, h.rem), p.id).toBeLessThanOrEqual(LEBAR_DALAM)
    }
  })

  it('ukuran lain (halaman /contoh/ukuran): nama lebih besar bisa pindah ke dua baris', () => {
    const besar = { besar: 1.2, sedang: 1.05, kecil: 0.93, terkecil: 0.82 }
    expect(susun('ratrisa-k').baris).toHaveLength(1)
    expect(susun('ratrisa-k', besar).baris).toHaveLength(2)
  })

  it('tabel lebar huruf dari file huruf yang dibundel: huruf Latin lengkap, nilainya masuk akal', () => {
    for (const tabel of [NAMA, GELAR]) {
      expect(tabel.awal).toBe(0x20)
      expect(tabel.lebar).toHaveLength(0x17f - 0x20 + 1)
      for (const h of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,éè') {
        const w = tabel.lebar[h.codePointAt(0) - 0x20]
        expect(w, h).toBeGreaterThan(150)
        expect(w, h).toBeLessThan(1100)
      }
    }
    const w = (h) => NAMA.lebar[h.codePointAt(0) - 0x20]
    expect(w('i')).toBeLessThan(w('m'))
  })
})
