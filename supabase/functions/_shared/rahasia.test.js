import { describe, expect, it } from 'vitest'
import { BENTUK_KODE, BENTUK_TOKEN, rapikanKode, sha256Hex } from './rahasia.js'

describe('sha256Hex', () => {
  it('sesuai vektor uji resmi SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('rapikanKode dan bentuk kode', () => {
  it('huruf kecil, spasi, dan tanda hubung dirapikan', () => {
    expect(rapikanKode(' abcd-2345 ')).toBe('ABCD2345')
    expect(rapikanKode('AB CD 23 45')).toBe('ABCD2345')
    expect(rapikanKode(null)).toBe('')
  })
  it('hanya 8 karakter dari huruf/angka yang tidak mudah tertukar', () => {
    expect(BENTUK_KODE.test('ABCD2345')).toBe(true)
    for (const salah of ['ABCD234', 'ABCD23456', 'ABCD2340', 'ABCD2341', 'ABCDO345', 'ABCDI345', 'abcd2345']) {
      expect(BENTUK_KODE.test(salah), salah).toBe(false)
    }
  })
  it('token undangan: 43 karakter base64url', () => {
    expect(BENTUK_TOKEN.test('A'.repeat(43))).toBe(true)
    expect(BENTUK_TOKEN.test('A-_'.repeat(14) + 'z')).toBe(true)
    expect(BENTUK_TOKEN.test('A'.repeat(42))).toBe(false)
    expect(BENTUK_TOKEN.test('A'.repeat(42) + '=')).toBe(false)
    expect(BENTUK_TOKEN.test('A'.repeat(42) + '/')).toBe(false)
  })
})
