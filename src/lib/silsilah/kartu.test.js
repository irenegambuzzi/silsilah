import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { keteranganDaftar, labelDetail, labelKartu } from './kartu.js'
import { awalanAlmarhum, namaTampil } from './nama.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const ket = (id) => keteranganDaftar(s, id).keterangan
// Kartu + keterangan yang tampil di Daftar dan panel (tahun, "Anak ke-n", "Pasangan dari …").
const info = (id, d = s) => ({ ...labelKartu(d, id), ...keteranganDaftar(d, id) })

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
    expect(info('raksa')).toMatchObject({
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
    expect(info('tamran')).toMatchObject({
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
    const { id: _a, nama: _b, panggilan: _c, sex: _k, ...vino } = labelKartu(s, 'vino')
    const { id: _f, nama: _g, panggilan: _h, sex: _l, ...wati } = labelKartu(s, 'wati')
    expect(vino).toEqual(wati)
  })

  it('pernikahan antarsepupu: GEN dan "Anak ke-n" mengikuti jalur terdekat', () => {
    expect(info('hasna')).toMatchObject({
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

describe('isi kartu sederhana seperti aplikasi lama', () => {
  const semua = [...s.graf.orang.keys()].filter((id) => (s.graf.orang.get(id).tree_id ?? null) === null)
  const tampil = (k) => [k.nama, k.label, k.pojok].filter(Boolean).join(' ')

  it('kartu keturunan: nama, istilah Jawa sebagai label, dan GEN di pojok', () => {
    expect(labelKartu(s, 'mega')).toMatchObject({ nama: 'Mega', jenis: 'keturunan', label: 'Putu', pojok: 'GEN.2' })
  })
  it('kartu pangkal: nama dan label "Pangkal", tanpa GEN', () => {
    expect(labelKartu(s, 'raksa')).toMatchObject({ nama: 'Alm. Raksa', jenis: 'pangkal', label: 'Pangkal', pojok: null })
    expect(labelKartu(s, 'selara')).toMatchObject({ jenis: 'pangkal', label: 'Pangkal', pojok: null })
  })
  it('kartu pasangan: hanya nama, tanpa label dan tanpa GEN', () => {
    for (const id of ['eka', 'fitri', 'gita', 'umar', 'sinta', 'laila']) {
      expect(labelKartu(s, id)).toMatchObject({ jenis: 'pasangan', label: null, pojok: null })
    }
  })
  it('tidak ada kartu yang memuat tahun, "Anak ke-n", atau "Pasangan dari"', () => {
    for (const id of semua) {
      const k = labelKartu(s, id)
      expect(k).not.toHaveProperty('tahun')
      expect(k).not.toHaveProperty('keterangan')
      expect(tampil(k), id).not.toMatch(/\d{4}|anak ke-|pasangan dari|istri ke-|suami ke-|sambung|angkat/i)
    }
  })
})

describe('kartu pasangan', () => {
  it('"Pasangan dari …" tanpa istilah generasi', () => {
    expect(info('gita')).toMatchObject({
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
    expect(keteranganDaftar(susunSilsilah(d), 'eka').keterangan).toBe('Pasangan dari Bima')
  })

  it('nama pasangan memakai Alm. kalau keturunannya sudah wafat', () => {
    const d = bangunKeluargaFiktif()
    Object.assign(d.people.find((p) => p.id === 'lorvan'), { is_deceased: true, death_y: 2020 })
    expect(keteranganDaftar(susunSilsilah(d), 'sinta').keterangan).toBe('Pasangan dari Alm. Lorvan')
  })

  it('pasangan dari beberapa keturunan', () => {
    const d = bangunKeluargaFiktif()
    d.unions.push({
      id: 'ux', tree_id: null, partner1_id: 'lorvan', partner2_id: 'gita', status: 'menikah',
      marriage_y: 2000, deleted_at: null, created_at: '2026-03-01T00:00:00Z',
    })
    expect(keteranganDaftar(susunSilsilah(d), 'gita').keterangan).toBe('Pasangan dari Bima dan Lorvan')
  })
})

describe('keterangan orang (panel, format aplikasi lama)', () => {
  it('subjudul: istilah Jawa dulu, lalu generasi; pangkal; pasangan', () => {
    expect(labelDetail(s, 'tamran').subjudul).toBe('Putu · Generasi ke-2')
    expect(labelDetail(s, 'bima').subjudul).toBe('Anak · Generasi ke-1')
    expect(labelDetail(s, 'raksa').subjudul).toBe('Pangkal')
    expect(labelDetail(s, 'eka').subjudul).toBe('Pasangan dari Bima · bercerai')
    expect(labelDetail(s, 'tamran').subjudul).not.toMatch(/\(/)
  })

  it('jenis kelamin, nomor silsilah', () => {
    expect(labelDetail(s, 'raksa')).toMatchObject({ nama: 'Alm. Raksa', jenisKelamin: 'Laki-laki', nomor: '1' })
    expect(labelDetail(s, 'cahya').jenisKelamin).toBe('Perempuan')
  })

  it('orang tua dalam SATU baris: kedua orang tua, tanpa "orang tua lain"', () => {
    expect(labelDetail(s, 'tamran').orangTua).toEqual([
      { unionId: 'u1', orang: [{ id: 'bima', nama: 'Bima' }, { id: 'eka', nama: 'Eka' }], jenis: null },
    ])
    expect(labelDetail(s, 'raksa').orangTua).toEqual([])
  })

  it('urutan lahir: "Anak ke-n · dari istri ke-n"', () => {
    expect(labelDetail(s, 'mega').urutan).toEqual(['Anak ke-6 · dari istri ke-1'])
    expect(labelDetail(s, 'wati').urutan).toEqual(['Anak ke-2'])
  })

  it('anak pasangan pangkal: satu baris urutan, bukan dua jalur', () => {
    expect(labelDetail(s, 'bima')).toMatchObject({ urutan: ['Anak ke-1'], lewat: null })
    expect(labelDetail(s, 'lorvan').urutan).toEqual(['Anak ke-3'])
  })

  it('anak sambung/angkat: kata lembut HANYA di keterangan anak itu sendiri', () => {
    expect(labelDetail(s, 'vino').orangTua[0].jenis).toBe('Anak sambung Cahya')
    expect(labelDetail(s, 'yoga').orangTua[0].jenis).toBe('Anak angkat')
    expect(labelDetail(s, 'wati').orangTua[0].jenis).toBeNull()
    // Di keterangan orang tuanya, daftar anak hanya berisi nama.
    expect(labelDetail(s, 'cahya').anak).toEqual([{ id: 'vino', nama: 'Vino' }, { id: 'wati', nama: 'Wati' }])
    expect(JSON.stringify(labelDetail(s, 'cahya'))).not.toMatch(/sambung|angkat/i)
    expect(JSON.stringify(labelDetail(s, 'lorvan'))).not.toMatch(/sambung|angkat/i)
  })

  it('antarsepupu: orang tua satu baris, "Anak ke-n" untuk masing-masing, satu baris singkat kalau GEN berbeda', () => {
    const d = labelDetail(s, 'hasna')
    expect(d.orangTua[0].orang.map((o) => o.nama)).toEqual(['Rangga', 'Gendis'])
    expect(d.urutan).toEqual(['Anak ke-1 dari Rangga', 'Anak ke-1 dari Gendis'])
    expect(d.subjudul).toBe('Buyut · Generasi ke-3')
    expect(d.lewat).toBe('Lewat Gendis: Canggah · Generasi ke-4')
    // GEN sama: tidak perlu baris tambahan.
    expect(labelDetail(s, 'nirvo').lewat).toBeNull()
  })

  it('satu pernikahan: tanpa "ke-1", tanpa kata ganda; "Menikah tahun 1974"', () => {
    const d = labelDetail(s, 'cahya')
    expect(d.pasangan).toEqual([{ id: 'umar', nama: 'Umar', ke: null, cerai: false, waktu: 'Menikah tahun 1974' }])
    expect(JSON.stringify(d.pasangan)).not.toMatch(/ke-1|Menikah · Menikah/)
  })

  it('lebih dari satu pernikahan: "Istri ke-n", bercerai, dan menikah lagi dengan orang yang sama', () => {
    expect(labelDetail(s, 'bima').pasangan).toEqual([
      { id: 'eka', nama: 'Eka', ke: 'Istri ke-1', cerai: true, waktu: 'Menikah tahun 1970, bercerai tahun 1976; menikah lagi tahun 1982, bercerai tahun 1986' },
      { id: 'fitri', nama: 'Fitri', ke: 'Istri ke-2', cerai: true, waktu: 'Menikah tahun 1977, bercerai tahun 1981' },
      { id: 'gita', nama: 'Gita', ke: 'Istri ke-3', cerai: false, waktu: 'Menikah tahun 1987' },
    ])
  })

  it('tanpa pasangan: daftar kosong (layar menulis "Tidak ada")', () => {
    expect(labelDetail(s, 'oka').pasangan).toEqual([])
  })

  it('anak dari semua pernikahan, urut lahir', () => {
    expect(labelDetail(s, 'bima').anak.map((a) => a.nama)).toEqual([
      'Tamran', 'Ika', 'Tirwan', 'Kirana', 'Lintang', 'Mega', 'Nanda', 'Oka', 'Putri', 'Qori', 'Rangga',
    ])
    expect(labelDetail(s, 'eka').anak.map((a) => a.nama)).toEqual(['Tamran', 'Ika', 'Tirwan', 'Mega', 'Nanda'])
  })

  it('riwayat hidup: "tempat, tanggal"', () => {
    const d = bangunKeluargaFiktif()
    Object.assign(d.people.find((p) => p.id === 'bima'), { birth_place: 'Kota Contoh', birth_m: 3, birth_d: 12 })
    expect(labelDetail(susunSilsilah(d), 'bima').lahir).toBe('Kota Contoh, 12 Maret 1945')
    expect(labelDetail(s, 'raksa')).toMatchObject({ lahir: '1920', wafat: '1990' })
  })

  it('tanggal menikah lengkap atau perkiraan', () => {
    const d = bangunKeluargaFiktif()
    Object.assign(d.unions.find((u) => u.id === 'u5'), { marriage_m: 6, marriage_d: 2 })
    Object.assign(d.unions.find((u) => u.id === 'u6'), { marriage_approx: true })
    const t = susunSilsilah(d)
    expect(labelDetail(t, 'cahya').pasangan[0].waktu).toBe('Menikah pada 2 Juni 1974')
    expect(labelDetail(t, 'lorvan').pasangan[0].waktu).toBe('Menikah sekitar tahun 1975')
  })
})
