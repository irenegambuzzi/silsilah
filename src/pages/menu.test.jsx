// @vitest-environment jsdom
// Menu bawah saat peluncuran (putaran 8a, PLAN.md bagian 14): tepat tiga
// item Bagan · Pemberitahuan · Saya, Beranda dihapus ("/" langsung ke
// Bagan), dan pilihan "Bagan | Daftar" di Bagan dan Daftar. Semua data FIKTIF.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { configure, screen, waitFor, within } from '@testing-library/react'
import { lokasiSaatIni, pasang, tungguMasuk } from '../test/pembantu.jsx'
import { klienKeluarga } from '../test/klienKeluarga.js'
import { BERAT } from '../test/batasWaktu.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const menu = () => screen.getByRole('navigation', { name: 'Menu utama' })
const pilihan = () => screen.getByRole('group', { name: 'Tampilkan sebagai bagan atau daftar' })

describe('Beranda dihapus', () => {
  it('alamat "/" membuka Bagan (menggantikan, tanpa langkah tambahan)', BERAT, async () => {
    pasang('/', klienKeluarga())
    await tungguMasuk()
    expect(await screen.findByRole('button', { name: /Hasna/ })).toBeTruthy()
    expect(lokasiSaatIni.search).toBe('')
  })

  it('file Beranda.jsx tidak ada lagi; halaman yang tidak ada: "Kembali ke Bagan" (membawa fokus)', async () => {
    expect(fs.existsSync(path.join(import.meta.dirname, 'Beranda.jsx'))).toBe(false)
    pasang('/tidak-ada', klienKeluarga())
    const tautan = await screen.findByRole('link', { name: 'Kembali ke Bagan' })
    expect(tautan.getAttribute('href')).toBe('/bagan')
  })

  it('tidak ada kata "Beranda" di layar mana pun yang dibuka dari menu', BERAT, async () => {
    const h = pasang('/bagan', klienKeluarga())
    await screen.findByRole('button', { name: /Hasna/ })
    for (const nama of ['Pemberitahuan', 'Saya', 'Bagan']) {
      await h.aksi.click(within(menu()).getByRole('link', { name: nama }))
      await waitFor(() => expect(within(menu()).getByRole('link', { name: nama }).getAttribute('aria-current')).toBe('page'))
      expect(document.body.textContent).not.toMatch(/Beranda|Kotak masuk/i)
    }
  })
})

describe('menu bawah', () => {
  it('Pemberitahuan: judul halaman dan nama menu; alamat tetap /kotak-masuk', async () => {
    pasang('/kotak-masuk', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Pemberitahuan', level: 1 })).toBeTruthy()
    const item = within(menu()).getByRole('link', { name: 'Pemberitahuan' })
    expect(item.getAttribute('href')).toBe('/kotak-masuk')
    expect(item.getAttribute('aria-current')).toBe('page')
  })

  it('menu Bagan membawa fokus yang sedang aktif', BERAT, async () => {
    pasang('/bagan?fokus=lorvan', klienKeluarga())
    await screen.findByText('Menampilkan satu cabang: Lorvan')
    await waitFor(() => expect(within(menu()).getByRole('link', { name: 'Bagan' }).getAttribute('href')).toBe('/bagan?fokus=lorvan'))
  })
})

describe('pilihan "Bagan | Daftar"', () => {
  it('di Daftar: di bagian paling atas halaman, dua tombol ≥ 48 px berjarak 8 px, Daftar aktif (aria-current dan tanda ✓, bukan hanya warna)', BERAT, async () => {
    pasang('/daftar', klienKeluarga())
    await screen.findByRole('heading', { name: 'Daftar', level: 1 })
    const g = pilihan()
    expect(screen.getByRole('main').firstElementChild).toBe(g)
    expect(g.className).toMatch(/\bgap-2\b/)
    const [bagan, daftar] = within(g).getAllByRole('link')
    expect([bagan.textContent, daftar.textContent]).toEqual(['Bagan', 'Daftar'])
    for (const t of [bagan, daftar]) expect(t.className).toMatch(/\bmin-h-12\b/)
    expect(daftar.getAttribute('aria-current')).toBe('page')
    expect(bagan.getAttribute('aria-current')).toBeNull()
    expect(daftar.querySelector('svg')).toBeTruthy()
    expect(bagan.querySelector('svg')).toBeNull()
    expect(daftar.className).toMatch(/\bborder-4\b/)
    expect(daftar.className).toMatch(/\bunderline\b/)
  })

  it('di Bagan: di bilah atas, baris sendiri di bawah pencarian di HP (w-full), Bagan aktif', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await screen.findByRole('button', { name: /Hasna/ })
    const g = pilihan()
    const cari = screen.getByRole('search')
    // Tepat sesudah kolom cari, selebar bilah di HP (tidak menyempitkan kolom cari).
    expect(cari.nextElementSibling).toBe(g)
    expect(g.className).toMatch(/(^| )w-full( |$)/)
    expect(g.className).toMatch(/\bsm:w-auto\b/)
    expect(within(g).getByRole('link', { name: 'Bagan' }).getAttribute('aria-current')).toBe('page')
  })

  it('fokus cabang ikut terbawa ke dua arah', BERAT, async () => {
    const { aksi } = pasang('/bagan?fokus=lorvan&hitung=cabang', klienKeluarga())
    await screen.findByText('Generasi dihitung dari Lorvan')
    await aksi.click(within(pilihan()).getByRole('link', { name: 'Daftar' }))
    await screen.findByRole('heading', { name: 'Daftar', level: 1 })
    expect(screen.getByText('Generasi dihitung dari Lorvan')).toBeTruthy()
    expect(within(menu()).getByRole('link', { name: 'Bagan' }).getAttribute('aria-current')).toBe('page')
    const keBagan = within(pilihan()).getByRole('link', { name: 'Bagan' })
    expect(keBagan.getAttribute('href')).toBe('/bagan?fokus=lorvan&hitung=cabang')
    await aksi.click(keBagan)
    expect(await screen.findByText('Generasi dihitung dari Lorvan')).toBeTruthy()
    expect(lokasiSaatIni.pathname).toBe('/bagan')
  })
})
