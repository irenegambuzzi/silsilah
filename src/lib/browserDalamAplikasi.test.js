import { describe, expect, it } from 'vitest'
import { deteksiBrowserDalamAplikasi } from './browserDalamAplikasi.js'

const biasa = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  '',
]
const dalam = [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0', 'Instagram'],
  ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0]', 'Facebook'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]', 'Facebook'],
  ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 Line/14.0.0', 'LINE'],
  ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 musical_ly_32.0.0', 'TikTok'],
  ['Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36', 'aplikasi lain'],
]

describe('deteksiBrowserDalamAplikasi', () => {
  it.each(biasa)('browser biasa tidak dianggap tertanam: %s', (ua) => {
    expect(deteksiBrowserDalamAplikasi(ua)).toBeNull()
  })
  it.each(dalam)('%s', (ua, nama) => {
    expect(deteksiBrowserDalamAplikasi(ua)).toBe(nama)
  })
  it('masukan kosong tidak error', () => {
    expect(deteksiBrowserDalamAplikasi(undefined)).toBeNull()
    expect(deteksiBrowserDalamAplikasi(null)).toBeNull()
  })
})
