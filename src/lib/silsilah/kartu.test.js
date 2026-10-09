import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { keteranganDaftar, labelDetail, labelKartu, keteranganCari } from './kartu.js'
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

  it('pernikahan antarsepupu: GEN dan "Putra/Putri ke-n" mengikuti pihak laki-laki', () => {
    expect(info('bintang')).toMatchObject({ gen: 4, labelGen: 'GEN.4', istilahGen: 'Canggah', keterangan: 'Putra ke-1' })
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

  it('jenis kelamin; nomor silsilah tidak ada di keterangan (tidak pernah ditampilkan)', () => {
    expect(labelDetail(s, 'raksa')).toMatchObject({ nama: 'Alm. Raksa', jenisKelamin: 'Laki-laki' })
    for (const id of utamaSemua) {
      expect(labelDetail(s, id), id).not.toHaveProperty('nomor')
      expect(labelKartu(s, id), id).not.toHaveProperty('nomor')
    }
    expect(labelDetail(s, 'cahya').jenisKelamin).toBe('Perempuan')
  })

  it('orang tua kandung dalam SATU baris (ayah dulu), ibu sambung di baris sendiri', () => {
    expect(labelDetail(s, 'tamran').orangTua).toEqual([
      { jenis: 'kandung', orang: [{ id: 'bima', nama: 'Bima' }, { id: 'eka', nama: 'Eka' }] },
      // Istri ke-2 dan ke-3 Bima menikah dengannya sesudah Tamran lahir: ibu sambung, urut waktu pernikahan.
      { jenis: 'sambung', sex: 'P', orang: [{ id: 'fitri', nama: 'Fitri' }, { id: 'gita', nama: 'Gita' }] },
    ])
    expect(labelDetail(s, 'raksa').orangTua).toEqual([])
  })

  it('urutan lahir: "Putri ke-6 dari 11 bersaudara" (hanya anak kandung), tanpa label', () => {
    expect(labelDetail(s, 'mega').urutan).toEqual(['Putri ke-6 dari 11 bersaudara', 'Anak sambung Gita'])
    expect(labelDetail(s, 'rangga').urutan).toEqual(['Putra ke-11 dari 11 bersaudara'])
    // Cahya: Vino anak sambung (tidak dihitung), jadi Wati anak kandung satu-satunya.
    expect(labelDetail(s, 'wati').urutan).toEqual(['Putri tunggal'])
    expect(labelDetail(s, 'gendis').urutan).toEqual(['Putri tunggal'])
    expect(labelDetail(s, 'kelvan').urutan).toEqual(['Putra ke-1 dari 2 bersaudara'])
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
      { id: 'arum', nama: 'Arum', ke: 2, jenis: null, dari: null },
    ])
    // Umar: Vino anak kandungnya (anak sambung bagi Cahya) dari pernikahan sebelumnya.
    expect(labelDetail(s, 'umar').anak.map((a) => [a.nama, a.ke, a.jenis, a.dari])).toEqual([
      ['Vino', 1, null, 'dari pernikahan sebelumnya'], ['Wati', 2, null, null],
    ])
  })

  it('antarsepupu: orang tua satu baris; urutan SEKALI kalau sama bagi kedua pihak; jalur ibu singkat kalau GEN berbeda', () => {
    const d = labelDetail(s, 'hasna')
    expect(d.orangTua).toEqual([{ jenis: 'kandung', orang: [{ id: 'rangga', nama: 'Rangga' }, { id: 'gendis', nama: 'Gendis' }] }])
    expect(d.urutan).toEqual(['Putri tunggal'])
    expect(d.subjudul).toBe('Buyut · Generasi ke-3')
    expect(d.lewat).toBe('Lewat Gendis: Canggah · Generasi ke-4')
    // Generasi sama, putra tunggal bagi ayah dan ibunya: sekali, tanpa "(pihak …)", tanpa baris tambahan.
    // (Kalimat kedua: ayah dan ibu sambungnya sesudah Tamran dan Wati berpisah.)
    expect(labelDetail(s, 'nirvo')).toMatchObject({ urutan: ['Putra tunggal', 'Anak sambung Melvira dan Tedrik'], lewat: null })
    // Jalur ibu lebih dekat: GEN dari ayah, jalur ibu disebut singkat.
    expect(labelDetail(s, 'bintang')).toMatchObject({
      subjudul: 'Canggah · Generasi ke-4', urutan: ['Putra tunggal'], lewat: 'Lewat Arum: Buyut · Generasi ke-3',
    })
  })

  it('antarsepupu: per pihak hanya kalau hasilnya berbeda, pihak ayah dulu', () => {
    const d = bangunKeluargaFiktif()
    // Rangga punya anak lebih dulu dari pernikahan lain: bagi Rangga Hasna putri ke-2, bagi Gendis putri tunggal.
    d.unions.push({ id: 'ux', tree_id: null, partner1_id: 'rangga', partner2_id: null, status: 'cerai', marriage_y: 2015, deleted_at: null, created_at: '2026-03-01T00:00:00Z' })
    d.people.push({ ...d.people.find((p) => p.id === 'hasna'), id: 'sulung', full_name: 'Sulung', birth_y: 2016, birth_m: null, birth_d: null })
    d.children.push({ id: 'c-ux', tree_id: null, union_id: 'ux', child_id: 'sulung', kind: 'kandung', biological_parent: 'keduanya', deleted_at: null })
    d.birth_ranks = d.birth_ranks.filter((r) => r.parent_id !== 'rangga')
    d.birth_ranks.push({ tree_id: null, parent_id: 'rangga', child_id: 'sulung', rank: 1 }, { tree_id: null, parent_id: 'rangga', child_id: 'hasna', rank: 2 })
    expect(labelDetail(susunSilsilah(d), 'hasna').urutan).toEqual(['Putri ke-2 dari 2 bersaudara (pihak Rangga)', 'Putri tunggal (pihak Gendis)'])
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
    // Kirana dan Lintang (anak Bima dengan Fitri, lahir di antara dua pernikahan Eka) anak sambungnya.
    expect(labelDetail(s, 'eka').anak.map((a) => [a.ke, a.nama, a.jenis, a.dari])).toEqual([
      [1, 'Tamran', null, null], [2, 'Ika', null, null], [3, 'Alm. Tirwan', null, null],
      [null, 'Kirana', 'anak sambung', null], [null, 'Lintang', 'anak sambung', null],
      [4, 'Mega', null, null], [5, 'Nanda', null, null],
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

describe('anak di panel pasangan (bukan keturunan): aturan yang sama dengan keturunan', () => {
  const pasangan = utamaSemua.filter((id) => !s.gen.has(id))
  // Semua anak dari semua pernikahan orang itu (tanpa melihat jenis hubungan).
  const anakDariData = (id) => {
    const hasil = new Set()
    for (const u of s.graf.pernikahan.get(id) ?? []) for (const c of s.graf.anakUnion.get(u.id) ?? []) hasil.add(c.child_id)
    return hasil
  }

  it.each(pasangan.filter((id) => anakDariData(id).size > 0))('%s: semua anak dari pernikahannya tampil, anak kandung bernomor 1..n menurut umur', (id) => {
    const anak = labelDetail(s, id).anak
    for (const a of anakDariData(id)) expect(anak.map((x) => x.id), a).toContain(a)
    const kandung = anak.filter((a) => a.ke != null)
    expect(kandung.map((a) => a.ke)).toEqual(kandung.map((_, i) => i + 1))
  })

  it('Harvel: empat anak. Galen, Elvina, Fajrin anak kandung bernomor 1–3; Celvia (anak Kirana) anak sambung tanpa nomor, menurut umur', () => {
    expect(labelDetail(s, 'harvel').anak).toEqual([
      { id: 'celvia', nama: 'Celvia', ke: null, jenis: 'anak sambung', dari: null },
      { id: 'galen', nama: 'Galen', ke: 1, jenis: null, dari: 'dari pernikahan sebelumnya' },
      { id: 'elvina', nama: 'Elvina', ke: 2, jenis: null, dari: 'dari pernikahan sebelumnya' },
      { id: 'fajrin', nama: 'Fajrin', ke: 3, jenis: null, dari: null },
    ])
  })

  it('Kirana (tidak berubah): Celvia anak kandung dengan suami pertama, Galen dan Elvina anak sambung, Fajrin anak kandung dengan Harvel', () => {
    expect(labelDetail(s, 'kirana').anak).toEqual([
      { id: 'celvia', nama: 'Celvia', ke: 1, jenis: null, dari: 'dari suami ke-1' },
      { id: 'galen', nama: 'Galen', ke: null, jenis: 'anak sambung', dari: 'dari suami ke-2' },
      { id: 'elvina', nama: 'Elvina', ke: null, jenis: 'anak sambung', dari: 'dari suami ke-2' },
      { id: 'fajrin', nama: 'Fajrin', ke: 2, jenis: null, dari: 'dari suami ke-2' },
    ])
  })

  it('Umar dan Cahya: Vino anak kandung Umar dan anak sambung Cahya; Wati anak kandung keduanya', () => {
    expect(labelDetail(s, 'umar').anak).toEqual([
      { id: 'vino', nama: 'Vino', ke: 1, jenis: null, dari: 'dari pernikahan sebelumnya' },
      { id: 'wati', nama: 'Wati', ke: 2, jenis: null, dari: null },
    ])
    expect(labelDetail(s, 'cahya').anak).toEqual([
      { id: 'vino', nama: 'Vino', ke: null, jenis: 'anak sambung', dari: null },
      { id: 'wati', nama: 'Wati', ke: 1, jenis: null, dari: null },
    ])
  })

  it('anak sambung dari sisi pasangan, simetris: panel anak itu menyebut orang tua sambung dan "Anak sambung …"', () => {
    const orangTua = (id) => labelDetail(s, id).orangTua.map((o) => `${o.jenis === 'sambung' ? `sambung ${o.sex}` : o.jenis}: ${o.orang.map((x) => x.nama).join(', ')}`)
    // Celvia: orang tua kandungnya (ayah dulu), lalu Harvel di baris sendiri.
    expect(orangTua('celvia')).toEqual(['kandung: Danuarta, Kirana', 'sambung L: Harvel'])
    expect(labelDetail(s, 'celvia').urutan).toEqual(['Putri ke-1 dari 2 bersaudara', 'Anak sambung Harvel'])
    // Galen dan Elvina: Harvel, ditambah Kirana.
    for (const id of ['galen', 'elvina']) {
      expect(orangTua(id), id).toEqual(['kandung: Harvel', 'sambung P: Kirana'])
      expect(labelDetail(s, id).urutan, id).toContain('Anak sambung Kirana')
    }
    // Vino dan Cahya (sudah benar).
    expect(orangTua('vino')).toEqual(['kandung: Umar', 'sambung P: Cahya'])
    expect(labelDetail(s, 'vino').urutan).toEqual(['Anak sambung Cahya'])
    // Wati anak kandung keduanya: tanpa orang tua sambung.
    expect(orangTua('wati')).toEqual(['kandung: Umar, Cahya'])
  })

  // Anak sambung dari sisi pasangan: SEMUA orang di data contoh, setiap pasangan
  // yang punya anak dari hubungan lain. Anak yang lahir sesudah pernikahan
  // berakhir (berpisah atau wafat), atau wafat sebelum pernikahan dimulai, bukan anak sambung.
  const sambungDari = (id) => labelDetail(s, id).anak.filter((a) => a.jenis === 'anak sambung').map((a) => a.id)
  it.each([
    ['cahya', ['vino']],
    ['kirana', ['galen', 'elvina']],
    ['harvel', ['celvia']],
    // Bima: Eka ke-1 dan ke-2 (1970–76, 1982–86), Fitri (1977–81), Gita (sejak 1987).
    ['eka', ['kirana', 'lintang']], // lahir 1978 dan 1980: sebelum pernikahan ke-2 dengan Bima; Mega dst. anak kandungnya
    ['fitri', ['tamran', 'ika', 'tirwan']], // Mega (1983) dan sesudahnya lahir setelah ia berpisah (1981)
    ['gita', ['tamran', 'ika', 'tirwan', 'kirana', 'lintang', 'mega', 'nanda']],
    // Ika: Joval menikah dengannya 2012; Sekar wafat 1998 (sebelum menikah), jadi bukan anak sambung.
    ['joval', ['dorvi', 'laras']],
    // Yang tidak punya anak sambung.
    ['bima', []], ['umar', []], ['sinta', []], ['laila', []], ['halvin', []], ['dara', []], ['danuarta', []],
    ['nadira', []], ['ravela', []], ['wati', []], ['tamran', []], ['arum', []], ['dorvi', []], ['rangga', []], ['gendis', []],
  ])('%s: anak sambung', (id, harapan) => {
    expect(sambungDari(id)).toEqual(harapan)
  })

  it('Halvin (wafat 2008) tidak punya anak sambung: Bayu (2013) lahir sesudah ia wafat; Danuarta juga tidak: Fajrin lahir sesudah mereka berpisah', () => {
    expect(labelDetail(s, 'halvin').anak.map((a) => a.id)).toEqual(['dorvi', 'sekar', 'laras'])
    expect(labelDetail(s, 'danuarta').anak.map((a) => a.id)).toEqual(['celvia'])
  })

  it('simetris untuk SEMUA orang: X anak sambung Y persis kalau Y orang tua sambung X', () => {
    const maju = new Set()
    const mundur = new Set()
    for (const id of utamaSemua) {
      const d = labelDetail(s, id)
      for (const a of d.anak) if (a.jenis === 'anak sambung') maju.add(`${id}>${a.id}`)
      for (const o of d.orangTua) for (const x of o.orang) if (o.jenis === 'sambung') mundur.add(`${x.id}>${id}`)
    }
    expect(maju.size).toBeGreaterThan(10)
    expect(maju).toEqual(mundur)
  })

  it('daftar anak siapa pun: urut menurut umur, anak kandung bernomor 1..n, sisanya tanpa nomor dengan keterangan, tanpa pengulangan', () => {
    for (const id of utamaSemua) {
      const anak = labelDetail(s, id).anak
      expect(new Set(anak.map((a) => a.id)).size, id).toBe(anak.length)
      const kandung = anak.filter((a) => a.ke != null)
      expect(kandung.map((a) => a.ke), id).toEqual(kandung.map((_, i) => i + 1))
      for (const a of anak) if (a.ke == null) expect(a.jenis, `${id}>${a.id}`).toMatch(/^anak (sambung|angkat)$/)
      const tahun = anak.map((a) => s.graf.orang.get(a.id).birth_y)
      expect(tahun, id).toEqual([...tahun].sort((x, y) => x - y)) // di data contoh semua tahun lahir diketahui
    }
  })

  it('anak sambung dari sisi pasangan tidak mengubah nomor Daftar, jumlah "bersaudara", maupun Bagan', () => {
    expect(labelDetail(s, 'kirana').urutan[0]).toBe('Putri ke-4 dari 11 bersaudara')
    expect(s.nomor.get('celvia')).toBe(s.nomor.get('kirana') + '.1')
  })

  it('pasangan yang menikah dengan dua keturunan: "dari suami ke-n" seperti keturunan; anak Lintang anak sambung Dara', () => {
    const d = bangunKeluargaFiktif()
    d.unions.push({
      id: 'ux', tree_id: null, partner1_id: 'lintang', partner2_id: 'dara', status: 'menikah',
      marriage_y: 2018, deleted_at: null, created_at: '2026-03-01T00:00:00Z',
    })
    d.people.push({ ...d.people.find((p) => p.id === 'arya'), id: 'bungsu', full_name: 'Bungsu', birth_y: 2019 })
    d.children.push({ id: 'c-ux', tree_id: null, union_id: 'ux', child_id: 'bungsu', kind: 'kandung', biological_parent: 'keduanya', deleted_at: null })
    expect(labelDetail(susunSilsilah(d), 'dara').anak.map((a) => [a.ke, a.nama, a.dari])).toEqual([
      [1, 'Rinzo', 'dari suami ke-1'], [null, 'Arya', null], [2, 'Nala', 'dari suami ke-1'], [3, 'Ragil', 'dari suami ke-1'], [4, 'Bungsu', 'dari suami ke-2'],
    ])
  })
})


describe('baris yang selalu tampil dan yang hanya tampil kalau berlaku', () => {
  it('Wafat hanya untuk yang sudah wafat; yang masih hidup tanpa baris Wafat', () => {
    expect(labelDetail(s, 'bima')).toMatchObject({ sudahWafat: false, wafat: null })
    expect(labelDetail(s, 'raksa')).toMatchObject({ sudahWafat: true, wafat: '1990' })
  })

  it('isian kosong bernilai null (layar menulis "-")', () => {
    expect(labelDetail(s, 'oka')).toMatchObject({ panggilan: null, pekerjaan: null, catatan: null })
    expect(labelDetail(s, 'eka')).toMatchObject({ orangTua: [] })
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

describe('keteranganCari: pembeda di hasil pencarian', () => {
  it.each([
    ['sadevan-b', 'Buyut · putra Vino'],
    ['sadevan-a', 'Buyut · putra Nanda'],
    ['ratrisa-k', 'pasangan Vino'],
    ['ratrisa-a', 'Buyut · putri Yoga'],
    ['raksa', 'Pangkal'],
    ['bima', 'Anak · putra Alm. Raksa'],
    ['ragil', 'Buyut · anak Alm. Tirwan'], // jenis kelamin belum diketahui
    ['bintang', 'Canggah · putra Dorvi, S.Kom.'], // antarsepupu: lewat ayah, sama dengan GEN-nya
    ['eka', 'pasangan Bima'], // menikah dua kali dengan orang yang sama: sekali
  ])('%s: "%s"', (id, harapan) => {
    expect(keteranganCari(s, id)).toBe(harapan)
  })
  it('nama yang sama di cabang berbeda selalu punya keterangan berbeda', () => {
    const per = new Map()
    for (const [id, p] of s.graf.orang) {
      if (p.tree_id !== null) continue
      const kunci = `${p.full_name.split(' ')[0]}`
      per.set(kunci, [...(per.get(kunci) ?? []), keteranganCari(s, id)])
    }
    for (const [nama, ket] of per) if (ket.length > 1) expect(new Set(ket).size, nama).toBe(ket.length)
  })
})
