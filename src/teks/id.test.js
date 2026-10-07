import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { teks } from './id.js'
import { tampaknyaInggris } from '../lib/galat.js'

// Nilai null (misalnya anak kandung tidak diberi keterangan) dilewati.
const semuaTeks = (nilai, jalur = 'teks') =>
  nilai === null
    ? []
    : typeof nilai === 'string'
      ? [[jalur, nilai]]
      : Object.entries(nilai).flatMap(([k, v]) => semuaTeks(v, `${jalur}.${k}`))

describe('teks/id.js', () => {
  const daftar = semuaTeks(teks)

  it('memuat teks (pelindung supaya tes di bawah tidak kosong)', () => {
    expect(daftar.length).toBeGreaterThan(150)
  })

  it('tidak ada teks kosong atau berspasi di ujung', () => {
    const buruk = daftar.filter(([, t]) => t.length === 0 || t !== t.trim())
    expect(buruk).toEqual([])
  })

  it('tidak ada kata bahasa Inggris di teks mana pun', () => {
    const inggris = daftar.filter(([, t]) => tampaknyaInggris(t))
    expect(inggris).toEqual([])
  })

  it('kalimat pesan berakhir dengan tanda baca', () => {
    const pesan = daftar.filter(([j]) => /^teks\.galat\.(?!standar\.|batasan\.|kode\.|duaLangkah\.)[a-zA-Z]+$/.test(j) || /^teks\.galat\.(standar|batasan|kode|duaLangkah)\./.test(j))
    const tanpaTitik = pesan.filter(([, t]) => !/[.!?"]$/.test(t))
    expect(tanpaTitik).toEqual([])
  })

  it('teks silsilah tetap lengkap (dipakai label kartu)', () => {
    expect(teks.silsilah.bulan).toHaveLength(12)
    expect(teks.silsilah.almL).toBe('Alm.')
    expect(teks.silsilah.almP).toBe('Almh.')
  })

  it('kode kita di file SQL semuanya punya pesan, dan batasan data entri juga', () => {
    const dir = path.join(import.meta.dirname, '../../supabase')
    const sql = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f) && !f.includes('ROLLBACK'))
      .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
    const kode = new Set(sql.flatMap(([, s]) => [...s.matchAll(/private\.fail\('([A-Z]{2}\d{3})'/g)].map((m) => m[1])))
    expect(kode.size).toBeGreaterThan(40)
    expect([...kode].filter((k) => !teks.galat.kode[k])).toEqual([])
    // Tidak ada pesan yang yatim (kode di teks tapi sudah tidak ada di SQL).
    expect(Object.keys(teks.galat.kode).filter((k) => !kode.has(k))).toEqual([])

    const dasar = sql.find(([f]) => f.startsWith('002'))[1] + sql.find(([f]) => f.startsWith('004'))[1]
    const batasan = new Set([
      ...[...dasar.matchAll(/constraint\s+([a-z_]+)\s+(?:check|unique)/g)].map((m) => m[1]),
      ...[...dasar.matchAll(/create unique index if not exists\s+([a-z_]+)/g)].map((m) => m[1]),
    ])
    expect(batasan.size).toBeGreaterThan(15)
    expect([...batasan].filter((b) => !teks.galat.batasan[b])).toEqual([])
    // Nama batasan di teks harus benar-benar ada di SQL (menangkap salah ketik).
    expect(Object.keys(teks.galat.batasan).filter((b) => !batasan.has(b))).toEqual([])
  })
})
