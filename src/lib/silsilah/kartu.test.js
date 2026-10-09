import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { keteranganDaftar, labelDetail, labelKartu } from './kartu.js'
import { awalanAlmarhum, namaTampil } from './nama.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const ket = (id) => keteranganDaftar(s, id).keterangan
const utamaSemua = [...s.graf.orang.values()].filter((o) => (o.tree_id ?? null) === null).map((o) => o.id)
// Kartu + keterangan yang tampil di Daftar dan panel (tahun, "Putra/Putri ke-n", "Pasangan dari …").
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
      keterangan: 'Putra ke-1 · dari istri ke-1',
    })
  })

  it('pernikahan berulang: 11 anak dari 3 istri, kembali ke istri ke-1', () => {
    const anak = ['tamran', 'ika', 'tirwan', 'kirana', 'lintang', 'mega', 'nanda', 'oka', 'putri', 'qori', 'rangga']
    expect(anak.map(ket)).toEqual([
      'Putra ke-1 · dari istri ke-1',
      'Putri ke-2 · dari istri ke-1',
      'Putra ke-3 · dari istri ke-1',
      'Putri ke-4 · dari istri ke-2',
      'Putra ke-5 · dari istri ke-2',
      'Putri ke-6 · dari istri ke-1',
      'Putra ke-7 · dari istri ke-1',
      'Putra ke-8 · dari istri ke-3',
      'Putri ke-9 · dari istri ke-3',
      'Putra ke-10 · dari istri ke-3',
      'Putra ke-11 · dari istri ke-3',
    ])
  })

  it('bagian "dari istri ke-n" tidak muncul kalau orang tua hanya punya satu pasangan', () => {
    expect(ket('wati')).toBe('Putri ke-1')
    expect(ket('kelvan')).toBe('Putra ke-1')
    expect(ket('gendis')).toBe('Putri ke-1')
  })

  it('anak sambung dan anak angkat: kartu sama persis, tidak bernomor, tanpa kata "sambung"/"angkat"', () => {
    expect(ket('vino')).toBe('')
    expect(ket('yoga')).toBe('')
    for (const id of ['vino', 'yoga']) {
      expect(JSON.stringify(labelKartu(s, id)).toLowerCase()).not.toMatch(/sambung|angkat/)
    }
    // Bentuknya sama dengan saudara kandung.
    const { id: _a, nama: _b, panggilan: _c, sex: _k, ...vino } = labelKartu(s, 'vino')
    const { id: _f, nama: _g, panggilan: _h, sex: _l, ...wati } = labelKartu(s, 'wati')
    expect(vino).toEqual(wati)
  })

  it('pernikahan antarsepupu: GEN dan "Putra/Putri ke-n" mengikuti jalur terdekat', () => {
    expect(info('hasna')).toMatchObject({
      gen: 3,
      labelGen: 'GEN.3',
      istilahGen: 'Buyut',
      keterangan: 'Putri ke-1',
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
  it('kartu pasangan (bukan keturunan): nama dan SATU label "Pasangan", tanpa GEN', () => {
    for (const id of ['eka', 'fitri', 'gita', 'umar', 'sinta', 'laila', 'harvel', 'halvin', 'dara']) {
      expect(labelKartu(s, id)).toMatchObject({ jenis: 'pasangan', label: 'Pasangan', pojok: null, labelGen: null })
    }
  })
  it('pasangan khusus dengan pohon keluarga asal tetap "Pasangan"; kedua pangkal utama tetap "Pangkal"', () => {
    for (const id of s.graf.orang.keys()) {
      const k = labelKartu(s, id)
      if (k.jenis === 'pasangan') expect(k.label, id).toBe('Pasangan')
    }
    expect(['eka', 'dara'].map((id) => labelKartu(s, id).label)).toEqual(['Pasangan', 'Pasangan'])
    expect(['raksa', 'selara'].map((id) => labelKartu(s, id).label)).toEqual(['Pangkal', 'Pangkal'])
  })
  it('tidak ada kartu yang memuat tahun, "Putra/Putri ke-n", atau "Pasangan dari"', () => {
    for (const id of semua) {
      const k = labelKartu(s, id)
      expect(k).not.toHaveProperty('tahun')
      expect(k).not.toHaveProperty('keterangan')
      expect(tampil(k), id).not.toMatch(/\d{4}|anak ke-|putra ke-|putri ke-|pasangan dari|istri ke-|suami ke-|sambung|angkat/i)
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

  it('kalau berakhir karena berpisah: "· berpisah" (juga untuk yang menikah dua kali dengan orang yang sama)', () => {
    expect(ket('fitri')).toBe('Pasangan dari Bima · berpisah')
    expect(ket('eka')).toBe('Pasangan dari Bima · berpisah')
  })

  it('menikah lagi setelah berpisah: tidak lagi tertulis berpisah', () => {
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
  it('masihAnak: di bawah 18 tahun, atau wafat sebelum 18 tahun', () => {
    const hari = (y) => new Date(y, 9, 9)
    expect(labelDetail(s, 'bayu', { hariIni: hari(2026) }).masihAnak).toBe(true)
    expect(labelDetail(s, 'bayu', { hariIni: hari(2032) }).masihAnak).toBe(false)
    expect(labelDetail(s, 'sekar', { hariIni: hari(2026) }).masihAnak).toBe(true)
    expect(labelDetail(s, 'tirwan', { hariIni: hari(2026) }).masihAnak).toBe(false)
  })

  it('subjudul: istilah Jawa dulu, lalu generasi; pangkal; pasangan', () => {
    expect(labelDetail(s, 'tamran').subjudul).toBe('Putu · Generasi ke-2')
    expect(labelDetail(s, 'bima').subjudul).toBe('Anak · Generasi ke-1')
    expect(labelDetail(s, 'raksa').subjudul).toBe('Pangkal')
    expect(labelDetail(s, 'eka').subjudul).toBe('Pasangan dari Bima · berpisah')
    expect(labelDetail(s, 'tamran').subjudul).not.toMatch(/\(/)
  })

  it('jenis kelamin, nomor silsilah', () => {
    expect(labelDetail(s, 'raksa')).toMatchObject({ nama: 'Alm. Raksa', jenisKelamin: 'Laki-laki', nomor: '1' })
    expect(labelDetail(s, 'cahya').jenisKelamin).toBe('Perempuan')
  })

  it('orang tua dalam SATU baris: kedua orang tua, tanpa "orang tua lain"', () => {
    expect(labelDetail(s, 'tamran').orangTua).toEqual([
      { unionId: 'u1', angkat: false, orang: [{ id: 'bima', nama: 'Bima', sambung: null }, { id: 'eka', nama: 'Eka', sambung: null }] },
    ])
    expect(labelDetail(s, 'raksa').orangTua).toEqual([])
  })

  it('urutan lahir: "Putri ke-6 dari 11 bersaudara" (hanya anak kandung), tanpa label', () => {
    expect(labelDetail(s, 'mega').urutan).toEqual(['Putri ke-6 dari 11 bersaudara'])
    expect(labelDetail(s, 'rangga').urutan).toEqual(['Putra ke-11 dari 11 bersaudara'])
    // Cahya: Vino anak sambung (tidak dihitung), jadi Wati anak kandung satu-satunya.
    expect(labelDetail(s, 'wati').urutan).toEqual(['Putri tunggal'])
    expect(labelDetail(s, 'kelvan').urutan).toEqual(['Putra tunggal'])
  })

  it('anak pasangan pangkal: satu kalimat urutan, bukan dua jalur', () => {
    expect(labelDetail(s, 'bima')).toMatchObject({ urutan: ['Putra ke-1 dari 3 bersaudara'], lewat: null })
    expect(labelDetail(s, 'lorvan').urutan).toEqual(['Putra ke-3 dari 3 bersaudara'])
  })

  it('jenis kelamin tidak diketahui: "Putra/Putri ke-n"', () => {
    expect(labelDetail(s, 'ragil').urutan).toEqual(['Putra/Putri ke-3 dari 3 bersaudara'])
  })

  it('anak sambung/angkat: tidak bernomor; "Anak sambung [nama]" / "Anak angkat [nama]"', () => {
    expect(labelDetail(s, 'vino').urutan).toEqual(['Anak sambung Cahya'])
    expect(labelDetail(s, 'yoga').urutan).toEqual(['Anak angkat Lorvan & Sinta'])
    expect(labelDetail(s, 'wati').urutan).not.toContain(expect.stringMatching(/sambung|angkat/))
  })

  it('anak di keterangan orang tuanya: anak kandung bernomor, anak sambung/angkat tanpa nomor dengan keterangan kecil, menurut umur', () => {
    expect(labelDetail(s, 'cahya').anak).toEqual([
      { id: 'vino', nama: 'Vino', ke: null, jenis: 'anak sambung', dari: null }, // lahir 1972, lebih tua
      { id: 'wati', nama: 'Wati', ke: 1, jenis: null, dari: null },
    ])
    expect(labelDetail(s, 'lorvan').anak).toEqual([
      { id: 'kelvan', nama: 'Kelvan', ke: 1, jenis: null, dari: null },
      { id: 'yoga', nama: 'Yoga', ke: null, jenis: 'anak angkat', dari: null },
    ])
    // Umar: Vino anak kandungnya (anak sambung bagi Cahya).
    expect(labelDetail(s, 'umar').anak.map((a) => [a.nama, a.ke, a.jenis])).toEqual([['Vino', 1, null], ['Wati', 2, null]])
  })

  it('antarsepupu: orang tua satu baris, "Putri ke-n" untuk masing-masing (pihak …), satu baris singkat kalau GEN berbeda', () => {
    const d = labelDetail(s, 'hasna')
    expect(d.orangTua[0].orang.map((o) => o.nama)).toEqual(['Rangga', 'Gendis'])
    expect(d.urutan).toEqual(['Putri tunggal (pihak Rangga)', 'Putri tunggal (pihak Gendis)'])
    expect(d.subjudul).toBe('Buyut · Generasi ke-3')
    expect(d.lewat).toBe('Lewat Gendis: Canggah · Generasi ke-4')
    // GEN sama: tidak perlu baris tambahan.
    expect(labelDetail(s, 'nirvo').lewat).toBeNull()
  })

  it('satu pernikahan: tanpa "ke-1", tanpa kata ganda; "Menikah tahun 1974"', () => {
    const d = labelDetail(s, 'cahya')
    expect(d.pasangan).toEqual([{ id: 'umar', nama: 'Umar', ke: null, berpisah: false, waktu: 'Menikah tahun 1974' }])
    expect(JSON.stringify(d.pasangan)).not.toMatch(/ke-1|Menikah · Menikah/)
  })

  it('lebih dari satu pernikahan: "Istri ke-n", berpisah, dan menikah lagi dengan orang yang sama', () => {
    expect(labelDetail(s, 'bima').pasangan).toEqual([
      { id: 'eka', nama: 'Eka', ke: 'Istri ke-1', berpisah: true, waktu: 'Menikah tahun 1970, berpisah tahun 1976; menikah lagi tahun 1982, berpisah tahun 1986' },
      { id: 'fitri', nama: 'Fitri', ke: 'Istri ke-2', berpisah: true, waktu: 'Menikah tahun 1977, berpisah tahun 1981' },
      { id: 'gita', nama: 'Gita', ke: 'Istri ke-3', berpisah: false, waktu: 'Menikah tahun 1987' },
    ])
  })

  it('tanpa data pernikahan: daftar pasangan kosong (baris "Pasangan" tidak tampil)', () => {
    expect(labelDetail(s, 'oka').pasangan).toEqual([])
  })

  it('anak dari semua pernikahan, bernomor, dengan "dari istri ke-n" kalau lebih dari satu pasangan', () => {
    expect(labelDetail(s, 'bima').anak.map((a) => [a.ke, a.nama, a.dari])).toEqual([
      [1, 'Tamran', 'dari istri ke-1'], [2, 'Ika', 'dari istri ke-1'], [3, 'Alm. Tirwan', 'dari istri ke-1'],
      [4, 'Kirana', 'dari istri ke-2'], [5, 'Lintang', 'dari istri ke-2'],
      [6, 'Mega', 'dari istri ke-1'], [7, 'Nanda', 'dari istri ke-1'],
      [8, 'Oka', 'dari istri ke-3'], [9, 'Putri', 'dari istri ke-3'], [10, 'Qori', 'dari istri ke-3'], [11, 'Rangga', 'dari istri ke-3'],
    ])
    // Eka hanya punya satu pasangan (Bima, dua kali menikah): tanpa "dari suami ke-n".
    expect(labelDetail(s, 'eka').anak.map((a) => [a.ke, a.nama, a.dari])).toEqual([
      [1, 'Tamran', null], [2, 'Ika', null], [3, 'Alm. Tirwan', null], [4, 'Mega', null], [5, 'Nanda', null],
    ])
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

describe('baris yang selalu tampil dan yang hanya tampil kalau berlaku', () => {
  it('Wafat hanya untuk yang sudah wafat; yang masih hidup tanpa baris Wafat', () => {
    expect(labelDetail(s, 'bima')).toMatchObject({ sudahWafat: false, wafat: null })
    expect(labelDetail(s, 'raksa')).toMatchObject({ sudahWafat: true, wafat: '1990' })
  })

  it('isian kosong bernilai null (layar menulis "-")', () => {
    expect(labelDetail(s, 'oka')).toMatchObject({ panggilan: null, pekerjaan: null, catatan: null })
    expect(labelDetail(s, 'eka')).toMatchObject({ nomor: null, orangTua: [] })
    const d = bangunKeluargaFiktif()
    Object.assign(d.people.find((p) => p.id === 'oka'), { birth_y: null })
    expect(labelDetail(susunSilsilah(d), 'oka').lahir).toBeNull()
  })

  it('status pernikahan: tidak tampil untuk anak di bawah umur tanpa data pernikahan', () => {
    const hari = new Date(2026, 9, 9)
    expect(labelDetail(s, 'bayu', { hariIni: hari }).tampilStatus).toBe(false)
    expect(labelDetail(s, 'oka', { hariIni: hari }).tampilStatus).toBe(true)
  })

  it('status pernikahan diturunkan dari pernikahan; tanpa data → null ("-"), tidak pernah "Belum menikah" otomatis', () => {
    expect(labelDetail(s, 'bima').statusPernikahan).toBe('Menikah')
    expect(labelDetail(s, 'eka').statusPernikahan).toBe('Berpisah')
    expect(labelDetail(s, 'fitri').statusPernikahan).toBe('Berpisah')
    expect(labelDetail(s, 'dara').statusPernikahan).toBe('Ditinggal wafat pasangan')
    expect(labelDetail(s, 'oka').statusPernikahan).toBeNull()
    for (const id of utamaSemua) {
      if (!s.graf.orang.get(id).marital_choice) expect(labelDetail(s, id).statusPernikahan, id).not.toBe('Belum menikah')
    }
  })
})
