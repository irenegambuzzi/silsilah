// @vitest-environment jsdom
// Halaman perbandingan ukuran nama kartu (SEMENTARA, putaran ketujuh, bagian
// 5): hanya di mode contoh, pilihan A–E, bingkai selebar HP dan biasa.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { klienKeluarga } from '../test/klienKeluarga.js'
import { BERAT } from '../test/batasWaktu.js'
import { PILIHAN_UKURAN, teksPilihan } from './pilihanUkuran.js'
import { UKURAN_NAMA } from '../lib/bagan/barisNama.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function pasangApp(url, { contoh }) {
  vi.resetModules()
  if (contoh) vi.stubEnv('VITE_MODE_CONTOH', '1')
  const { default: App } = await import('../App.jsx')
  const Router = ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  render(<App Router={Router} klien={klienKeluarga()} />)
}

describe('halaman perbandingan ukuran nama', () => {
  it('pilihan A = ukuran Bagan sekarang; B–E: tingkat besar +1 … +4 px, sedang dan kecil dengan perbandingan sama', () => {
    expect(PILIHAN_UKURAN.map((p) => p.huruf)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(PILIHAN_UKURAN[0].ukuran).toEqual(UKURAN_NAMA)
    PILIHAN_UKURAN.forEach((p, i) => {
      expect(p.ukuran.besar * 18).toBeCloseTo(UKURAN_NAMA.besar * 18 + i, 6)
      const kali = p.ukuran.besar / UKURAN_NAMA.besar
      for (const t of ['sedang', 'kecil', 'terkecil']) expect(p.ukuran[t]).toBeCloseTo(UKURAN_NAMA[t] * kali, 9)
    })
    expect(PILIHAN_UKURAN.map(teksPilihan)).toEqual([
      'A (sekarang): besar 15,3 px, sedang 13,5 px, kecil 11,9 px',
      'B (+1 px): besar 16,3 px, sedang 14,4 px, kecil 12,7 px',
      'C (+2 px): besar 17,3 px, sedang 15,3 px, kecil 13,4 px',
      'D (+3 px): besar 18,3 px, sedang 16,1 px, kecil 14,2 px',
      'E (+4 px): besar 19,3 px, sedang 17 px, kecil 15 px',
    ])
  })

  it('di luar mode contoh: tidak ada, juga halaman huruf yang lama', async () => {
    await pasangApp('/contoh/ukuran', { contoh: false })
    expect(await screen.findByText('Halaman tidak ditemukan', { exact: false })).toBeTruthy()
    cleanup()
    await pasangApp('/contoh/huruf', { contoh: true })
    expect(await screen.findByText('Halaman tidak ditemukan', { exact: false })).toBeTruthy()
  })

  it('di mode contoh: lima pilihan, masing-masing enam kartu dalam bingkai HP (390 px) dan biasa', BERAT, async () => {
    await pasangApp('/contoh/ukuran', { contoh: true })
    expect(await screen.findByRole('heading', { name: 'Perbandingan ukuran nama kartu' })).toBeTruthy()
    const bagian = await screen.findAllByRole('region', { name: /^[A-E] / })
    expect(bagian.map((b) => b.dataset.pilihan)).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const [i, b] of bagian.entries()) {
      const hp = b.querySelector('[data-bingkai="hp"]')
      expect(hp.className).toContain('w-[390px]')
      for (const bingkai of [hp, b.querySelector('[data-bingkai="biasa"]')]) {
        const kartu = [...bingkai.querySelectorAll('[data-orang]')]
        expect(kartu.map((k) => k.dataset.orang)).toEqual(['mega', 'ratrisa-k', 'sadevan-b', 'selvarani', 'bagaskara', 'ratrisa-a'])
        const mega = kartu[0].querySelector('.kartu-nama')
        expect(parseFloat(mega.style.getPropertyValue('--ukuran-nama'))).toBeCloseTo(PILIHAN_UKURAN[i].ukuran.besar, 6)
      }
    }
  })

  it('paket huruf Cinzel tetap (judul), Marcellus dihapus, Lora ikut build produksi', () => {
    const paket = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'))
    expect(paket.dependencies['@fontsource/lora']).toBe('5.3.0')
    expect(paket.dependencies['@fontsource/cinzel']).toBe('5.3.0')
    expect({ ...paket.dependencies, ...paket.devDependencies }['@fontsource/marcellus']).toBeUndefined()
    expect(fs.existsSync(path.join(import.meta.dirname, 'PerbandinganHuruf.jsx'))).toBe(false)
  })
})
