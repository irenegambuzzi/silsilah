import { describe, expect, it } from 'vitest'
import {
  jenisPasangan,
  keN,
  pasanganBerurutan,
  teksAnakKe,
  teksPasanganKe,
  urutkanPernikahan,
} from './urutan.js'

const u = (id, p1, p2, tahun, tambahan = {}) => ({
  id,
  partner1_id: p1,
  partner2_id: p2,
  marriage_y: tahun,
  marriage_m: null,
  marriage_d: null,
  ...tambahan,
})

describe('teks ke-n', () => {
  it('menulis ke-n', () => {
    expect(keN(3)).toBe('ke-3')
    expect(teksAnakKe(6)).toBe('Anak ke-6')
    expect(teksPasanganKe('istri', 2)).toBe('istri ke-2')
  })
})

describe('urutkanPernikahan', () => {
  it('menurut tanggal menikah, yang tidak diketahui di akhir', () => {
    const hasil = urutkanPernikahan([u('b', 'x', 'q', 1990), u('c', 'x', 'r', null), u('a', 'x', 'p', 1980)], 'x')
    expect(hasil.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('sort_order menang atas tanggal, untuk pernikahan milik partner1', () => {
    const hasil = urutkanPernikahan(
      [u('a', 'x', 'p', 1980), u('b', 'x', 'q', 1990, { sort_order: 1 }), u('c', 'x', 'r', 2000)],
      'x'
    )
    expect(hasil.map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })

  it('sort_order diabaikan kalau orang itu bukan partner1', () => {
    const hasil = urutkanPernikahan([u('a', 'p', 'x', 1980), u('b', 'q', 'x', 1990, { sort_order: 1 })], 'x')
    expect(hasil.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('sort_order yang bentrok atau di luar jangkauan tidak menghilangkan pernikahan', () => {
    const hasil = urutkanPernikahan(
      [u('a', 'x', 'p', 1980, { sort_order: 1 }), u('b', 'x', 'q', 1990, { sort_order: 1 }), u('c', 'x', 'r', 2000, { sort_order: 9 })],
      'x'
    )
    expect(hasil.map((m) => m.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('tidak mengubah daftar aslinya', () => {
    const asli = [u('b', 'x', 'q', 1990), u('a', 'x', 'p', 1980)]
    urutkanPernikahan(asli, 'x')
    expect(asli.map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('pasanganBerurutan', () => {
  it('menikah lagi dengan pasangan yang sama tidak menambah nomor', () => {
    const daftar = pasanganBerurutan(
      [u('1', 'x', 'eka', 1970), u('2', 'x', 'fitri', 1977), u('3', 'x', 'eka', 1982), u('4', 'x', 'gita', 1987)],
      'x'
    )
    expect(daftar.map((d) => d.pasanganId)).toEqual(['eka', 'fitri', 'gita'])
    expect(daftar[0].unionIds).toEqual(['1', '3'])
  })

  it('mengenali pasangan walau orangnya ada di sisi partner2', () => {
    expect(pasanganBerurutan([u('1', 'p', 'x', 1970)], 'x')[0].pasanganId).toBe('p')
  })

  it('pasangan yang tidak diketahui dihitung satu per pernikahan', () => {
    const daftar = pasanganBerurutan([u('1', 'x', null, 1970), u('2', 'x', null, 1980)], 'x')
    expect(daftar).toHaveLength(2)
  })
})

describe('jenisPasangan', () => {
  it('istri, suami, atau pasangan menurut jenis kelamin', () => {
    expect(jenisPasangan({ sex: 'P' })).toBe('istri')
    expect(jenisPasangan({ sex: 'L' })).toBe('suami')
    expect(jenisPasangan({ sex: null })).toBe('pasangan')
    expect(jenisPasangan(null)).toBe('pasangan')
  })
})
