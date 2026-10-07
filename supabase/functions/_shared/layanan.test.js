import { describe, expect, it, vi } from 'vitest'
import { ambilKunciServer, buatAmbilLayanan, layananDariKlien, opsiDariEnv } from './layanan.js'

const env = (isi) => ({ get: (k) => isi[k] })

describe('pengaturan Edge Function', () => {
  it('kunci server: KUNCI_SERVER, lalu SUPABASE_SECRET_KEYS, lalu tidak ada', () => {
    expect(ambilKunciServer(env({ KUNCI_SERVER: 'a', SUPABASE_SECRET_KEYS: '{"x":"b"}' }))).toBe('a')
    expect(ambilKunciServer(env({ SUPABASE_SECRET_KEYS: '{"x":"b"}' }))).toBe('b')
    expect(ambilKunciServer(env({ SUPABASE_SECRET_KEYS: 'bukan json' }))).toBeNull()
    expect(ambilKunciServer(env({}))).toBeNull()
  })

  it('klien dibuat sekali, tanpa menyimpan sesi; tanpa kunci → galat (menjadi 500)', () => {
    const createClient = vi.fn(() => ({ rpc: vi.fn(), auth: { admin: { tanda: 1 } } }))
    const ambil = buatAmbilLayanan(createClient, env({ SUPABASE_URL: 'https://contoh.invalid', KUNCI_SERVER: 'k' }))
    expect(ambil().auth).toEqual({ tanda: 1 })
    ambil()
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient.mock.calls[0][2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false })
    expect(() => buatAmbilLayanan(createClient, env({ SUPABASE_URL: 'https://contoh.invalid' }))()).toThrow('pengaturan')
  })

  it('daftar asal dari ASAL_APLIKASI (dipisah koma)', () => {
    expect(opsiDariEnv(env({ ASAL_APLIKASI: ' https://a.invalid , https://b.invalid,' })).asal)
      .toEqual(['https://a.invalid', 'https://b.invalid'])
    expect(opsiDariEnv(env({})).asal).toEqual([])
  })
})

describe('layananDariKlien', () => {
  const klien = (over = {}) => ({
    rpc: vi.fn(),
    auth: { admin: {}, getClaims: vi.fn(async () => ({ data: { claims: { sub: 'akun', session_id: 'sesi' } }, error: null })) },
    storage: { from: vi.fn(() => ({ download: vi.fn(async () => ({ data: new Blob([new Uint8Array(4)]), error: null })) })) },
    ...over,
  })

  it('data lokasi diambil dari Storage privat project ini (bucket lokasi-ip), bukan dari layanan luar', async () => {
    const k = klien()
    await layananDariKlien(k).cariLokasi('192.0.2.1')
    expect(k.storage.from).toHaveBeenCalledWith('lokasi-ip')
  })

  it('token diperiksa dengan getClaims; tanpa session_id atau galat → null', async () => {
    expect(await layananDariKlien(klien()).verifikasiToken('t')).toEqual({ userId: 'akun', sessionId: 'sesi' })
    const tanpaSesi = klien({ auth: { admin: {}, getClaims: async () => ({ data: { claims: { sub: 'akun' } }, error: null }) } })
    expect(await layananDariKlien(tanpaSesi).verifikasiToken('t')).toBeNull()
    const galat = klien({ auth: { admin: {}, getClaims: async () => ({ data: null, error: { message: 'x' } }) } })
    expect(await layananDariKlien(galat).verifikasiToken('t')).toBeNull()
  })
})
