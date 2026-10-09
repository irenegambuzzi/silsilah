import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { bangunGraf } from './graf.js'
import { anakOrangTua, kandungUntuk, orangTuaSambungPasangan, pastiSesudah, urutkanMenurutUmur } from './anak.js'

const graf = bangunGraf(bangunKeluargaFiktif())

describe('anak kandung', () => {
  const u = { partner1_id: 'a', partner2_id: 'b' }
  it('kandung keduanya; anak sambung hanya bagi orang tua darahnya; anak angkat tidak pernah', () => {
    expect(kandungUntuk({ biological_parent: 'keduanya' }, u, 'a')).toBe(true)
    expect(kandungUntuk({ biological_parent: 'keduanya' }, u, 'x')).toBe(false)
    expect(kandungUntuk({ biological_parent: 'partner2' }, u, 'a')).toBe(false)
    expect(kandungUntuk({ biological_parent: 'partner2' }, u, 'b')).toBe(true)
    expect(kandungUntuk({ biological_parent: 'partner1' }, u, 'a')).toBe(true)
    expect(kandungUntuk({ biological_parent: null }, u, 'a')).toBe(false)
  })

  it('nomor hanya untuk anak kandung, lintas pernikahan', () => {
    const bima = anakOrangTua(graf, 'bima')
    expect(bima.kandung).toHaveLength(11)
    expect(bima.ke.get('rangga')).toBe(11)
    const cahya = anakOrangTua(graf, 'cahya')
    expect(cahya.kandung).toEqual(['wati'])
    expect(cahya.ke.has('vino')).toBe(false)
  })
})

describe('menurut umur', () => {
  it('pastiSesudah membandingkan hanya bagian yang diketahui', () => {
    expect(pastiSesudah({ y: 1980 }, { y: 1979 })).toBe(true)
    expect(pastiSesudah({ y: 1980, m: 3 }, { y: 1980 })).toBe(false)
    expect(pastiSesudah({ y: 1980, m: 3 }, { y: 1980, m: 2 })).toBe(true)
    expect(pastiSesudah({ y: null }, { y: 1980 })).toBe(false)
  })

  it('anak sambung/angkat disisipkan menurut tanggal lahir; tanpa tanggal di paling akhir; urutan anak kandung tetap', () => {
    const g = {
      orang: new Map([
        ['k1', { birth_y: 1970 }], ['k2', { birth_y: null }], ['k3', { birth_y: 1980 }],
        ['tua', { birth_y: 1965 }], ['tengah', { birth_y: 1975 }], ['muda', { birth_y: 1990 }], ['tanpa', { birth_y: null }],
      ]),
    }
    expect(urutkanMenurutUmur(g, ['k1', 'k2', 'k3'], ['muda', 'tanpa', 'tengah', 'tua'])).toEqual([
      'tua', 'k1', 'k2', 'tengah', 'k3', 'muda', 'tanpa',
    ])
  })

  it('di keluarga contoh: Vino (anak sambung, lebih tua) sebelum Wati', () => {
    expect(anakOrangTua(graf, 'cahya').semua.map((a) => [a.id, a.kandung])).toEqual([['vino', false], ['wati', true]])
  })
})

describe('anak sambung dari sisi pasangan', () => {
  const sambung = (g, id) => anakOrangTua(g, id).panel.filter((a) => a.sambung).map((a) => a.id)
  const ubah = (fn) => {
    const d = bangunKeluargaFiktif()
    fn(d)
    return bangunGraf(d)
  }

  it('`semua` (dipakai nomor silsilah) tidak memuatnya, `panel` memuatnya menurut umur', () => {
    expect(anakOrangTua(graf, 'harvel').semua.map((a) => a.id)).toEqual(['galen', 'elvina', 'fajrin'])
    expect(anakOrangTua(graf, 'harvel').panel.map((a) => [a.id, a.kandung])).toEqual([
      ['celvia', false], ['galen', true], ['elvina', true], ['fajrin', true],
    ])
    expect(anakOrangTua(graf, 'harvel').kandung).toEqual(['galen', 'elvina', 'fajrin'])
  })

  it('anak yang lahir sesudah pernikahan berakhir bukan anak sambung; tanggal tidak diketahui tidak mengeluarkan siapa pun', () => {
    // Halvin wafat 2008; Bayu lahir 2013. Tanpa tanggal wafat Halvin, Bayu tidak bisa dikeluarkan.
    expect(sambung(graf, 'halvin')).toEqual([])
    const g = ubah((d) => Object.assign(d.people.find((p) => p.id === 'halvin'), { death_y: null }))
    expect(sambung(g, 'halvin')).toEqual(['bayu'])
    // Fajrin (2010) lahir sesudah Kirana berpisah dari Danuarta (2004); tanpa tanggal berpisah ia tidak bisa dikeluarkan.
    expect(sambung(graf, 'danuarta')).toEqual([])
    expect(sambung(ubah((d) => Object.assign(d.unions.find((u) => u.id === 'u14'), { end_y: null })), 'danuarta')).toEqual(['fajrin'])
  })

  it('anak yang wafat sebelum pernikahan dimulai bukan anak sambung (Sekar, wafat 1998; Joval menikah 2012)', () => {
    expect(sambung(graf, 'joval')).toEqual(['dorvi', 'laras'])
    expect(sambung(ubah((d) => Object.assign(d.unions.find((u) => u.id === 'u11'), { marriage_y: null })), 'joval')).toEqual(['dorvi', 'sekar', 'laras'])
  })

  it('pernikahan yang sama dengan anak sendiri atau anak angkat tidak membuat anak sambung', () => {
    for (const id of ['lorvan', 'sinta', 'bima', 'eka', 'umar']) {
      const sendiri = new Set(anakOrangTua(graf, id).semua.map((a) => a.id))
      for (const a of anakOrangTua(graf, id).panel) if (a.sambung) expect(sendiri.has(a.id), `${id}>${a.id}`).toBe(false)
    }
    expect(sambung(graf, 'sinta')).toEqual([])
  })

  it('orang tua sambung: kebalikannya, berurutan menurut pernikahan pertama dengan orang tua kandung', () => {
    expect(orangTuaSambungPasangan(graf).get('tamran').map((x) => x.id)).toEqual(['fitri', 'gita'])
    expect(orangTuaSambungPasangan(graf).get('celvia').map((x) => [x.id, x.unionId])).toEqual([['harvel', 'u14']])
    expect(orangTuaSambungPasangan(graf).has('wati')).toBe(false)
  })
})
