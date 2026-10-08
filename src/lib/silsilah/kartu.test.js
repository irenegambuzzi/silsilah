import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { labelDetail, labelKartu } from './kartu.js'
import { awalanAlmarhum, namaTampil } from './nama.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const ket = (id) => labelKartu(s, id).keterangan

describe('Alm./Almh.', () => {
  it('ditambahkan otomatis di depan nama orang yang sudah wafat', () => {
    expect(namaTampil({ full_name: 'Raksa', sex: 'L', is_deceased: true })).toBe('Alm. Raksa')
    expect(namaTampil({ full_name: 'Selara', sex: 'P', is_deceased: true })).toBe('Almh. Selara')
    expect(namaTampil({ full_name: 'Bima', sex: 'L', is_deceased: false })).toBe('Bima')
  })
  it('jenis kelamin belum diketahui: Alm./Almh.', () => {
    expect(awalanAlmarhum({ sex: null, is_deceased: true })).toBe('Alm./Almh.')
  })
  it('gelar religius di depan, gelar pendidikan di belakang', () => {
    const o = { full_name: 'Contoh', sex: 'L', is_deceased: true, religious_title: 'KH.', academic_title: 'S.Ag.' }
    expect(namaTampil(o)).toBe('Alm. KH. Contoh, S.Ag.')
    expect(namaTampil(o, { gelar: false })).toBe('Alm. Contoh')
  })
})

describe('kartu keturunan', () => {
  it('pasangan pangkal: GEN.0 Pangkal, tahun lahir–wafat, tanpa keterangan', () => {
    expect(labelKartu(s, 'raksa')).toMatchObject({
      nama: 'Alm. Raksa',
      tahun: '1920–1990',
      jenis: 'pangkal',
      gen: 0,
      labelGen: 'GEN.0',
      istilahGen: 'Pangkal',
      keterangan: '',
    })
    expect(labelKartu(s, 'selara').nama).toBe('Almh. Selara')
  })

  it('anak: GEN, istilah Jawa, dan keterangan', () => {
    expect(labelKartu(s, 'tamran')).toMatchObject({
      nama: 'Tamran',
      tahun: '1971',
      gen: 2,
      labelGen: 'GEN.2',
      istilahGen: 'Putu',
      keterangan: 'Anak ke-1 · dari istri ke-1',
    })
  })

  it('pernikahan berulang: 11 anak dari 3 istri, kembali ke istri ke-1', () => {
    const anak = ['tamran', 'ika', 'tirwan', 'kirana', 'lintang', 'mega', 'nanda', 'oka', 'putri', 'qori', 'rangga']
    expect(anak.map(ket)).toEqual([
      'Anak ke-1 · dari istri ke-1',
      'Anak ke-2 · dari istri ke-1',
      'Anak ke-3 · dari istri ke-1',
      'Anak ke-4 · dari istri ke-2',
      'Anak ke-5 · dari istri ke-2',
      'Anak ke-6 · dari istri ke-1',
      'Anak ke-7 · dari istri ke-1',
      'Anak ke-8 · dari istri ke-3',
      'Anak ke-9 · dari istri ke-3',
      'Anak ke-10 · dari istri ke-3',
      'Anak ke-11 · dari istri ke-3',
    ])
  })

  it('bagian "dari istri ke-n" tidak muncul kalau orang tua hanya punya satu pasangan', () => {
    expect(ket('wati')).toBe('Anak ke-2')
    expect(ket('kelvan')).toBe('Anak ke-1')
    expect(ket('gendis')).toBe('Anak ke-1')
  })

  it('anak sambung dan anak angkat: kartu sama persis, tanpa kata "sambung"/"angkat"', () => {
    expect(ket('vino')).toBe('Anak ke-1')
    expect(ket('yoga')).toBe('Anak ke-2')
    for (const id of ['vino', 'yoga']) {
      expect(JSON.stringify(labelKartu(s, id)).toLowerCase()).not.toMatch(/sambung|angkat/)
    }
    // Bentuknya sama dengan saudara kandung.
    const { id: _a, nama: _b, panggilan: _c, tahun: _d, keterangan: _e, sex: _k, ...vino } = labelKartu(s, 'vino')
    const { id: _f, nama: _g, panggilan: _h, tahun: _i, keterangan: _j, sex: _l, ...wati } = labelKartu(s, 'wati')
    expect(vino).toEqual(wati)
  })

  it('pernikahan antarsepupu: GEN dan "Anak ke-n" mengikuti jalur terdekat', () => {
    expect(labelKartu(s, 'hasna')).toMatchObject({
      gen: 3,
      labelGen: 'GEN.3',
      istilahGen: 'Buyut',
      keterangan: 'Anak ke-1',
    })
  })

  it('nama panggilan ikut', () => {
    const d = bangunKeluargaFiktif()
    d.people.find((p) => p.id === 'bima').nickname = 'Mas Bim'
    expect(labelKartu(susunSilsilah(d), 'bima').panggilan).toBe('Mas Bim')
  })

  it('orang yang tidak ada → null', () => {
    expect(labelKartu(s, 'tidak-ada')).toBeNull()
    expect(labelDetail(s, 'tidak-ada')).toBeNull()
  })

  it('istilah generasi bisa diganti dari pengaturan', () => {
    const t = susunSilsilah(bangunKeluargaFiktif(), { daftarGenerasi: ['Akar', 'Cabang'] })
    expect(labelKartu(t, 'bima').istilahGen).toBe('Cabang')
    expect(labelKartu(t, 'tamran').istilahGen).toBeNull()
    expect(labelKartu(t, 'tamran').labelGen).toBe('GEN.2')
  })
})

describe('kartu pasangan', () => {
  it('"Pasangan dari …" tanpa istilah generasi', () => {
    expect(labelKartu(s, 'gita')).toMatchObject({
      jenis: 'pasangan',
      gen: null,
      labelGen: null,
      istilahGen: null,
      keterangan: 'Pasangan dari Bima',
    })
    expect(ket('umar')).toBe('Pasangan dari Cahya')
  })

  it('kalau bercerai: "· bercerai" (juga untuk yang menikah dua kali dengan orang yang sama)', () => {
    expect(ket('fitri')).toBe('Pasangan dari Bima · bercerai')
    expect(ket('eka')).toBe('Pasangan dari Bima · bercerai')
  })

  it('menikah lagi setelah bercerai: tidak lagi tertulis bercerai', () => {
    const d = bangunKeluargaFiktif()
    d.unions.find((u) => u.id === 'u3').status = 'menikah'
    expect(labelKartu(susunSilsilah(d), 'eka').keterangan).toBe('Pasangan dari Bima')
  })

  it('nama pasangan memakai Alm. kalau keturunannya sudah wafat', () => {
    const d = bangunKeluargaFiktif()
    Object.assign(d.people.find((p) => p.id === 'lorvan'), { is_deceased: true, death_y: 2020 })
    expect(labelKartu(susunSilsilah(d), 'sinta').keterangan).toBe('Pasangan dari Alm. Lorvan')
  })

  it('pasangan dari beberapa keturunan', () => {
    const d = bangunKeluargaFiktif()
    d.unions.push({
      id: 'ux', tree_id: null, partner1_id: 'lorvan', partner2_id: 'gita', status: 'menikah',
      marriage_y: 2000, deleted_at: null, created_at: '2026-03-01T00:00:00Z',
    })
    expect(labelKartu(susunSilsilah(d), 'gita').keterangan).toBe('Pasangan dari Bima dan Lorvan')
  })
})

describe('detail orang', () => {
  it('generasi, nomor, dan tanggal', () => {
    const d = labelDetail(s, 'raksa')
    expect(d).toMatchObject({ nama: 'Alm. Raksa', generasi: 'Generasi ke-0 (Pangkal)', nomor: '1' })
    expect(labelDetail(s, 'tamran')).toMatchObject({ generasi: 'Generasi ke-2 (Putu)', nomor: '1.1.1' })
  })

  it('anak sambung dan anak angkat hanya tertulis di detail', () => {
    expect(labelDetail(s, 'vino').jalur[0].jenis).toBe('Anak sambung')
    expect(labelDetail(s, 'yoga').jalur[0].jenis).toBe('Anak angkat')
    expect(labelDetail(s, 'wati').jalur[0].jenis).toBeNull()
  })

  it('pernikahan antarsepupu: kedua jalur dengan "Anak ke-n" masing-masing', () => {
    const d = labelDetail(s, 'hasna')
    expect(d.jalur).toEqual([
      { orangTuaId: 'rangga', orangTua: 'Rangga', gen: 3, terdekat: true, keterangan: 'Anak ke-1', jenis: null },
      { orangTuaId: 'gendis', orangTua: 'Gendis', gen: 4, terdekat: false, keterangan: 'Anak ke-1', jenis: null },
    ])
    expect(d.generasi).toBe('Generasi ke-3 (Buyut)')
  })

  it('pernikahan berurutan dengan anak per pernikahan', () => {
    const d = labelDetail(s, 'bima')
    expect(d.pernikahan.map((p) => [p.ke, p.pasangan, p.pasanganKe, p.status])).toEqual([
      [1, 'Eka', 'istri ke-1', 'Bercerai'],
      [2, 'Fitri', 'istri ke-2', 'Bercerai'],
      [3, 'Eka', 'istri ke-1', 'Bercerai'],
      [4, 'Gita', 'istri ke-3', 'Menikah'],
    ])
    expect(d.pernikahan.map((p) => p.anak.map((a) => a.anakKe))).toEqual([
      [1, 2, 3],
      [4, 5],
      [6, 7],
      [8, 9, 10, 11],
    ])
    expect(d.pernikahan[0]).toMatchObject({ menikah: '1970', berakhir: '1976' })
  })

  it('pernikahan dengan satu pasangan tidak diberi "istri ke-n"', () => {
    expect(labelDetail(s, 'cahya').pernikahan[0].pasanganKe).toBeNull()
  })

  it('anak sambung/angkat ditandai di daftar anak per pernikahan', () => {
    expect(labelDetail(s, 'cahya').pernikahan[0].anak.map((a) => [a.nama, a.jenis])).toEqual([
      ['Vino', 'Anak sambung'],
      ['Wati', null],
    ])
  })

  it('pasangan: keterangan dan pernikahannya', () => {
    const d = labelDetail(s, 'eka')
    expect(d.generasi).toBeNull()
    expect(d.keteranganPasangan).toBe('Pasangan dari Bima · bercerai')
    expect(d.pernikahan.map((p) => p.pasangan)).toEqual(['Bima', 'Bima'])
  })
})
