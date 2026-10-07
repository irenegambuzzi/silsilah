// @vitest-environment jsdom
// Aksesibilitas: struktur setiap layar diperiksa dengan axe-core (label,
// peran, judul, daftar, tautan), tombol dan isian punya nama, tombol
// berukuran besar, dan semua teks yang tampil berbahasa Indonesia.
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { pasang } from './test/pembantu.jsx'
import { OK, buatKlienTiruan, klienSudahMasuk } from './test/klienTiruan.js'
import { tampaknyaInggris } from './lib/galat.js'

const TOKEN = 'Q'.repeat(43)
const perangkat = (id, sesi) => ({
  id, member_id: 'anggota-1', session_id: sesi, label: 'iPhone · Safari', device_type: 'iPhone', via: 'undangan', expires_at: null,
  approx_city: 'Kota Contoh', approx_country: 'ID', approx_country_name: 'Indonesia', created_at: '2026-10-01T03:00:00Z', last_seen_at: null, revoked_at: null,
})
const masuk = (tambahan = {}) => klienSudahMasuk({
  rpc: { db_version: async () => OK('999'), create_device_code: async () => OK({ code: 'ABCD-2345', expires_at: new Date(Date.now() + 600000).toISOString() }) },
  tabel: { devices: [perangkat('d1', 'sesi-ini'), perangkat('d2', 'sesi-lain')] },
  ...tambahan,
})

// [nama, url, klien, jangkar (teks yang harus muncul dulu)]
const LAYAR = [
  ['Masuk', '/masuk', () => buatKlienTiruan({}), 'Silsilah Keluarga'],
  ['Link undangan', `/u/${TOKEN}`, () => buatKlienTiruan({}), 'Link undangan pribadi'],
  ['Link undangan terpotong', '/u/pendek', () => buatKlienTiruan({}), 'Link undangan pribadi'],
  ['Kode dari QR', '/kode/ABCD2345', () => buatKlienTiruan({}), 'Masuk dengan kode'],
  ['Selamat datang', '/selamat-datang', () => masuk(), 'Apakah ini Anda?'],
  ['Beranda', '/', () => masuk(), 'Beranda'],
  ['Saya', '/saya', () => masuk(), 'Tampilan'],
  ['Keluar', '/saya/keluar', () => masuk(), 'Keluar dari perangkat ini'],
  ['Tambah perangkat', '/saya/tambah-perangkat', () => masuk(), 'ABCD-2345'],
  ['Perangkat saya', '/saya/perangkat', () => masuk(), 'Laptop'],
  ['Privasi', '/privasi', () => buatKlienTiruan({}), 'Privasi'],
  ['Halaman tidak ada', '/tidak-ada', () => buatKlienTiruan({}), 'Halaman tidak ditemukan'],
  ['Aplikasi belum siap', '/masuk', () => null, 'Aplikasi belum siap'],
]

async function tunggu(jangkar) {
  await screen.findAllByText((t) => t.includes(jangkar) || jangkar === 'Laptop', {}, { timeout: 3000 }).catch(() => {})
  if (jangkar === 'Laptop') await screen.findAllByText('iPhone · Safari')
  await new Promise((r) => setTimeout(r, 50))
}

describe.each(LAYAR)('layar %s', (_nama, url, buatKlien, jangkar) => {
  it('lolos pemeriksaan struktur axe (tanpa kontras: itu dihitung terpisah)', async () => {
    pasang(url, buatKlien())
    await tunggu(jangkar)
    const hasil = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    })
    expect(hasil.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })

  it('punya tepat satu judul utama; semua tombol, tautan, dan isian bernama', async () => {
    pasang(url, buatKlien())
    await tunggu(jangkar)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const elemen of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
      expect((elemen.textContent || elemen.getAttribute('aria-label') || '').trim(), elemen.outerHTML.slice(0, 80)).not.toBe('')
    }
    for (const elemen of screen.queryAllByRole('textbox')) {
      expect(elemen.labels.length, elemen.outerHTML.slice(0, 80)).toBeGreaterThan(0)
    }
  })

  it('tombol besar (≥ 48px: kelas min-h-12 = 3rem ≥ 54px) dan isian berlabel', async () => {
    pasang(url, buatKlien())
    await tunggu(jangkar)
    const kecil = [...document.querySelectorAll('main button:not(.sr-only), main a.inline-flex')]
      .filter((elemen) => !/\bmin-h-1[2-9]\b|\bmin-h-\[/.test(elemen.className) && !elemen.closest('nav'))
    // Tautan teks biasa (mis. "Privasi") boleh lebih kecil tetapi punya min-h-12 di kelasnya.
    expect(kecil.map((elemen) => elemen.outerHTML.slice(0, 90))).toEqual([])
    for (const isian of document.querySelectorAll('input:not([type=radio])')) {
      expect(isian.labels?.length, isian.outerHTML.slice(0, 60)).toBeGreaterThan(0)
    }
  })

  it('semua teks yang tampil berbahasa Indonesia (tanpa kata Inggris)', async () => {
    pasang(url, buatKlien())
    await tunggu(jangkar)
    const tampil = document.body.textContent.replace(/MODE CONTOH/g, '')
    expect(tampaknyaInggris(tampil), tampil.slice(0, 200)).toBe(false)
  })
})

describe('struktur umum', () => {
  it('bahasa halaman Indonesia, dan ada tombol "Langsung ke isi halaman" untuk papan ketik', async () => {
    pasang('/masuk', buatKlienTiruan({}))
    await screen.findByRole('heading', { name: 'Silsilah Keluarga' })
    expect(screen.getByRole('button', { name: 'Langsung ke isi halaman' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
  })
  it('navigasi bawah (sesudah masuk) berlabel, dengan teks + ikon, dan menandai halaman aktif', async () => {
    pasang('/saya', masuk())
    await screen.findByText('Tampilan')
    const nav = screen.getByRole('navigation', { name: 'Menu utama' })
    const aktif = nav.querySelector('[aria-current="page"]')
    expect(aktif.textContent).toBe('Saya')
    expect(nav.querySelectorAll('svg[aria-hidden="true"]').length).toBe(2)
  })
  it('judul layar menerima fokus saat layar terbuka (pembaca layar langsung membacakannya)', async () => {
    pasang('/saya', masuk())
    const judul = await screen.findByRole('heading', { name: 'Saya', level: 1 })
    expect(document.activeElement).toBe(judul)
  })
})
