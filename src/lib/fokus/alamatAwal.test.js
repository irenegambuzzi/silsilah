import { describe, expect, it } from 'vitest'
import { hashTanpaFokus } from './alamatAwal.js'

describe('aplikasi dibuka baru: tanpa fokus cabang', () => {
  it.each([
    ['#/bagan?fokus=lorvan', '#/bagan'],
    ['#/bagan?fokus=lorvan&hitung=cabang', '#/bagan'],
    ['#/bagan?fokus=lorvan&hitung=cabang&pilih=yoga', '#/bagan?pilih=yoga'],
    ['#/bagan?hitung=cabang', '#/bagan'],
  ])('%s → %s', (hash, harapan) => {
    expect(hashTanpaFokus(hash)).toBe(harapan)
  })
  it.each(['', '#/', '#/bagan', '#/bagan?pilih=yoga', '#/daftar', `#/u/${'A'.repeat(43)}`])('%s: tidak diubah', (hash) => {
    expect(hashTanpaFokus(hash)).toBeNull()
  })
})
