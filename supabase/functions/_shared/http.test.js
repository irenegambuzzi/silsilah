// Bagian HTTP Edge Function, dengan layanan tiruan (tanpa database).
import { describe, expect, it, vi } from 'vitest'
import { ambilIp, buatPenangan } from './http.js'
import { GalatLayanan } from './penukaran.js'

const layananKosong = () => ({ rpc: vi.fn(), auth: {} })
const minta = (opsi = {}) =>
  new Request('https://contoh.invalid/functions/v1/pakai-undangan', { method: 'POST', ...opsi })

describe('buatPenangan', () => {
  it('OPTIONS (CORS) dijawab tanpa menyentuh layanan', async () => {
    const ambil = vi.fn(layananKosong)
    const res = await buatPenangan('undangan', ambil)(minta({ method: 'OPTIONS', headers: { origin: 'https://x.invalid' } }))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(ambil).not.toHaveBeenCalled()
  })

  it('kalau daftar asal diatur, hanya asal itu yang diizinkan', async () => {
    const p = buatPenangan('undangan', layananKosong, { asal: ['https://keluarga.invalid'] })
    const boleh = await p(minta({ method: 'OPTIONS', headers: { origin: 'https://keluarga.invalid' } }))
    expect(boleh.headers.get('access-control-allow-origin')).toBe('https://keluarga.invalid')
    const tidak = await p(minta({ method: 'OPTIONS', headers: { origin: 'https://lain.invalid' } }))
    expect(tidak.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('selain POST ditolak (pratinjau link dengan GET tidak berbuat apa pun)', async () => {
    const ambil = vi.fn(layananKosong)
    const res = await buatPenangan('undangan', ambil)(new Request('https://contoh.invalid/x', { method: 'GET' }))
    expect(res.status).toBe(405)
    expect(await res.json()).toEqual({ ok: false, alasan: 'permintaan_salah' })
    expect(ambil).not.toHaveBeenCalled()
  })

  it.each([
    ['bukan JSON', 'token='],
    ['tanpa isian', '{}'],
    ['isian bukan teks', '{"token": 123}'],
    ['isian kode di fungsi undangan', '{"kode": "ABCD-2345"}'],
    ['terlalu panjang', JSON.stringify({ token: 'a'.repeat(5000) })],
  ])('isi salah (%s) → 400', async (_n, body) => {
    const res = await buatPenangan('undangan', layananKosong)(minta({ body }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, alasan: 'permintaan_salah' })
  })

  it('jawaban tidak disimpan di cache', async () => {
    const res = await buatPenangan('kode', layananKosong)(minta({ body: '{"kode":"x"}' }))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: false, alasan: 'format_salah' })
  })

  it('galat apa pun → 500 "server"; yang dicatat hanya langkah dan kode, tanpa token atau pesan server', async () => {
    const token = 'R'.repeat(43)
    const catat = vi.fn()
    const rusak = { rpc: async () => ({ data: null, error: { code: 'XX000', message: `bocor ${token}` } }), auth: {} }
    const res = await buatPenangan('undangan', () => rusak, { catat })(minta({ body: JSON.stringify({ token }) }))
    expect(res.status).toBe(500)
    const teks = await res.text()
    expect(JSON.parse(teks)).toEqual({ ok: false, alasan: 'server' })
    expect(teks).not.toContain(token)
    expect(catat).toHaveBeenCalledWith({ langkah: 'edge_check_redemption', kode: 'XX000' })
    expect(JSON.stringify(catat.mock.calls)).not.toContain(token)
  })

  it('pengaturan kurang (kunci server belum diisi) → 500 "server", tidak mati', async () => {
    const catat = vi.fn()
    const p = buatPenangan('undangan', () => { throw new Error('pengaturan') }, { catat })
    const res = await p(minta({ body: JSON.stringify({ token: 'R'.repeat(43) }) }))
    expect(res.status).toBe(500)
    expect(catat).toHaveBeenCalledWith({ langkah: 'Error', kode: null })
  })

  it('GalatLayanan tidak menyimpan pesan server', () => {
    const g = new GalatLayanan('createUser', { status: 500, message: 'rahasia server' })
    expect(g.message).toBe('createUser')
    expect(JSON.stringify(g)).not.toContain('rahasia server')
  })
})

describe('ambilIp', () => {
  const hdr = (x) => new Headers(x)
  it('cf-connecting-ip lebih dulu, lalu alamat pertama x-forwarded-for', () => {
    expect(ambilIp(hdr({ 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '198.51.100.1' }))).toBe('203.0.113.1')
    expect(ambilIp(hdr({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1')
    expect(ambilIp(hdr({}))).toBeNull()
  })
})
