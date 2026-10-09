import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { bangunGraf } from './graf.js'
import { anakOrangTua, kandungUntuk, pastiSesudah, urutkanMenurutUmur } from './anak.js'

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
