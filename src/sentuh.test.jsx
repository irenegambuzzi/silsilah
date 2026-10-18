// @vitest-environment jsdom
// Mudah disentuh dan aman di iPhone (putaran 8a, bagian 4). jsdom tidak
// punya tata letak, jadi yang diuji kelas ukuran minimum dan aturan safe
// area; ukuran sungguhan dilihat di HP (putaran 8d). Semua data FIKTIF.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { configure, fireEvent, screen, within } from '@testing-library/react'
import { pasang } from './test/pembantu.jsx'
import { klienKeluarga } from './test/klienKeluarga.js'
import { buatKlienTiruan } from './test/klienTiruan.js'
import { BERAT } from './test/batasWaktu.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const baca = (...p) => fs.readFileSync(path.join(import.meta.dirname, ...p), 'utf8')

// Kelas yang menjamin tinggi ≥ 48 px (1rem ≥ 18 px, jadi 3rem ≥ 54 px).
const TINGGI = /\bmin-h-1[2-9]\b|\bsize-1[2-9]\b|\bisian\b|\bkartu-orang\b|\bbagan-catatan\b/
// Lebar ≥ 48 px: kelas lebar minimum, lebar penuh/fleksibel, atau unsur blok
// (`flex`, bukan `inline-flex`) yang selebar wadahnya (item menu bawah di
// sepertiga lebar layar, pilihan ukuran huruf di kolom), atau sasaran
// bertulisan panjang.
const LEBAR = /\bmin-w-1[2-9]\b|\bsize-1[2-9]\b|\bw-full\b|\bflex-1\b|\bisian\b|\bkartu-orang\b|\bbagan-catatan\b|(^| )flex( |$)/

// Semua yang bisa diketuk dan terlihat (tanpa tombol sr-only "Langsung ke isi").
function sasaran() {
  return [...document.querySelectorAll('button, a[href], select, input:not([type=radio]), label:has(input[type=radio])')].filter(
    (e) => !e.classList.contains('sr-only') && !e.closest('.sr-only')
  )
}
function periksa(nama) {
  const daftar = sasaran()
  expect(daftar.length, nama).toBeGreaterThan(0)
  for (const e of daftar) {
    const kelas = e.className?.baseVal ?? e.className
    const ciri = `${nama}: ${e.outerHTML.slice(0, 110)}`
    expect(kelas, ciri).toMatch(TINGGI)
    // Sasaran tanpa tulisan (ikon saja) atau bertulisan pendek wajib punya lebar minimum.
    const tulisan = (e.textContent ?? '').trim()
    if (tulisan.length < 6) expect(kelas, ciri).toMatch(LEBAR)
  }
}

const LAYAR = [
  ['Masuk', '/masuk', () => buatKlienTiruan({}), 'Silsilah Keluarga'],
  ['Privasi', '/privasi', () => buatKlienTiruan({}), 'Privasi'],
  ['Bagan', '/bagan', klienKeluarga, 'Hasna'],
  ['Bagan dengan panel', '/bagan?pilih=bima', klienKeluarga, 'Keterangan Pribadi'],
  ['Bagan saat fokus dengan "Hitung dari"', '/bagan?fokus=lorvan&hitung=cabang', klienKeluarga, 'Generasi dihitung dari'],
  ['Daftar', '/daftar', klienKeluarga, 'Tamran'],
  ['Halaman orang', '/orang/kirana', klienKeluarga, 'Keterangan Pribadi'],
  ['Halaman orang dengan ibu sambung', '/orang/galen', klienKeluarga, 'Ibu sambung'],
  ['Saya', '/saya', klienKeluarga, 'Tampilan'],
  ['Pemberitahuan', '/kotak-masuk', klienKeluarga, 'Belum ada pemberitahuan'],
  ['Halaman tidak ada', '/tidak-ada', klienKeluarga, 'Halaman tidak ditemukan'],
  ['Selamat datang', '/selamat-datang', klienKeluarga, 'Apakah ini Anda?'],
  ['Keluar', '/saya/keluar', klienKeluarga, 'Keluar dari perangkat ini'],
  ['Kode dari QR', '/kode/ABCD2345', () => buatKlienTiruan({}), 'Masuk dengan kode'],
  ['Link undangan terpotong', '/u/pendek', () => buatKlienTiruan({}), 'Link undangan pribadi'],
]

describe('semua yang bisa diketuk minimal 48 × 48 px', () => {
  it.each(LAYAR)('%s', BERAT, async (nama, url, klien, jangkar) => {
    pasang(url, klien())
    await screen.findAllByText((t) => t.includes(jangkar))
    periksa(nama)
  })

  it('hasil pencarian di Bagan: setiap hasil ≥ 48 px dan berjarak 8 px', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await screen.findByRole('button', { name: /Hasna/ })
    const kolom = screen.getByRole('combobox')
    fireEvent.focus(kolom)
    fireEvent.change(kolom, { target: { value: 'sadevan' } })
    const daftar = await screen.findByRole('listbox')
    expect(daftar.className).toMatch(/\bflex-col\b/)
    expect(daftar.className).toMatch(/\bgap-2\b/)
    for (const h of within(daftar).getAllByRole('option')) expect(h.className).toMatch(/\bmin-h-12\b/)
  })

  it('legenda tertutup dan bilah atas tersembunyi: tombol bulat 48 px', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await screen.findByRole('button', { name: /Hasna/ })
    await aksi.click(screen.getByRole('button', { name: 'Sembunyikan menu bagan' }))
    const legenda = screen.queryByRole('button', { name: 'Sembunyikan keterangan' })
    if (legenda) await aksi.click(legenda)
    periksa('Bagan tanpa bilah')
  })
})

describe('jarak minimal 8 px antara dua sasaran yang bersebelahan', () => {
  it('menu bawah, pita fokus, dan nama di panel', BERAT, async () => {
    pasang('/bagan?fokus=lorvan&hitung=cabang', klienKeluarga())
    await screen.findByText('Generasi dihitung dari Lorvan')
    expect(screen.getByRole('navigation', { name: 'Menu utama' }).querySelector('ul').className).toMatch(/\bgap-2\b/)
    // Pita fokus: "Kembali ke leluhur utama" dan "Keluar dari fokus" (juga saat turun baris).
    const pita = document.querySelector('[data-keluar-fokus]').parentElement
    expect(pita.className).toMatch(/\bgap-x-3\b/)
    expect(pita.className).toMatch(/\bgap-y-2\b/)
    // Pilihan "Bagan | Daftar" dan tombol perbesar/perkecil.
    expect(screen.getByRole('group', { name: 'Tampilkan sebagai bagan atau daftar' }).className).toMatch(/\bgap-2\b/)
    expect(screen.getByRole('button', { name: 'Perbesar' }).parentElement.className).toMatch(/\bgap-2\b/)
  })

  it('nama yang bisa diketuk di panel: kotak 48 px dengan my-1 (8 px antarbaris)', BERAT, async () => {
    pasang('/orang/galen', klienKeluarga())
    await screen.findByText('Ibu sambung', { exact: false })
    const nama = screen.getByRole('link', { name: 'Kirana' })
    for (const k of ['inline-flex', 'min-h-12', 'min-w-12', 'my-1']) expect(nama.className.split(' ')).toContain(k)
  })

  it('tombol ✕ di bilah atas Bagan tidak menempel pada tombol lain di layar lebar (sm:pr-16)', () => {
    expect(baca('pages', 'Bagan.jsx')).toMatch(/p-4 pr-14 sm:mr-auto sm:pr-16/)
  })
})

describe('poni dan bilah gestur iPhone', () => {
  it('index.html: viewport-fit=cover, dan cubit untuk memperbesar TIDAK dimatikan', () => {
    const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8')
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(html)[1]
    expect(viewport).toContain('viewport-fit=cover')
    expect(viewport).not.toMatch(/user-scalable|maximum-scale|minimum-scale/)
  })

  it('index.css: aturan safe area untuk atas, kiri, kanan, dan bawah (nilai cadangan 0, jadi komputer tidak berubah)', () => {
    const css = baca('index.css')
    const aturan = (kelas) => new RegExp(`\\.${kelas} \\{([^}]*)\\}`).exec(css)?.[1] ?? ''
    expect(aturan('kerangka-aman')).toMatch(/padding-top: env\(safe-area-inset-top, 0px\)/)
    expect(aturan('kerangka-aman')).toMatch(/padding-left: env\(safe-area-inset-left, 0px\)/)
    expect(aturan('kerangka-aman')).toMatch(/padding-right: env\(safe-area-inset-right, 0px\)/)
    expect(aturan('bawah-aman')).toMatch(/padding-bottom: env\(safe-area-inset-bottom, 0px\)/)
    expect(aturan('bawah-aman-luar')).toMatch(/margin-bottom: env\(safe-area-inset-bottom, 0px\)/)
  })

  it('bingkai halaman (spanduk, bilah atas, tombol menu Bagan, pita fokus, legenda di dalamnya) dan menu bawah memakai safe area', BERAT, async () => {
    pasang('/bagan?fokus=lorvan', klienKeluarga())
    await screen.findByText('Menampilkan satu cabang: Lorvan')
    const bingkai = screen.getByRole('main').parentElement
    expect(bingkai.className.split(' ')).toContain('kerangka-aman')
    const legenda = () => screen.queryByRole('region', { name: 'Keterangan warna' }) ?? screen.getByRole('button', { name: 'Tampilkan keterangan warna' })
    for (const unsur of [screen.getByRole('search'), document.querySelector('[data-keluar-fokus]'), legenda()]) {
      expect(bingkai.contains(unsur)).toBe(true)
    }
    // Tombol menu Bagan (saat bilah atas disembunyikan).
    fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan menu bagan' }))
    expect(bingkai.contains(screen.getByRole('button', { name: 'Tampilkan menu bagan' }))).toBe(true)
    // Spanduk mode contoh, akses sementara, dan offline ada sebelum <main>, di dalam bingkai yang sama.
    expect(baca('App.jsx')).toMatch(/<Kerangka\s+spanduk=/)
    expect(baca('components', 'layout', 'Kerangka.jsx')).toMatch(/kerangka-aman[^\n]*\n[\s\S]*\{spanduk\}[\s\S]*<BannerAksesSementara[\s\S]*<SpandukData \/>[\s\S]*<main/)
    expect(screen.getByRole('navigation', { name: 'Menu utama' }).className.split(' ')).toContain('bawah-aman')
  })

  it('sebelum masuk: footer Privasi menjauh dari bilah gestur', async () => {
    pasang('/masuk', buatKlienTiruan({}))
    await screen.findByRole('heading', { name: 'Silsilah Keluarga' })
    expect(screen.getByRole('contentinfo').className.split(' ')).toContain('bawah-aman-luar')
  })

  it('isi halaman tidak tertutup menu bawah: menu ada di alur halaman (sticky, bukan fixed) sesudah isi', async () => {
    pasang('/saya', klienKeluarga())
    await screen.findByRole('heading', { name: 'Saya', level: 1 })
    const nav = screen.getByRole('navigation', { name: 'Menu utama' })
    expect(nav.className).toMatch(/\bsticky\b/)
    expect(nav.className).not.toMatch(/\bfixed\b/)
    expect(screen.getByRole('main').nextElementSibling).toBe(nav)
    expect(screen.getByRole('main').className).toMatch(/\bpb-8\b/)
  })

  it('cubit untuk memperbesar hanya ditangani sendiri di Bagan (touch-none hanya di bingkai Bagan)', () => {
    const kode = (folder) =>
      fs.readdirSync(folder, { withFileTypes: true }).flatMap((f) => {
        const p = path.join(folder, f.name)
        if (f.isDirectory()) return kode(p)
        return /\.(jsx?|css)$/.test(f.name) && !/\.test\./.test(f.name) ? [p] : []
      })
    const pakai = kode(import.meta.dirname).filter((p) => /touch-none|touch-action:\s*none/.test(fs.readFileSync(p, 'utf8')))
    expect(pakai.map((p) => path.relative(import.meta.dirname, p))).toEqual([path.join('pages', 'Bagan.jsx')])
  })
})
