import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { labelDetail, labelKartu } from '../silsilah/kartu.js'
import { warnaKartu } from './warna.js'
import { silsilahCabang } from './cabang.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const c = silsilahCabang(s, 'lorvan')

describe('fokus cabang: generasi dihitung dari orang yang difokuskan', () => {
  it('orang itu GEN.0 dengan label "Awal cabang", warnanya tetap warna keturunan', () => {
    const k = labelKartu(c, 'lorvan')
    expect(k).toMatchObject({ gen: 0, label: 'Awal cabang', pojok: 'GEN.0', jenis: 'keturunan' })
    expect(warnaKartu(k)).toBe('keturunan-l')
    expect(labelDetail(c, 'lorvan').subjudul).toBe('Awal cabang')
  })

  it('anaknya GEN.1 · Anak, cucunya GEN.2 · Putu', () => {
    expect(labelKartu(c, 'kelvan')).toMatchObject({ gen: 1, label: 'Anak', pojok: 'GEN.1' })
    expect(labelKartu(c, 'yoga')).toMatchObject({ gen: 1, label: 'Anak' })
    expect(labelKartu(c, 'gendis')).toMatchObject({ gen: 2, label: 'Putu', pojok: 'GEN.2' })
    expect(labelDetail(c, 'gendis').subjudul).toBe('Putu · Generasi ke-2')
  })

  it('tanpa pilihan itu (pangkal utama): GEN seperti biasa; nomor silsilah tidak berubah', () => {
    expect(labelKartu(s, 'gendis')).toMatchObject({ gen: 3, label: 'Buyut' })
    expect(c.nomor.get('gendis')).toBe(s.nomor.get('gendis'))
  })

  it('PASANGAN orang yang difokuskan juga "Awal cabang" GEN.0; warnanya tetap warna pasangan', () => {
    const k = labelKartu(c, 'sinta')
    expect(k).toMatchObject({ jenis: 'pasangan', gen: 0, label: 'Awal cabang', pojok: 'GEN.0' })
    expect(warnaKartu(k)).toBe('pasangan-p')
    expect(labelDetail(c, 'sinta').subjudul).toBe('Awal cabang')
    // Semua pasangannya, juga yang sudah berpisah.
    const b = silsilahCabang(s, 'bima')
    for (const id of ['eka', 'fitri', 'gita']) {
      expect(labelKartu(b, id), id).toMatchObject({ jenis: 'pasangan', gen: 0, label: 'Awal cabang', pojok: 'GEN.0' })
    }
  })

  it('pasangan lain di cabang itu tetap "Pasangan" tanpa GEN; tanpa hitungan cabang pasangan itu juga "Pasangan"', () => {
    expect(labelKartu(c, 'laila')).toMatchObject({ jenis: 'pasangan', gen: null, label: 'Pasangan', pojok: null })
    expect(labelKartu(s, 'sinta')).toMatchObject({ jenis: 'pasangan', gen: null, label: 'Pasangan', pojok: null })
    expect(labelDetail(s, 'sinta').subjudul).toBe('Pasangan dari Lorvan')
  })
})

// Putaran keenam tinjauan: keturunan tanpa GEN (generasi.js, tanpaGen) juga
// tanpa GEN saat generasi dihitung dari cabang; warnanya tidak berubah.
describe('fokus cabang: keturunan tanpa GEN', () => {
  it('"Hitung dari Cahya": Wati GEN.1 · Anak, Vino dan anak-anaknya tetap tanpa GEN', () => {
    const cc = silsilahCabang(s, 'cahya')
    expect(labelKartu(cc, 'wati')).toMatchObject({ gen: 1, label: 'Anak' })
    for (const id of ['vino', 'sadevan-b', 'bagaskara']) {
      expect(labelKartu(cc, id), id).toMatchObject({ jenis: 'keturunan', gen: null, label: null, pojok: null })
      expect(labelDetail(cc, id).subjudul, id).toBeNull()
    }
  })

  it('"Hitung dari Cahya": Nirvo (anak Tamran & Wati) GEN.2 · Putu; Tamran (cabang lain) tanpa GEN', () => {
    const cc = silsilahCabang(s, 'cahya')
    expect(labelKartu(cc, 'nirvo')).toMatchObject({ gen: 2, label: 'Putu', pojok: 'GEN.2' })
    expect(labelKartu(cc, 'tamran')).toMatchObject({ jenis: 'keturunan', gen: null, pojok: null })
    expect(labelDetail(cc, 'tamran').subjudul).toBeNull()
  })
})

// Putaran ketujuh, bagian 2: X diperlakukan seperti leluhur, siapa pun X itu.
describe('"Hitung dari X": X diperlakukan seperti leluhur', () => {
  it('"Hitung dari Vino": Vino dan Ratrisa Kemuntari GEN.0 · Awal cabang; anak-anaknya GEN.1 · Anak', () => {
    const cv = silsilahCabang(s, 'vino')
    expect(labelKartu(cv, 'vino')).toMatchObject({ jenis: 'keturunan', gen: 0, label: 'Awal cabang', pojok: 'GEN.0' })
    expect(labelKartu(cv, 'ratrisa-k')).toMatchObject({ jenis: 'pasangan', gen: 0, label: 'Awal cabang', pojok: 'GEN.0' })
    for (const id of ['sadevan-b', 'bagaskara']) {
      expect(labelKartu(cv, id), id).toMatchObject({ gen: 1, label: 'Anak', pojok: 'GEN.1' })
      expect(labelDetail(cv, id).subjudul, id).toBe('Anak · Generasi ke-1')
    }
    expect(labelDetail(cv, 'vino').subjudul).toBe('Awal cabang')
  })

  it('anak dari anak mereka GEN.2 · Putu (keluarga fiktif ditambah satu cucu)', () => {
    const d = bangunKeluargaFiktif()
    d.people.push({ ...d.people.find((p) => p.id === 'hasna'), id: 'cucu-vino', full_name: 'Cucu Vino' })
    d.unions.push({ ...d.unions.find((u) => u.id === 'u19'), id: 'u-sb', partner1_id: 'sadevan-b', partner2_id: null })
    d.children.push({ ...d.children.find((c) => c.child_id === 'hasna'), id: 'c-sb', union_id: 'u-sb', child_id: 'cucu-vino' })
    expect(labelKartu(silsilahCabang(susunSilsilah(d), 'vino'), 'cucu-vino')).toMatchObject({ gen: 2, label: 'Putu' })
  })

  it('"Hitung dari Galen": Galen GEN.0 · Awal cabang', () => {
    expect(labelKartu(silsilahCabang(s, 'galen'), 'galen')).toMatchObject({ gen: 0, label: 'Awal cabang', pojok: 'GEN.0' })
  })

  it('"Hitung dari Lorvan": anak angkat tetap ber-GEN (Yoga GEN.1, Ratrisa Anindya GEN.2 · Putu); Bintang lewat Arum GEN.2', () => {
    expect(labelKartu(c, 'yoga')).toMatchObject({ gen: 1, label: 'Anak' })
    expect(labelKartu(c, 'ratrisa-a')).toMatchObject({ gen: 2, label: 'Putu' })
    expect(labelKartu(c, 'bintang')).toMatchObject({ gen: 2, label: 'Putu' })
    expect(labelKartu(c, 'hasna')).toMatchObject({ gen: 3, label: 'Buyut' })
  })

  it('tampilan utama: Vino, Galen, Elvina, Sadevan Bramasta, Bagaskara tetap tanpa GEN', () => {
    for (const id of ['vino', 'galen', 'elvina', 'sadevan-b', 'bagaskara']) {
      expect(labelKartu(s, id), id).toMatchObject({ gen: null, pojok: null })
    }
  })

  it('warna kartu tidak berubah: warna keturunan', () => {
    expect(['galen', 'elvina', 'vino', 'sadevan-b', 'bagaskara'].map((id) => warnaKartu(labelKartu(s, id)))).toEqual([
      'keturunan-l', 'keturunan-p', 'keturunan-l', 'keturunan-l', 'keturunan-wafat',
    ])
  })
})
