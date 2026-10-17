import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { namaKartu, namaSingkat } from './nama.js'
import { bangunGraf } from './graf.js'

const data = bangunKeluargaFiktif()
const orang = (id) => data.people.find((p) => p.id === id)

// Putaran keenam tinjauan, bagian E: nama di kartu Bagan. Ukurannya sejak
// putaran 7b dari lebar nama (lib/bagan/barisNama.js), tidak dari jumlah kata.
describe('namaKartu: gelar terpisah', () => {
  it('gelar depan (Alm./Almh., gelar religius) dan belakang (gelar pendidikan) terpisah dari kata nama', () => {
    expect(namaKartu(orang('bagaskara'))).toEqual({
      depan: 'Alm. H.',
      kata: ['Bagaskara', 'Wiryawan', 'Adinata', 'Mahardika'],
      belakang: 'S.H.',
      jumlahKata: 4,
    })
    expect(namaKartu(orang('selvarani'))).toMatchObject({ depan: 'Hj.', belakang: 'S.Pd.', jumlahKata: 3 })
  })

  it('dengan atau tanpa gelar, kata nama sama', () => {
    const tanpa = { full_name: 'Sadevan Bramasta Wiratmaja' }
    const dengan = { ...tanpa, religious_title: 'KH.', academic_title: 'S.Ag., M.Pd.', is_deceased: true, sex: 'L' }
    expect(namaKartu(dengan).kata).toEqual(namaKartu(tanpa).kata)
    expect(namaKartu(dengan)).toMatchObject({ depan: 'Alm. KH.', belakang: 'S.Ag., M.Pd.' })
    expect(namaKartu({ full_name: 'Tirwan', is_deceased: true, sex: 'L' })).toMatchObject({ depan: 'Alm.', belakang: null })
  })
})

// Ukuran dan baris diatur di lib/bagan/barisNama.js menurut lebar nama.
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
