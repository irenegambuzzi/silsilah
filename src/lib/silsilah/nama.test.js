import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { namaKartu, namaSingkat, ukuranNamaKartu } from './nama.js'
import { bangunGraf } from './graf.js'

const data = bangunKeluargaFiktif()
const orang = (id) => data.people.find((p) => p.id === id)

// Putaran keenam tinjauan, bagian E: nama di kartu Bagan.
describe('namaKartu: aturan 1, ukuran hanya dari jumlah kata', () => {
  it('1–2 kata besar, 3 kata sedang, 4 kata atau lebih kecil', () => {
    expect([1, 2, 3, 4, 5, 6].map(ukuranNamaKartu)).toEqual(['besar', 'besar', 'sedang', 'kecil', 'kecil', 'kecil'])
  })

  it('Ratrisa Kemuntari, Sadevan Arkanata, Ayundra Pramesti sama; Sadevan Bramasta Wiratmaja lebih besar dari Bagaskara …', () => {
    expect(['ratrisa-k', 'sadevan-a', 'ayundra'].map((id) => namaKartu(orang(id)).ukuran)).toEqual(['besar', 'besar', 'besar'])
    expect(namaKartu(orang('sadevan-b')).ukuran).toBe('sedang')
    expect(namaKartu(orang('bagaskara')).ukuran).toBe('kecil')
  })

  it('panjang huruf tidak berpengaruh: nama 2 kata yang sangat panjang tetap besar', () => {
    expect(namaKartu({ full_name: 'Kusumaningtyaswardhani Prameswarikusumawati' }).ukuran).toBe('besar')
    expect(namaKartu({ full_name: 'Satu Dua Tiga Empat' }).ukuran).toBe('kecil')
  })
})

describe('namaKartu: aturan 2, gelar tidak dihitung', () => {
  it('gelar depan (Alm./Almh., gelar religius) dan belakang (gelar pendidikan) terpisah dari kata nama', () => {
    expect(namaKartu(orang('bagaskara'))).toEqual({
      depan: 'Alm. H.',
      kata: ['Bagaskara', 'Wiryawan', 'Adinata', 'Mahardika'],
      belakang: 'S.H.',
      jumlahKata: 4,
      ukuran: 'kecil',
    })
    expect(namaKartu(orang('selvarani'))).toMatchObject({ depan: 'Hj.', belakang: 'S.Pd.', jumlahKata: 3, ukuran: 'sedang' })
  })

  it('dengan atau tanpa gelar, ukuran sama', () => {
    const tanpa = { full_name: 'Sadevan Bramasta Wiratmaja' }
    const dengan = { ...tanpa, religious_title: 'KH.', academic_title: 'S.Ag., M.Pd.', is_deceased: true, sex: 'L' }
    expect(namaKartu(dengan).ukuran).toBe(namaKartu(tanpa).ukuran)
    expect(namaKartu(dengan).depan).toBe('Alm. KH.')
    expect(namaKartu({ full_name: 'Tirwan', is_deceased: true, sex: 'L' })).toMatchObject({ depan: 'Alm.', ukuran: 'besar' })
  })
})

// Baris (satu atau dua) diatur di lib/bagan/barisNama.js menurut lebar nama.
describe('namaKartu: kata nama', () => {
  it('semua kata tetap ada (tidak ada yang terbuang)', () => {
    for (const p of data.people) {
      expect(namaKartu(p).kata.join(' '), p.id).toBe(p.full_name.trim().split(/\s+/).join(' '))
    }
  })
})

// Putaran ketujuh: nama singkat di tautan dan keterangan.
describe('namaSingkat', () => {
  const graf = bangunGraf(data)
  it('nama depan tanpa gelar dan tanpa Alm./Almh.', () => {
    expect(['dorvi', 'halvin', 'selvarani', 'tirwan', 'yoga'].map((id) => namaSingkat(graf, id))).toEqual([
      'Dorvi', 'Halvin', 'Selvarani', 'Tirwan', 'Yoga',
    ])
  })
  it('nama depan yang dipakai lebih dari satu orang: dua kata', () => {
    expect(['ratrisa-k', 'ratrisa-a', 'sadevan-b', 'sadevan-a'].map((id) => namaSingkat(graf, id))).toEqual([
      'Ratrisa Kemuntari', 'Ratrisa Anindya', 'Sadevan Bramasta', 'Sadevan Arkanata',
    ])
  })
})
