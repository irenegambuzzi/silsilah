// Tes susunan kartu halaman uji nama asli. Semua nama di sini FIKTIF.
import { describe, expect, it } from 'vitest'
import { PILIHAN_UKURAN } from '../contoh/pilihanUkuran.js'
import { gelarTerpanjang, kartuSkenario, pisahGelar, ringkas } from './namaAsli.js'

describe('pisahGelar', () => {
  it('memisahkan gelar depan, gelar belakang, dan Alm./Almh.', () => {
    expect(pisahGelar('H. Zorvak Talindra, S.Pd.')).toMatchObject({ kata: ['Zorvak', 'Talindra'], depan: ['H.'], belakang: ['S.Pd.'], adaGelar: true })
    expect(pisahGelar('Almh. Hj. Kelvara')).toMatchObject({ kata: ['Kelvara'], depan: ['Hj.'], almarhum: true, adaGelar: true })
    expect(pisahGelar('Dr. Ir. Pirun Asvel M.M.')).toMatchObject({ kata: ['Pirun', 'Asvel'], depan: ['Dr.', 'Ir.'], belakang: ['M.M.'] })
    expect(pisahGelar('Talvo Merin')).toMatchObject({ kata: ['Talvo', 'Merin'], depan: [], belakang: [], adaGelar: false })
  })

  it('nama satu kata tidak pernah habis dimakan gelar', () => {
    expect(pisahGelar('Hj.').kata).toEqual(['Hj.'])
  })
})

const orang = Array.from({ length: 200 }, (_, i) => ({
  nama: i === 5 ? 'K.H. Zorvak Talindra, Lc.' : `Zorvak${i} Talindra Merunisa`,
  sex: i % 3 === 0 ? 'L' : i % 3 === 1 ? 'P' : null,
  wafat: i % 10 === 0,
  peran: i % 4 === 0 ? 'pasangan' : 'keturunan',
}))

describe('kartuSkenario', () => {
  it('tanpa gelar: tidak ada gelar sama sekali, juga tidak Alm.', () => {
    const k = kartuSkenario(orang, 'tanpa')
    expect(k.every((x) => !x.namaKartu.depan && !x.namaKartu.belakang)).toBe(true)
    expect(k[5].namaKartu.kata).toEqual(['Zorvak', 'Talindra'])
  })

  it('gelar perkiraan: sekitar 30%, benih tetap, gelar asli dipakai, Hj. hanya perempuan, Alm./Almh. untuk yang wafat', () => {
    const a = kartuSkenario(orang, 'perkiraan')
    expect(kartuSkenario(orang, 'perkiraan')).toEqual(a)
    expect(a[5]).toMatchObject({ gelarAsli: true, namaKartu: { depan: 'K.H.', belakang: 'Lc.' } })
    const bergelar = a.filter((x, i) => !orang[i].wafat && (x.namaKartu.depan || x.namaKartu.belakang)).length
    const hidup = orang.filter((o) => !o.wafat).length
    expect(bergelar / hidup).toBeGreaterThan(0.2)
    expect(bergelar / hidup).toBeLessThan(0.4)
    a.forEach((x, i) => {
      const d = x.namaKartu.depan ?? ''
      if (orang[i].sex !== 'P') expect(d).not.toMatch(/Hj\./)
      if (orang[i].sex === 'P') expect(d).not.toMatch(/(^| )(H\.|K\.H\.)/)
      if (orang[i].wafat) expect(d).toMatch(orang[i].sex === 'P' ? /^Almh\./ : /^Alm\./)
      const jumlah = (d.match(/\S+/g) ?? []).filter((g) => !/^Alm/.test(g)).length + (x.namaKartu.belakang?.split(', ').length ?? 0)
      if (!x.gelarAsli) expect(jumlah).toBeLessThanOrEqual(3)
    })
  })

  it('gelar terpanjang: semua orang diberi gabungan 1–3 gelar terlebar untuk jenis kelaminnya', () => {
    const k = kartuSkenario(orang, 'terpanjang')
    const g = gelarTerpanjang('L')
    expect(g.depan.length + g.belakang.length).toBe(3)
    expect(k[3].namaKartu).toMatchObject({ depan: [...g.depan].join(' ') || null })
    expect(gelarTerpanjang('P').depan).not.toContain('H.')
  })
})

describe('ringkas', () => {
  it('menurut aturan Bagan: tidak pernah terpotong; melebihi lebar hanya kalau tidak muat di tingkat mana pun (cadangan)', () => {
    for (const s of ['tanpa', 'perkiraan', 'terpanjang']) {
      const kartu = kartuSkenario(orang, s)
      for (const p of PILIHAN_UKURAN) {
        const h = ringkas(kartu, p.ukuran)
        expect(h.jumlah).toBe(200)
        expect(h.baris[1] + h.baris[2] + h.baris[3]).toBe(200)
        expect(Object.values(h.tingkat).reduce((a, b) => a + b, 0)).toBe(200)
        expect(h.terpotong).toBe(0)
        expect(h.melebihiLebar).toBeLessThanOrEqual(h.cadangan)
        if (p.huruf !== 'E') expect(h.melebihiLebar).toBe(0)
      }
    }
  })

  it('nama fiktif tiga kata dengan gelar terpanjang di pilihan E memakai cadangan dan melebihi lebar', () => {
    const h = ringkas(kartuSkenario(orang, 'terpanjang'), PILIHAN_UKURAN[4].ukuran)
    expect(h.cadangan).toBeGreaterThan(0)
    expect(h.melebihiLebar).toBeGreaterThan(0)
  })
})
