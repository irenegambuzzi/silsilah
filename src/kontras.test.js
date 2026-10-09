// Rasio kontras warna (WCAG), dihitung dari token warna di index.css:
// teks utama diusahakan AAA (7:1), teks lain minimal AA (4,5:1), garis,
// simbol, dan fokus minimal 3:1. Berlaku untuk tampilan biasa dan kontras
// tinggi, termasuk setiap warna kartu di bagan.
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
  ['bahaya', 'latar', 7, 'tulisan tombol hapus (bergaris merah, latar krem)'],
  ['emas-teks', 'latar', 4.5, 'tulisan emas (judul) di latar halaman'],
  ['emas-teks', 'kertas', 4.5, 'tulisan emas (judul kecil) di kotak'],
  ['emas', 'latar', 3, 'bingkai emas (kartu pangkal, terpilih) di latar'],
  ['sukses', 'kertas', 4.5, 'status hijau di bilah atas bagan'],
  ['garis-bagan', 'latar', 3, 'garis ke anak di bagan'],
  ['hati', 'latar', 3, 'garis pernikahan di bagan'],
  ['hati', 'kertas', 3, 'ikon hati (lingkaran putih)'],
  // Kartu orang di bagan: nama (teks) dan label (redup) di setiap latar kartu.
  ...['k-tl-latar', 'k-tp-latar', 'k-pl-latar', 'k-pp-latar', 'k-x-latar', 'k-pangkal-latar'].flatMap((latar) => [
    ['teks', latar, 7, `nama di kartu (${latar})`],
    ['redup', latar, 7, `label kecil di kartu (${latar})`],
  ]),
  // Tunas daun "belum dewasa" di pojok kartu (anak yang masih hidup), dan
  // tepi nomor urut (redup) di setiap latar kartu: penanda grafis ≥ 3:1.
  ...['k-tl-latar', 'k-tp-latar', 'k-pl-latar', 'k-pp-latar', 'k-x-latar', 'k-pangkal-latar'].map((latar) => [
    'sukses', latar, 3, `tunas daun di kartu (${latar})`,
  ]),
  ['hati', 'kertas', 3, 'hati patah (berpisah) di lingkaran putih'],
  // Simbol ♂/♀ di lingkaran putih.
  ...['k-tl-simbol', 'k-tp-simbol', 'k-pl-simbol', 'k-pp-simbol', 'k-x-simbol', 'emas-teks', 'k-pangkal-wafat'].map((simbol) => [
    simbol, 'kertas', 4.5, `simbol ${simbol} di lingkaran putih`,
  ]),
  // Kartu wafat: tulisan terang, simbol biru/pink terang.
  ['k-wafat-teks', 'k-wafat', 7, 'nama di kartu keturunan wafat'],
  ['k-wafat-redup', 'k-wafat', 7, 'label kecil di kartu keturunan wafat'],
  ['k-wafat-teks', 'k-wafat-pasangan', 7, 'nama di kartu pasangan wafat'],
  ...['k-wafat-simbol-l', 'k-wafat-simbol-p', 'k-wafat-simbol-x'].flatMap((simbol) => [
    [simbol, 'k-wafat', 3, `simbol ${simbol} di kartu keturunan wafat`],
    [simbol, 'k-wafat-pasangan', 3, `simbol ${simbol} di kartu pasangan wafat`],
  ]),
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
