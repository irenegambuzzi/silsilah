import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { labelDetail, labelKartu } from '../silsilah/kartu.js'
import { warnaKartu } from './warna.js'
import { susunBagan } from './susun.js'
import { silsilahCabang } from './cabang.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const bagan = susunBagan(s)
const c = silsilahCabang(s, bagan.simpul.get('lorvan'))

describe('fokus cabang: generasi dihitung dari orang yang difokuskan', () => {
  it('orang itu GEN.0 dengan label "Pangkal cabang", warnanya tetap warna keturunan', () => {
    const k = labelKartu(c, 'lorvan')
    expect(k).toMatchObject({ gen: 0, label: 'Pangkal cabang', pojok: 'GEN.0', jenis: 'keturunan' })
    expect(warnaKartu(k)).toBe('keturunan-l')
    expect(labelDetail(c, 'lorvan').subjudul).toBe('Pangkal cabang')
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

  it('PASANGAN orang yang difokuskan juga "Pangkal cabang" GEN.0; warnanya tetap warna pasangan', () => {
    const k = labelKartu(c, 'sinta')
    expect(k).toMatchObject({ jenis: 'pasangan', gen: 0, label: 'Pangkal cabang', pojok: 'GEN.0' })
    expect(warnaKartu(k)).toBe('pasangan-p')
    expect(labelDetail(c, 'sinta').subjudul).toBe('Pangkal cabang')
    // Semua pasangannya, juga yang sudah berpisah.
    const b = silsilahCabang(s, bagan.simpul.get('bima'))
    for (const id of ['eka', 'fitri', 'gita']) {
      expect(labelKartu(b, id), id).toMatchObject({ jenis: 'pasangan', gen: 0, label: 'Pangkal cabang', pojok: 'GEN.0' })
    }
  })

  it('pasangan lain di cabang itu tetap "Pasangan" tanpa GEN; tanpa hitungan cabang pasangan itu juga "Pasangan"', () => {
    expect(labelKartu(c, 'laila')).toMatchObject({ jenis: 'pasangan', gen: null, label: 'Pasangan', pojok: null })
    expect(labelKartu(s, 'sinta')).toMatchObject({ jenis: 'pasangan', gen: null, label: 'Pasangan', pojok: null })
    expect(labelDetail(s, 'sinta').subjudul).toBe('Pasangan dari Lorvan')
  })
})
