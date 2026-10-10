// @vitest-environment jsdom
// Halaman perbandingan huruf nama kartu (SEMENTARA, putaran keenam, bagian E):
// hanya di mode contoh, tiga deretan kartu yang sama, huruf dibundel lokal.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { klienKeluarga } from '../test/klienKeluarga.js'

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

describe('halaman perbandingan huruf', () => {
  it('di luar mode contoh: tidak ada', async () => {
    await pasangApp('/contoh/huruf', { contoh: false })
    expect(await screen.findByText('Halaman tidak ditemukan', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Perbandingan huruf nama kartu')).toBeNull()
  })

  it('di mode contoh: deretan kartu yang sama tiga kali (Cinzel, Marcellus, Lora), dengan aturan nama yang sama', async () => {
    await pasangApp('/contoh/huruf', { contoh: true })
    expect(await screen.findByRole('heading', { name: 'Perbandingan huruf nama kartu' })).toBeTruthy()
    const bagian = await screen.findAllByRole('region', { name: /^\([abc]\)/ })
    expect(bagian.map((b) => b.dataset.huruf)).toEqual(['cinzel', 'marcellus', 'lora'])
    const deret = bagian.map((b) =>
      [...b.querySelectorAll('[data-orang]')].map((k) => [k.dataset.orang, k.querySelector('.kartu-nama').dataset.ukuran])
    )
    expect(deret[0]).toHaveLength(11)
    expect(deret[1]).toEqual(deret[0])
    expect(deret[2]).toEqual(deret[0])
    // 1, 2, 3, 4 kata, dengan dan tanpa gelar, termasuk kartu wafat yang gelap.
    const k = within(bagian[0])
    expect(k.getByText('Ratrisa Kemuntari')).toBeTruthy()
    expect(bagian[0].querySelector('[data-orang="bagaskara"]').dataset.warna).toBe('keturunan-wafat')
    expect(new Set(deret[0].map(([, u]) => u))).toEqual(new Set(['besar', 'sedang', 'kecil']))
  })

  it('huruf dari paket yang dibundel (seperti Cinzel), tanpa alamat luar; Bagan tetap Cinzel', () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, 'perbandinganHuruf.css'), 'utf8')
    expect(css).toMatch(/@import '@fontsource\/marcellus\/400\.css'/)
    expect(css).toMatch(/@import '@fontsource\/lora\/600\.css'/)
    expect(css).not.toMatch(/https?:|googleapis/)
    const utama = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8')
    expect(utama).not.toMatch(/marcellus|lora/i)
    expect(utama).toMatch(/--font-judul: 'Cinzel'/)
  })
})
