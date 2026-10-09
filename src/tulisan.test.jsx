// @vitest-environment jsdom
// Aturan tulisan (tinjauan Irene, Oktober 2026): keluarga besar mudah
// tersinggung oleh kesalahan kecil, jadi setiap tulisan harus tepat, sopan,
// dan tidak membingungkan. Diperiksa di semua teks (teks/id.js), di layar
// yang tampil, dan di label silsilah untuk SETIAP orang di keluarga fiktif.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
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
  /Anak ke-\d/, // harus "Putra ke-n" / "Putri ke-n"
  /cerai/i, // pernikahan yang berakhir selalu ditulis "Berpisah"
  /tempat sampah/i, // istilahnya "Disisihkan" / "Data yang disisihkan"
  /Urutan lahir:/, // cukup kalimat "Putri ke-3 dari 11 bersaudara"
  /Informasi Anggota/i, // judulnya "Keterangan Pribadi"
  /Pasangan: Tidak ada/,
  /Generasi ke-\d+ \(/, // harus "Putu · Generasi ke-2", bukan "Generasi ke-2 (Putu)"
  /Menikah · Menikah/,
  /Kedua orang tua adalah keturunan/,
  /Nomor silsilah|\bNo\. \d/i, // nomor silsilah hanya untuk mengurutkan Daftar, tidak pernah tampil
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
      const tulisan = [d.nama, d.subjudul, ...d.urutan, d.lewat, ...d.pasangan.map((p) => `${p.ke ?? ''} ${p.nama ?? teks.detail.pasanganTidakDiketahui} ${p.waktu ?? ''}`), d.lahir, d.wafat]
      for (const t of tulisan.filter(Boolean)) {
        expect(t, id).not.toMatch(KATA_GANDA)
        for (const re of TERLARANG) expect(t, id).not.toMatch(re)
      }
    }
  })

  it('anak sambung/angkat: "Anak sambung/angkat [nama]" di keterangannya sendiri, tanpa nomor di keterangan orang tuanya, dan tidak di Daftar', () => {
    let diperiksa = 0
    for (const c of s.graf.tautan.values()) {
      for (const t of c) {
        if (t.kind === 'kandung') continue
        diperiksa++
        const d = labelDetail(s, t.child_id)
        expect(d.urutan.some((u) => /^Anak (sambung|angkat) \S/.test(u)), t.child_id).toBe(true)
        const u = s.graf.unions.get(t.union_id)
        // Di keterangan orang tua yang bukan orang tua kandungnya: tanpa nomor, dengan kata lembut.
        const bukanKandung = t.kind === 'angkat' ? [u.partner1_id, u.partner2_id] : [t.biological_parent === 'partner2' ? u.partner1_id : u.partner2_id]
        for (const p of bukanKandung.filter(Boolean)) {
          const a = labelDetail(s, p).anak.find((x) => x.id === t.child_id)
          expect(a, p).toMatchObject({ ke: null, jenis: `anak ${t.kind}` })
        }
      }
    }
    expect(diperiksa).toBeGreaterThan(0)
    expect(JSON.stringify(susunDaftar(s))).not.toMatch(/sambung|angkat/i)
  })

  it('tidak ada "Wafat" untuk yang masih hidup, dan "Belum menikah" hanya kalau dipilih sendiri', () => {
    for (const id of utama) {
      const d = labelDetail(s, id)
      const o = s.graf.orang.get(id)
      if (!o.is_deceased) expect(d.sudahWafat, id).toBe(false)
      if (o.marital_choice !== 'belum_menikah') expect(d.statusPernikahan, id).not.toBe('Belum menikah')
    }
  })

  it('"Putra/Putri ke-n" hanya untuk anak kandung, dan tidak pernah "Anak ke-n"', () => {
    for (const id of utama) {
      const d = labelDetail(s, id)
      expect(JSON.stringify(d), id).not.toMatch(/Anak ke-/)
      for (const a of d.anak) if (a.ke == null) expect(a.jenis, `${id} → ${a.id}`).toMatch(/^anak (sambung|angkat)$/)
    }
  })

  it('kartu tidak memuat tahun atau "anak ke-n"; kartu pasangan hanya label "Pasangan", tanpa GEN', () => {
    for (const id of utama) {
      const k = labelKartu(s, id)
      const tampil = [k.nama, k.label, k.pojok].filter(Boolean).join(' ')
      expect(tampil, id).not.toMatch(/\d{4}|anak ke-|istri ke-|suami ke-|pasangan dari/i)
      if (k.jenis === 'pasangan') expect([k.label, k.pojok], id).toEqual(['Pasangan', null])
    }
  })
})

describe('pesan dari database (SQL) juga mengikuti aturan tulisan', () => {
  const folder = path.join(import.meta.dirname, '..', 'supabase')
  const pesan = fs.readdirSync(folder).filter((f) => /^\d{3}_.*\.sql$/.test(f)).flatMap((f) =>
    [...fs.readFileSync(path.join(folder, f), 'utf8').matchAll(/private\.fail\('[A-Z]{2}\d{3}',\s*'([^']+)'/g)].map((m) => [f, m[1]]))
  it('ada banyak pesan yang diperiksa', () => expect(pesan.length).toBeGreaterThan(30))
  it.each(pesan)('%s: %s', (_f, isi) => {
    expect(isi).not.toMatch(/tempat sampah|cerai|Anak ke-\d/i)
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
    ...['bima', 'cahya', 'eka', 'vino', 'yoga', 'hasna', 'nirvo', 'raksa', 'gendis', 'oka', 'ika', 'tirwan', 'lintang', 'sekar', 'dara', 'halvin', 'ragil',
      'kirana', 'elvina', 'fajrin', 'putri', 'qori', 'umar'].map((id) => [
      `Keterangan ${id}`, `/orang/${id}`, klienKeluarga, 'Keterangan Pribadi',
    ]),
    ...['bima', 'eka', 'hasna'].map((id) => [`Panel bagan ${id}`, `/bagan?pilih=${id}`, klienKeluarga, 'Keterangan Pribadi']),
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
    // Keterangan orang: tidak ada baris "Wafat" (juga bukan "Wafat: -") untuk
    // yang masih hidup, dan tidak ada "Belum menikah" yang tidak dipilih
    // orangnya sendiri.
    const id = /\/orang\/([^/?]+)|pilih=([^&]+)/.exec(url)
    if (id) {
      const o = s.graf.orang.get(id[1] ?? id[2])
      const isi = document.body.textContent
      if (!o.is_deceased) expect(isi).not.toMatch(/Wafat:/)
      if (o.marital_choice !== 'belum_menikah') expect(isi).not.toMatch(/Belum menikah/)
    }
  })
})
