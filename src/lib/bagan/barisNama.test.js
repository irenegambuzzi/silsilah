import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { namaKartu } from '../silsilah/nama.js'
import {
  BATAS_SATU_BARIS, JARAK_BARIS, LEBAR_DALAM, SKALA_GELAR, TINGGI_NAMA, TINGKAT_NAMA, UKURAN_NAMA,
  bagianNama, barisNamaKartu, cobaUkuran, cobaUkuranDarurat, lebarBaris,
} from './barisNama.js'
import { GELAR, NAMA } from './lebarHuruf.js'
import { PILIHAN_UKURAN } from '../../contoh/pilihanUkuran.js'

const data = bangunKeluargaFiktif()
const orang = (id) => data.people.find((p) => p.id === id)
const susun = (id, ukuran) => barisNamaKartu(namaKartu(orang(id)), ukuran)
const teksBaris = (h) =>
  h.baris.map((b) =>
    b.map((x) => x.gelar ?? `${x.depan ? `${x.depan} ` : ''}${x.kata}${x.belakang ? `, ${x.belakang}` : ''}${x.koma ? ',' : ''}`).join(' ')
  )
const bergelar = (n) => Boolean(n.depan || n.belakang)
// Gelar belakang seperti tertulis di data, dari susunan (menempel atau pindah baris).
const gelarBelakang = (h) => {
  const isi = h.baris.flat()
  const pindah = isi.filter((b) => b.gelar).map((b) => b.gelar.replace(/,$/, ''))
  return pindah.length ? pindah.join(', ') : (isi.at(-1).belakang ?? null)
}
// Susunan memenuhi semua batas pada ukuran `rem` / tingkat `ukuran`.
const muat = (h, n) =>
  h.baris.length <= (bergelar(n) ? 3 : 2) &&
  h.baris.every((b) => lebarBaris(b, h.rem, h.skalaGelar) <= LEBAR_DALAM) &&
  (h.baris.length > 1 || n.kata.length === 1 || lebarBaris(h.baris[0], h.rem, h.skalaGelar) <= LEBAR_DALAM * BATAS_SATU_BARIS) &&
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
        // Semua tingkat yang lebih besar: tidak ada susunan yang muat
        // (aturan biasa; dan untuk nama yang tidak muat, juga langkah 1–2).
        const biasa = h.skalaGelar === SKALA_GELAR && !h.gelarPindah && !h.dihitung
        for (const t of TINGKAT_NAMA.slice(0, TINGKAT_NAMA.indexOf(h.ukuran))) {
          expect(cobaUkuran(n, t, p.ukuran), `${p.huruf} ${o.id} ${t}`).toBeNull()
          if (!biasa) expect(cobaUkuranDarurat(n, t, p.ukuran), `${p.huruf} ${o.id} ${t}`).toBeNull()
        }
        if (!biasa) for (const t of TINGKAT_NAMA) expect(cobaUkuran(n, t, p.ukuran), `${p.huruf} ${o.id} ${t}`).toBeNull()
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
    // Satu kata buatan yang tidak muat pada ukuran mana pun: ukuran hitungan
    // (putaran 7c-2), tetap utuh (tanpa "…") dan tidak melebihi lebar kartu.
    const ekstrem = barisNamaKartu(namaKartu({ full_name: 'Kusumaningtyaswardhaniprameswari' }))
    expect(ekstrem).toMatchObject({ ukuran: 'terkecil', dihitung: true })
    expect(ekstrem.rem).toBeLessThan(UKURAN_NAMA.terkecil)
    expect(lebarBaris(ekstrem.baris[0], ekstrem.rem)).toBeLessThanOrEqual(LEBAR_DALAM)
    expect(ekstrem.baris.flat().map((b) => b.kata)).toEqual(['Kusumaningtyaswardhaniprameswari'])
  })

  it('semua kata dan gelar tetap ada, urutannya sama; tidak ada yang melebihi lebar kartu', () => {
    for (const p of data.people) {
      const n = namaKartu(p)
      if (n.kata.length === 0) continue
      const h = barisNamaKartu(n)
      expect(h.baris.length, p.id).toBeLessThanOrEqual(bergelar(n) ? 3 : 2)
      expect(h.baris.flat().filter((b) => !b.gelar).map((b) => b.kata), p.id).toEqual(n.kata)
      expect(h.baris[0][0].depan, p.id).toBe(n.depan)
      expect(gelarBelakang(h), p.id).toBe(n.belakang)
      for (const b of h.baris) expect(lebarBaris(b, h.rem, h.skalaGelar), p.id).toBeLessThanOrEqual(LEBAR_DALAM)
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

// ── Aturan tetap putaran 7c-2: nama TIDAK PERNAH melebihi lebar kartu ──

// Aturan SEBELUM putaran 7c-2 (salinan apa adanya), untuk membuktikan bahwa
// nama yang sudah muat tidak berubah.
const LAMA = (() => {
  function* potong(bagian, n) {
    if (n === 1) { yield [bagian]; return }
    for (let k = 1; k <= bagian.length - n + 1; k++) for (const sisa of potong(bagian.slice(k), n - 1)) yield [bagian.slice(0, k), ...sisa]
  }
  const seimbang = (bagian, n, rem) => {
    let t = null
    for (const baris of potong(bagian, n)) {
      const lebar = baris.map((b) => lebarBaris(b, rem))
      const terlebar = Math.max(...lebar)
      if (!t || terlebar < t.terlebar - 1e-9 || (Math.abs(terlebar - t.terlebar) <= 1e-9 && lebar[0] > t.lebar[0] + 1e-9)) t = { baris, lebar, terlebar }
    }
    return t
  }
  const susun = (bagian, rem, batas) => {
    const satu = lebarBaris(bagian, rem)
    if (satu <= LEBAR_DALAM * BATAS_SATU_BARIS || (bagian.length === 1 && satu <= LEBAR_DALAM)) return { baris: [bagian] }
    for (let n = 2; n <= Math.min(batas, bagian.length); n++) {
      const s = seimbang(bagian, n, rem)
      if (s.terlebar <= LEBAR_DALAM) return s
    }
    return null
  }
  return (n, ukuranNama = UKURAN_NAMA) => {
    for (const ukuran of TINGKAT_NAMA) {
      const rem = ukuranNama[ukuran]
      const s = susun(bagianNama(n), rem, bergelar(n) ? 3 : 2)
      if (s && s.baris.length * rem * JARAK_BARIS[ukuran] <= TINGGI_NAMA + 1e-9) return { baris: s.baris, ukuran, rem }
    }
    return null // dulu: cadangan yang bisa melebihi lebar
  }
})()

// Nama FIKTIF buatan: kata pendek sampai sangat panjang, dengan dan tanpa gelar.
const KATA = ['Ayu', 'Bima', 'Larasati', 'Wiryawan', 'Kusumaningtyas', 'Purbanegara', 'Sastrawikencana', 'Adiwangsa', 'Wijayakusuma', 'Mahardika']
const DEPAN = [null, 'H.', 'Hj.', 'Dr.', 'Alm. H.', 'Prof. Dr. Ir. K.H.', 'Almh. Prof. Dr. Hj.']
const BELAKANG = [null, 'S.T.', 'S.Pd.', 'S.Kom., M.Pd.', 'S.Kom., M.Pd., S.Ag.']
const namaBuatan = () => {
  const hasil = []
  let i = 0
  for (let jumlah = 1; jumlah <= 5; jumlah++) {
    for (let mulai = 0; mulai < KATA.length; mulai += 2) {
      const kata = Array.from({ length: jumlah }, (_, j) => KATA[(mulai + j * 3) % KATA.length])
      for (const depan of DEPAN) for (const belakang of BELAKANG) hasil.push({ depan, kata, belakang, jumlahKata: jumlah, i: i++ })
    }
  }
  return hasil
}

describe('aturan tetap: nama tidak pernah melebihi lebar kartu (putaran 7c-2)', () => {
  const semua = [...data.people.map((o) => namaKartu(o)).filter((n) => n.kata.length > 0), ...namaBuatan()]

  it('nama yang sudah muat (dengan aturan lama) tidak berubah sama sekali, juga semua nama tanpa gelar yang muat; semua pilihan A–E', () => {
    let dibandingkan = 0
    for (const p of PILIHAN_UKURAN) {
      for (const n of semua) {
        const lama = LAMA(n, p.ukuran)
        if (!lama) continue
        dibandingkan++
        const baru = barisNamaKartu(n, p.ukuran)
        expect({ baris: baru.baris, ukuran: baru.ukuran, rem: baru.rem }).toEqual(lama)
        expect(baru).toMatchObject({ skalaGelar: SKALA_GELAR, gelarPindah: false, dihitung: false })
      }
    }
    expect(dibandingkan).toBeGreaterThan(3000)
  })

  it('tidak ada nama yang melebihi lebar, tinggi, atau batas baris, dan tidak ada yang hilang ("…"); semua pilihan A–E', () => {
    for (const p of PILIHAN_UKURAN) {
      for (const n of semua) {
        const h = barisNamaKartu(n, p.ukuran)
        const id = `${p.huruf} ${n.kata.join(' ')} ${n.depan} ${n.belakang}`
        expect(muat(h, n), id).toBe(true)
        expect(h.baris.flat().filter((b) => !b.gelar).map((b) => b.kata), id).toEqual(n.kata)
        expect(gelarBelakang(h), id).toBe(n.belakang)
      }
    }
  })

  it('nama terpanjang + gelar terpanjang ("Prof. Dr. Ir. K.H." dan "S.Kom., M.Pd., S.Ag."): 0 melebihi lebar, 0 "…", di A–E', () => {
    const terpanjang = namaKartu(orang('wirabhumi'))
    expect(terpanjang).toMatchObject({ depan: 'Prof. Dr. Ir. K.H.', belakang: 'S.Kom., M.Pd., S.Ag.' })
    for (const n of [terpanjang, namaKartu({ ...orang('wirabhumi'), is_deceased: true })]) {
      for (const p of PILIHAN_UKURAN) {
        const h = barisNamaKartu(n, p.ukuran)
        expect(muat(h, n), p.huruf).toBe(true)
        expect(teksBaris(h).join(' '), p.huruf).toBe(`${n.depan} ${n.kata.join(' ')}, ${n.belakang}`)
        expect(teksBaris(h).join(' ')).not.toContain('…')
      }
    }
  })

  it('urutan: gelar dikecilkan dulu (nama tetap sebesar mungkin), lalu gelar pindah baris, baru ukuran nama turun', () => {
    for (const p of PILIHAN_UKURAN) {
      for (const n of semua) {
        const h = barisNamaKartu(n, p.ukuran)
        if (h.dihitung || (h.skalaGelar === SKALA_GELAR && !h.gelarPindah)) continue
        // Tingkat yang dipakai adalah tingkat terbesar tempat langkah 1–2 berhasil.
        expect(cobaUkuranDarurat(n, h.ukuran, p.ukuran)).toEqual(h)
        // Gelar pindah baris hanya kalau mengecilkan gelar saja tidak cukup di tingkat itu.
        if (h.gelarPindah) expect(h.baris.some((b) => b[0].gelar)).toBe(true)
      }
    }
    // Orang fiktif terpanjang di data contoh: A dan B muat dengan aturan biasa
    // (tidak berubah), C dengan gelar dikecilkan, D dan E ukuran hitungan.
    const n = namaKartu(orang('wirabhumi'))
    const per = Object.fromEntries(PILIHAN_UKURAN.map((p) => [p.huruf, barisNamaKartu(n, p.ukuran)]))
    expect(per.A).toMatchObject({ skalaGelar: SKALA_GELAR, gelarPindah: false, dihitung: false })
    expect(per.B).toMatchObject({ skalaGelar: SKALA_GELAR, gelarPindah: false, dihitung: false })
    expect(per.C).toMatchObject({ skalaGelar: 0.7, dihitung: false })
    expect(per.D).toMatchObject({ dihitung: true })
    expect(per.E).toMatchObject({ dihitung: true })
  })

  it('gelar pindah baris: setiap gelar utuh ("S.Kom.," tidak dipecah), dipotong di antara gelar, paling banyak 3 baris', () => {
    let ada = 0
    for (const p of PILIHAN_UKURAN) {
      for (const n of semua) {
        const h = barisNamaKartu(n, p.ukuran)
        if (!h.gelarPindah) continue
        ada++
        const gelar = h.baris.flat().filter((b) => b.gelar).map((b) => b.gelar)
        const asli = n.belakang.split(', ')
        expect(gelar).toEqual(asli.map((g, i) => (i < asli.length - 1 ? `${g},` : g)))
        expect(h.baris.length).toBeLessThanOrEqual(3)
      }
    }
    expect(ada).toBeGreaterThan(0)
  })

  it('ukuran hitungan hanya kalau semua langkah lain gagal; potongan tetap seimbang', () => {
    for (const p of PILIHAN_UKURAN) {
      for (const n of semua) {
        const h = barisNamaKartu(n, p.ukuran)
        if (!h.dihitung) continue
        for (const t of TINGKAT_NAMA) {
          expect(cobaUkuran(n, t, p.ukuran)).toBeNull()
          expect(cobaUkuranDarurat(n, t, p.ukuran)).toBeNull()
        }
        expect(h.rem).toBeLessThan(p.ukuran.terkecil)
        expect(h.rem).toBeGreaterThan(0)
      }
    }
  })
})
