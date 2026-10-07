// Rasio kontras warna (WCAG), dihitung dari token warna di index.css:
// teks utama diusahakan AAA (7:1), teks lain minimal AA (4,5:1), garis dan
// fokus minimal 3:1. Berlaku untuk tampilan biasa dan kontras tinggi.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.join(import.meta.dirname, 'index.css'), 'utf8')

function token(blok) {
  const isi = blok.match(/\{([^}]*)\}/)[1]
  return Object.fromEntries([...isi.matchAll(/--c-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]))
}
const biasa = token(css.match(/:root\s*\{[^}]*\}/)[0])
const tinggi = { ...biasa, ...token(css.match(/html\[data-kontras='tinggi'\]\s*\{[^}]*\}/)[0]) }

const kecerahan = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const rasio = (a, b) => {
  const [x, y] = [kecerahan(a), kecerahan(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// [teks, latar, minimal, keterangan]
const PASANGAN = [
  ['teks', 'latar', 7, 'teks utama di latar halaman'],
  ['teks', 'kertas', 7, 'teks utama di kartu'],
  ['redup', 'latar', 7, 'teks pendukung di latar halaman'],
  ['redup', 'kertas', 7, 'teks pendukung di kartu'],
  ['utama-teks', 'utama', 7, 'tulisan tombol utama'],
  ['bahaya-teks', 'bahaya', 7, 'tulisan tombol bahaya'],
  ['info-teks', 'info', 7, 'kotak informasi'],
  ['peringatan-teks', 'peringatan', 7, 'kotak peringatan'],
  ['garis', 'latar', 3, 'garis tepi kotak dan isian di latar halaman'],
  ['garis', 'kertas', 3, 'garis tepi di kartu'],
  ['fokus', 'latar', 3, 'tanda fokus papan ketik'],
  ['fokus', 'kertas', 3, 'tanda fokus di kartu'],
  ['utama', 'latar', 3, 'tombol utama terhadap latar'],
  ['bahaya', 'kertas', 3, 'tepi tombol/kotak bahaya'],
]

describe.each([
  ['tampilan biasa', biasa],
  ['kontras tinggi', tinggi],
])('kontras warna: %s', (_nama, warna) => {
  it.each(PASANGAN)('%s di %s ≥ %s:1 (%s)', (a, b, minimal) => {
    expect(warna[a], `token ${a}`).toBeTruthy()
    expect(warna[b], `token ${b}`).toBeTruthy()
    expect(rasio(warna[a], warna[b])).toBeGreaterThanOrEqual(minimal)
  })
})

describe('ukuran huruf dan gerakan', () => {
  it('huruf dasar 18px, dengan pilihan Besar dan Sangat besar yang lebih besar', () => {
    expect(css).toMatch(/html\s*\{\s*font-size:\s*18px;/)
    const besar = Number(css.match(/data-ukuran='besar'\]\s*\{\s*font-size:\s*(\d+)px/)[1])
    const sangat = Number(css.match(/data-ukuran='sangatBesar'\]\s*\{\s*font-size:\s*(\d+)px/)[1])
    expect(besar).toBeGreaterThan(18)
    expect(sangat).toBeGreaterThan(besar)
  })
  it('menghormati prefers-reduced-motion dan fokus selalu terlihat', () => {
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*4px solid var\(--c-fokus\)/)
  })
  it('ukuran di komponen memakai rem/Tailwind (ikut berubah), bukan piksel tetap', () => {
    const dir = path.join(import.meta.dirname)
    const berkas = fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(jsx)$/.test(f) && !/\.test\./.test(f))
    for (const f of berkas) {
      const isi = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(isi, f).not.toMatch(/text-\[\d+px\]|font-size:\s*\d+px/)
    }
  })
})
