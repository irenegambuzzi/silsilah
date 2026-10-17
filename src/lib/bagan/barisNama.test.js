import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { namaKartu } from '../silsilah/nama.js'
import { BATAS_SATU_BARIS, LEBAR_DALAM, UKURAN_NAMA, barisNamaKartu, lebarBaris } from './barisNama.js'
import { GELAR, NAMA } from './lebarHuruf.js'

const data = bangunKeluargaFiktif()
const orang = (id) => data.people.find((p) => p.id === id)
const susun = (id, ukuran) => barisNamaKartu(namaKartu(orang(id)), ukuran)
const teksBaris = (h) =>
  h.baris.map((b) => b.map((x) => `${x.depan ? `${x.depan} ` : ''}${x.kata}${x.belakang ? `, ${x.belakang}` : ''}`).join(' '))

// Putaran ketujuh, bagian 5: nama di kartu, satu atau dua baris menurut lebar.
describe('barisNamaKartu', () => {
  it('satu baris kalau muat dalam 85% lebar dalam kartu', () => {
    for (const id of ['mega', 'ratrisa-k', 'sadevan-a', 'ayundra', 'halvin', 'dorvi']) {
      const h = susun(id)
      expect(h.baris, id).toHaveLength(1)
      expect(lebarBaris(h.baris[0], h.rem), id).toBeLessThanOrEqual(LEBAR_DALAM * BATAS_SATU_BARIS)
    }
    expect(teksBaris(susun('ratrisa-k'))).toEqual(['Ratrisa Kemuntari'])
  })

  it('tidak muat: dua baris, dipotong di antara kata, sepanjang mungkin seimbang; gelar menempel', () => {
    expect(teksBaris(susun('sadevan-b'))).toEqual(['Sadevan Bramasta', 'Wiratmaja, S.T.'])
    expect(teksBaris(susun('ratrisa-a'))).toEqual(['Ratrisa Anindya', 'Maharsi Wijayakusuma'])
    expect(teksBaris(susun('bagaskara'))).toEqual(['Alm. H. Bagaskara Wiryawan', 'Adinata Mahardika, S.H.'])
    // Seimbang: tidak ada potongan lain yang baris terlebarnya lebih sempit.
    const n = namaKartu(orang('bagaskara'))
    const h = barisNamaKartu(n)
    const terlebar = Math.max(...h.baris.map((b) => lebarBaris(b, h.rem)))
    const semua = [...h.baris[0], ...h.baris[1]]
    for (let k = 1; k < semua.length; k++) {
      expect(Math.max(lebarBaris(semua.slice(0, k), h.rem), lebarBaris(semua.slice(k), h.rem))).toBeGreaterThanOrEqual(terlebar)
    }
  })

  it('ukuran dasar dari jumlah kata; dua baris pun tidak muat: turun SATU tingkat untuk kartu itu saja', () => {
    expect(susun('sadevan-b')).toMatchObject({ ukuran: 'sedang', turun: false })
    expect(susun('bagaskara')).toMatchObject({ ukuran: 'kecil', turun: false })
    // Hj. Selvarani Kusumaningtyas Prameswari, S.Pd. (3 kata): sedang tidak muat → kecil.
    const selva = susun('selvarani')
    expect(selva).toMatchObject({ ukuran: 'kecil', rem: UKURAN_NAMA.kecil, turun: true })
    expect(teksBaris(selva)).toEqual(['Hj. Selvarani Kusumaningtyas', 'Prameswari, S.Pd.'])
    // Nama 3 kata lain tetap sedang.
    expect(barisNamaKartu(namaKartu({ full_name: 'Sadevan Bramasta Wiratmaja' })).ukuran).toBe('sedang')
  })

  it('paling banyak dua baris, juga untuk nama 6 kata; satu kata yang sangat panjang tetap satu baris', () => {
    const h = barisNamaKartu(namaKartu({ full_name: 'Satu Dua Tiga Empat Lima Enam' }))
    expect(h.baris).toHaveLength(2)
    const panjang = barisNamaKartu(namaKartu({ full_name: 'Kusumaningtyaswardhaniprameswari' }))
    expect(panjang.baris).toHaveLength(1)
    expect(panjang).toMatchObject({ ukuran: 'sedang', turun: true })
  })

  it('semua kata dan gelar tetap ada, urutannya sama', () => {
    for (const p of data.people) {
      const n = namaKartu(p)
      if (n.kata.length === 0) continue
      const h = barisNamaKartu(n)
      expect(h.baris.length, p.id).toBeLessThanOrEqual(2)
      expect(h.baris.flat().map((b) => b.kata), p.id).toEqual(n.kata)
      expect(h.baris[0][0].depan, p.id).toBe(n.depan)
      expect(h.baris.at(-1).at(-1).belakang, p.id).toBe(n.belakang)
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
