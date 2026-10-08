// @vitest-environment jsdom
// Aturan tulisan (tinjauan Irene, Oktober 2026): keluarga besar mudah
// tersinggung oleh kesalahan kecil, jadi setiap tulisan harus tepat, sopan,
// dan tidak membingungkan. Diperiksa di semua teks (teks/id.js), di layar
// yang tampil, dan di label silsilah untuk SETIAP orang di keluarga fiktif.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { configure, screen } from '@testing-library/react'
import { pasang } from './test/pembantu.jsx'
import { klienKeluarga } from './test/klienKeluarga.js'
import { buatKlienTiruan } from './test/klienTiruan.js'
import { teks } from './teks/id.js'
import { bangunKeluargaFiktif } from './lib/silsilah/keluargaFiktif.js'
import { susunSilsilah } from './lib/silsilah/silsilah.js'
import { labelDetail, labelKartu } from './lib/silsilah/kartu.js'
import { susunDaftar } from './lib/silsilah/daftar.js'
import { pasanganBerurutan } from './lib/silsilah/urutan.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

// Kata yang sama dua kali berturut-turut ("Menikah Menikah", "di di").
const KATA_GANDA = /(?<![\p{L}\p{N}])(\p{L}+)[\s·:,]+\1(?![\p{L}\p{N}])/iu
// Penomoran, istilah teknis, dan kalimat lama yang tidak boleh tampil lagi.
const TERLARANG = [
  /Pernikahan ke-\d/,
  /Generasi ke-\d+ \(/, // harus "Putu · Generasi ke-2", bukan "Generasi ke-2 (Putu)"
  /Menikah · Menikah/,
  /Kedua orang tua adalah keturunan/,
  /Jalur terdekat|Jalur lain|Lewat jalur ini|Orang tua lain/,
  /\b(undefined|null|NaN)\b|\[object/,
  /\b(partner[12]?|union|tree_id|GEN\.null)\b/i,
]
const lagiGanda = /\blagi\b[^.!?]*\blagi\b/i

function semuaTeks(o, jalur = 'teks') {
  if (typeof o === 'string') return [[jalur, o]]
  if (Array.isArray(o)) return o.flatMap((x, i) => semuaTeks(x, `${jalur}[${i}]`))
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => semuaTeks(v, `${jalur}.${k}`))
  return []
}

// Teks layar per elemen (judul, tombol, paragraf, baris), seperti yang
// dibaca orang. Kata ganda dicari di dalam setiap elemen.
function teksLayar() {
  const hasil = []
  for (const elemen of document.body.querySelectorAll('*')) {
    if (elemen.closest('script, style, svg')) continue
    const t = [...elemen.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    if (t) hasil.push(elemen.textContent.replace(/\s+/g, ' ').trim())
  }
  return hasil
}

describe('semua teks di teks/id.js', () => {
  const daftar = semuaTeks(teks)
  it('ada banyak teks yang diperiksa', () => expect(daftar.length).toBeGreaterThan(300))
  it.each(daftar)('%s: tanpa kata ganda dan tanpa "lagi … lagi" dalam satu kalimat', (_jalur, isi) => {
    expect(isi).not.toMatch(KATA_GANDA)
    expect(isi).not.toMatch(lagiGanda)
  })
  it('tanpa penomoran, istilah teknis, atau kalimat lama yang dilarang', () => {
    for (const [jalur, isi] of daftar) for (const re of TERLARANG) expect(isi, jalur).not.toMatch(re)
  })
})

const s = susunSilsilah(bangunKeluargaFiktif())
const utama = [...s.graf.orang.values()].filter((o) => (o.tree_id ?? null) === null).map((o) => o.id)

describe('label silsilah untuk SETIAP orang di keluarga fiktif', () => {
  it('satu pernikahan (satu pasangan): tanpa "ke-1"; lebih dari satu: "Istri/Suami ke-n"', () => {
    for (const id of utama) {
      const d = labelDetail(s, id)
      const jumlah = pasanganBerurutan(s.graf.pernikahan.get(id) ?? [], id).length
      for (const p of d.pasangan) {
        if (jumlah === 1) expect(p.ke, id).toBeNull()
        else expect(p.ke, id).toMatch(/^(Istri|Suami|Pasangan) ke-\d+$/)
      }
      expect(JSON.stringify(d), id).not.toMatch(/Pernikahan ke-|Menikah · Menikah/)
    }
  })

  it('tanpa kata ganda di keterangan siapa pun', () => {
    for (const id of utama) {
      const d = labelDetail(s, id)
      const tulisan = [d.nama, d.subjudul, ...d.urutan, d.lewat, ...d.pasangan.map((p) => `${p.ke ?? ''} ${p.nama} ${p.waktu}`), d.lahir, d.wafat]
      for (const t of tulisan.filter(Boolean)) {
        expect(t, id).not.toMatch(KATA_GANDA)
        for (const re of TERLARANG) expect(t, id).not.toMatch(re)
      }
    }
  })

  it('"Anak sambung"/"Anak angkat" hanya di keterangan anak itu, tidak di keterangan orang tuanya dan tidak di Daftar', () => {
    let diperiksa = 0
    for (const c of s.graf.tautan.values()) {
      for (const t of c) {
        if (t.kind === 'kandung') continue
        diperiksa++
        expect(labelDetail(s, t.child_id).orangTua.some((o) => /sambung|angkat/i.test(o.jenis ?? ''))).toBe(true)
        const u = s.graf.unions.get(t.union_id)
        for (const p of [u.partner1_id, u.partner2_id].filter(Boolean)) {
          expect(JSON.stringify(labelDetail(s, p)), p).not.toMatch(/sambung|angkat/i)
        }
      }
    }
    expect(diperiksa).toBeGreaterThan(0)
    expect(JSON.stringify(susunDaftar(s))).not.toMatch(/sambung|angkat/i)
  })

  it('kartu tidak memuat tahun atau "anak ke-n"; kartu pasangan tanpa label', () => {
    for (const id of utama) {
      const k = labelKartu(s, id)
      const tampil = [k.nama, k.label, k.pojok].filter(Boolean).join(' ')
      expect(tampil, id).not.toMatch(/\d{4}|anak ke-|istri ke-|suami ke-|pasangan dari/i)
      if (k.jenis === 'pasangan') expect([k.label, k.pojok], id).toEqual([null, null])
    }
  })
})

describe('tulisan di layar', () => {
  const LAYAR = [
    ['Masuk', '/masuk', () => buatKlienTiruan({}), 'Silsilah Keluarga'],
    ['Privasi', '/privasi', () => buatKlienTiruan({}), 'Privasi'],
    ['Beranda', '/', klienKeluarga, 'Silsilah keluarga saat ini berisi'],
    ['Bagan', '/bagan', klienKeluarga, 'Hasna'],
    ['Daftar', '/daftar', klienKeluarga, 'Tamran'],
    ['Saya', '/saya', klienKeluarga, 'Ukuran huruf'],
    ...['bima', 'cahya', 'eka', 'vino', 'yoga', 'hasna', 'nirvo', 'raksa', 'gendis', 'oka'].map((id) => [
      `Keterangan ${id}`, `/orang/${id}`, klienKeluarga, 'Informasi Anggota',
    ]),
    ...['bima', 'eka', 'hasna'].map((id) => [`Panel bagan ${id}`, `/bagan?pilih=${id}`, klienKeluarga, 'Informasi Anggota']),
  ]
  it.each(LAYAR)('%s: tanpa kata ganda, penomoran yang tidak perlu, atau istilah teknis', async (_nama, url, klien, jangkar) => {
    pasang(url, klien())
    await screen.findAllByText(new RegExp(jangkar))
    const tulisan = teksLayar()
    expect(tulisan.length).toBeGreaterThan(5)
    for (const t of tulisan) {
      expect(t.match(KATA_GANDA)?.[0] ?? null, t).toBeNull()
      for (const re of TERLARANG) expect(t).not.toMatch(re)
    }
  })
})
