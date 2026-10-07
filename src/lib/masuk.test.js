import { describe, expect, it } from 'vitest'
import { pesanPenukaran } from './masuk.js'
import { tampaknyaInggris } from './galat.js'
import { teks } from '../teks/id.js'
import { ALASAN } from '../../supabase/functions/_shared/penukaran.js'

describe('pesanPenukaran', () => {
  it('setiap alasan dari Edge Function punya pesan Indonesia sendiri', () => {
    for (const jenis of ['undangan', 'kode']) {
      for (const alasan of ALASAN[jenis]) {
        const pesan = pesanPenukaran(jenis, alasan)
        expect(pesan, `${jenis}.${alasan}`).not.toBe(teks.galat.tidakDikenal)
        expect(tampaknyaInggris(pesan)).toBe(false)
      }
    }
  })
  it('tidak ada pesan yatim (alasan yang tidak pernah dikembalikan)', () => {
    for (const jenis of ['undangan', 'kode']) {
      expect(Object.keys(teks.masuk[jenis]).filter((k) => !ALASAN[jenis].includes(k))).toEqual([])
    }
  })
  it('pesan sesuai PLAN.md bagian 6.2', () => {
    expect(pesanPenukaran('undangan', 'sudah_dipakai')).toBe('Link ini sudah dipakai. Kalau Anda belum pernah masuk, hubungi admin keluarga.')
    expect(pesanPenukaran('undangan', 'kedaluwarsa')).toBe('Link ini sudah kedaluwarsa. Mintalah link baru kepada admin.')
  })
  it('alasan tidak dikenal tidak pernah ditampilkan apa adanya', () => {
    expect(pesanPenukaran('undangan', 'something_weird')).toBe(teks.galat.tidakDikenal)
    expect(pesanPenukaran('undangan', 'toString')).toBe(teks.galat.tidakDikenal)
    expect(pesanPenukaran('lain', 'salah')).toBe(teks.galat.tidakDikenal)
    expect(pesanPenukaran('kode', undefined)).toBe(teks.galat.tidakDikenal)
  })
})
