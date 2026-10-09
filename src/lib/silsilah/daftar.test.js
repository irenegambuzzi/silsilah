import { describe, expect, it } from 'vitest'
import { bandingkanNomor, cariDaftar, susunDaftar } from './daftar.js'
import { labelDetail } from './kartu.js'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const daftar = susunDaftar(s)
const nama = (b) => b.nama

describe('bandingkanNomor', () => {
  it('mengurutkan menurut angka, bukan huruf', () => {
    const urut = ['1.10', '1.2', '1', '1.2.1', '1.9'].sort(bandingkanNomor)
    expect(urut).toEqual(['1', '1.2', '1.2.1', '1.9', '1.10'])
  })
})

describe('susunDaftar', () => {
  it('keturunan menurut nomor silsilah: pangkal dulu, lalu cabang demi cabang', () => {
    const urut = daftar.keturunan.map(nama)
    expect(urut.slice(0, 2).sort()).toEqual(['Alm. Raksa', 'Almh. Selara'])
    const bima = urut.indexOf('Bima')
    expect(urut.slice(bima + 1, bima + 12)).toContain('Tamran')
    // putra ke-1 Bima (Tamran) sebelum anak ke-2 pangkal (Cahya)
    expect(urut.indexOf('Tamran')).toBeLessThan(urut.indexOf('Cahya'))
  })

  it('pasangan yang bukan keturunan ada di bagian terpisah, menurut nama', () => {
    const pasangan = daftar.pasangan.map(nama)
    expect(pasangan).toEqual(expect.arrayContaining(['Eka', 'Fitri', 'Gita', 'Umar', 'Sinta', 'Laila']))
    expect(pasangan).toEqual([...pasangan].sort((a, b) => a.localeCompare(b, 'id')))
    expect(daftar.keturunan.map(nama)).not.toContain('Eka')
  })

  it('orang di pohon keluarga asal tidak ikut', () => {
    const semua = [...daftar.keturunan, ...daftar.pasangan].map(nama)
    expect(semua).not.toContain('Karto')
    expect(semua).not.toContain('Asing')
  })

  it('setiap baris membawa GEN, istilah Jawa, tahun, dan keterangan kartu', () => {
    const tamran = daftar.keturunan.find((b) => b.nama === 'Tamran')
    expect(tamran).toMatchObject({ labelGen: 'GEN.2', istilahGen: 'Putu', tahun: '1971' })
    expect(tamran.keterangan).toBe('Putra ke-1 · dari istri ke-1')
    expect(JSON.stringify(daftar)).not.toMatch(/Anak ke-/)
  })
})

describe('cariDaftar', () => {
  it('tanpa kata kunci mengembalikan semuanya', () => {
    expect(cariDaftar(daftar, '  ')).toBe(daftar)
  })
  it('tidak membedakan huruf besar/kecil dan memotong spasi', () => {
    const hasil = cariDaftar(daftar, '  TAMRAN ')
    expect(hasil.keturunan.map(nama)).toEqual(['Tamran'])
  })
  it('bisa mencari pasangan', () => {
    expect(cariDaftar(daftar, 'umar').pasangan.map(nama)).toEqual(['Umar'])
  })
  it('kata yang tidak ada → kosong', () => {
    expect(cariDaftar(daftar, 'zzzz')).toEqual({ keturunan: [], pasangan: [] })
  })
})

describe('labelDetail: orang tua', () => {
  const nama = (d) => d.orangTua.map((o) => o.orang.map((x) => x.nama).join(' & '))
  it('kedua orang tua dalam satu baris, juga yang bukan keturunan', () => {
    expect(nama(labelDetail(s, 'tamran'))).toEqual(['Bima & Eka'])
  })
  it('anak sambung: orang tua satu baris, keterangan lembut menyebut orang tua sambungnya', () => {
    expect(labelDetail(s, 'vino').orangTua).toEqual([
      { unionId: 'u5', orang: [{ id: 'cahya', nama: 'Cahya' }, { id: 'umar', nama: 'Umar' }] },
    ])
    expect(labelDetail(s, 'vino').urutan).toEqual(['Anak sambung Cahya'])
  })
  it('pernikahan antarsepupu: kedua orang tua dalam satu baris', () => {
    expect(nama(labelDetail(s, 'nirvo'))).toEqual(['Tamran & Wati'])
    expect(nama(labelDetail(s, 'hasna'))).toEqual(['Rangga & Gendis'])
  })
})
