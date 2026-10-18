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

// Ukuran dan jumlah baris yang terpilih per kartu: Mega, Ratrisa Kemuntari,
// Sadevan Bramasta Wiratmaja, S.T., Hj. Selvarani …, S.Pd., Alm. H.
// Bagaskara …, S.H., Ratrisa Anindya Maharsi Wijayakusuma.
// Enam kartu pertama tidak berubah sejak putaran 7b; kartu ketujuh (nama
// sangat panjang + gelar terpanjang, putaran 7c-2) selalu terkecil, 3 baris.
const TERPILIH = {
  A: ['besar 1', 'besar 1', 'besar 2', 'besar 3', 'besar 3', 'sedang 2', 'terkecil 3'],
  B: ['besar 1', 'besar 2', 'besar 2', 'sedang 3', 'sedang 3', 'sedang 2', 'terkecil 3'],
  C: ['besar 1', 'besar 2', 'besar 2', 'sedang 3', 'sedang 3', 'kecil 2', 'terkecil 3'],
  D: ['besar 1', 'besar 2', 'besar 2', 'sedang 3', 'sedang 3', 'kecil 2', 'terkecil 3'],
  E: ['besar 1', 'besar 2', 'sedang 2', 'kecil 3', 'kecil 3', 'terkecil 2', 'terkecil 3'],
}
// Langkah untuk kartu ketujuh: A dan B aturan biasa, C gelar dikecilkan, D dan E ukuran hitungan.
const LANGKAH_TERPANJANG = { A: 'biasa', B: 'biasa', C: 'gelar-kecil', D: 'dihitung', E: 'dihitung' }

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

  it('di mode contoh: lima pilihan, masing-masing tujuh kartu dalam bingkai HP (390 px) dan biasa', BERAT, async () => {
    await pasangApp('/contoh/ukuran', { contoh: true })
    expect(await screen.findByRole('heading', { name: 'Perbandingan ukuran nama kartu' })).toBeTruthy()
    const bagian = await screen.findAllByRole('region', { name: /^[A-E] / })
    expect(bagian.map((b) => b.dataset.pilihan)).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const [i, b] of bagian.entries()) {
      const hp = b.querySelector('[data-bingkai="hp"]')
      expect(hp.className).toContain('w-[390px]')
      for (const bingkai of [hp, b.querySelector('[data-bingkai="biasa"]')]) {
        const kartu = [...bingkai.querySelectorAll('[data-orang]')]
        expect(kartu.map((k) => k.dataset.orang)).toEqual(['mega', 'ratrisa-k', 'sadevan-b', 'selvarani', 'bagaskara', 'ratrisa-a', 'wirabhumi'])
        const mega = kartu[0].querySelector('.kartu-nama')
        expect(parseFloat(mega.style.getPropertyValue('--ukuran-nama'))).toBeCloseTo(PILIHAN_UKURAN[i].ukuran.besar, 6)
        // Aturan Bagan (putaran 7b, bagian B): ukuran terbesar yang muat, dan jumlah barisnya.
        const hasil = kartu.map((k) => {
          const n = k.querySelector('.kartu-nama').dataset
          return `${n.ukuran} ${n.baris}`
        })
        expect(hasil, b.dataset.pilihan).toEqual(TERPILIH[b.dataset.pilihan])
        const t = kartu[6].querySelector('.kartu-nama').dataset
        const langkah = t.dihitung ? 'dihitung' : t.gelarPindah ? 'gelar-pindah' : t.gelarKecil ? 'gelar-kecil' : 'biasa'
        expect(langkah, b.dataset.pilihan).toBe(LANGKAH_TERPANJANG[b.dataset.pilihan])
        // Enam kartu lain tidak pernah memakai langkah baru.
        for (const k of kartu.slice(0, 6)) expect(k.querySelector('[data-gelar-kecil], [data-gelar-pindah], [data-dihitung]')).toBeNull()
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
