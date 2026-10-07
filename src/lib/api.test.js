import { describe, expect, it, vi } from 'vitest'
import { bacaSessionId, jalankanMasuk, verifikasiTautanMasuk, zonaWaktu } from './api.js'
import { GALAT, OK, buatKlienTiruan, tokenTiruan } from '../test/klienTiruan.js'

describe('verifikasiTautanMasuk', () => {
  it('berhasil dengan tipe "magiclink" → tidak mencoba tipe lain', async () => {
    const klien = buatKlienTiruan({})
    await verifikasiTautanMasuk(klien, 'hash-1')
    expect(klien.panggilanKe('auth', 'verifyOtp').map((p) => p.isi.type)).toEqual(['magiclink'])
  })
  it('"magiclink" ditolak → mencoba tipe "email"', async () => {
    let n = 0
    const klien = buatKlienTiruan({
      verifyOtp: async () => (++n === 1 ? GALAT('otp_expired', 'x', 403) : OK({ session: { access_token: tokenTiruan('s'), user: { id: 'u' } } })),
    })
    await verifikasiTautanMasuk(klien, 'hash-2')
    expect(klien.panggilanKe('auth', 'verifyOtp').map((p) => p.isi.type)).toEqual(['magiclink', 'email'])
  })
  it('keduanya ditolak → galat terakhir dilempar', async () => {
    const klien = buatKlienTiruan({ verifyOtp: async () => GALAT('otp_expired', 'x', 403) })
    await expect(verifikasiTautanMasuk(klien, 'hash-3')).rejects.toMatchObject({ code: 'otp_expired' })
  })
})

describe('jalankanMasuk', () => {
  const siap = (hasil) => buatKlienTiruan({
    fungsi: { 'pakai-undangan': async () => OK(hasil), 'pakai-kode': async () => OK(hasil) },
    rpc: { claim_device: async () => OK({ via: 'undangan', expires_at: '2026-10-07T09:00:00Z' }) },
  })
  it('penolakan: tidak membuat sesi dan tidak mendaftarkan perangkat', async () => {
    const klien = siap({ ok: false, alasan: 'kedaluwarsa' })
    expect(await jalankanMasuk(klien, 'undangan', 'x')).toEqual({ ok: false, alasan: 'kedaluwarsa' })
    expect(klien.panggilanKe('auth', 'verifyOtp')).toEqual([])
    expect(klien.panggilanKe('rpc', 'claim_device')).toEqual([])
  })
  it('jawaban tanpa alasan dianggap gangguan server', async () => {
    expect(await jalankanMasuk(siap({}), 'kode', 'ABCD2345')).toEqual({ ok: false, alasan: 'server' })
  })
  it('berhasil: kode dikirim sudah dirapikan; waktu berakhir akses sementara diteruskan', async () => {
    const klien = siap({ ok: true, token_hash: 'h', tiket: 't', nama: 'Bu Contoh' })
    expect(await jalankanMasuk(klien, 'kode', 'abcd-2345')).toEqual({ ok: true, nama: 'Bu Contoh', via: 'undangan', berakhir: '2026-10-07T09:00:00Z' })
    expect(klien.panggilanKe('fungsi', 'pakai-kode')[0].isi).toEqual({ kode: 'ABCD2345' })
  })
})

describe('bacaSessionId', () => {
  it('mengambil session_id dari token tanpa menyimpan atau mencatatnya', async () => {
    const klien = buatKlienTiruan({ sesi: { access_token: tokenTiruan('sesi-abc') } })
    expect(await bacaSessionId(klien)).toBe('sesi-abc')
  })
  it('tanpa sesi atau token rusak → null', async () => {
    expect(await bacaSessionId(buatKlienTiruan({}))).toBeNull()
    expect(await bacaSessionId(buatKlienTiruan({ sesi: { access_token: 'rusak' } }))).toBeNull()
  })
})

describe('zonaWaktu', () => {
  it('berbentuk Wilayah/Kota atau null, dan lolos pemeriksaan claim_device', () => {
    const z = zonaWaktu()
    expect(z === null || /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(z)).toBe(true)
    vi.restoreAllMocks()
  })
})
