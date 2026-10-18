// Halaman uji ukuran nama dengan nama ASLI (SEMENTARA, HANYA LOKAL;
// putaran 7c, bagian B). Plugin Vite ini hanya dipasang oleh
// vite.uji-nama-asli.config.js (npm run uji:nama-asli), hanya saat server
// pengembangan (apply: 'serve'), dan tidak pernah dibundel ke aplikasi.
//
// Nama dibaca dari CSV di folder data pribadi SETIAP KALI halaman memintanya,
// lalu dikirim hanya ke 127.0.0.1 dengan "Cache-Control: no-store". Nama
// tidak pernah ditulis ke file, cache, atau folder lain, dan tidak pernah
// dicetak ke terminal atau log (galat pun hanya berupa pesan umum).
//
// Bentuk CSV: kolom "id" dan "data"; "data" berisi JSON pohon keluarga:
//   simpul orang: name, gender, deathDate, spouse (teks, atau { name,
//   deathDate }), marriages[] ({ spouse, status, children }), children[].
import fs from 'node:fs'
import path from 'node:path'

export const ALAMAT_DATA = '/__uji-nama-asli/data'

const LAKI = /^(l|lk|laki|laki-laki|laki laki|pria|male|m|man)$/i
const PEREMPUAN = /^(p|pr|perempuan|wanita|female|f|woman)$/i

const jenisKelamin = (nilai) => {
  const g = String(nilai ?? '').trim()
  return LAKI.test(g) ? 'L' : PEREMPUAN.test(g) ? 'P' : null
}
const lawan = (sex) => (sex === 'L' ? 'P' : sex === 'P' ? 'L' : null)
const ada = (v) => typeof v === 'string' && v.trim() !== ''

// Pohon JSON → daftar orang: keturunan (simpul) dan pasangan (spouse).
// Hasil: [{ nama, sex, sexDari: 'data' | 'perkiraan' | null, wafat, peran }].
// Jenis kelamin pasangan tidak ada di data: diperkirakan lawan dari
// pasangannya. Wafat: ada tanggal wafat (deathDate).
export function ratakanPohon(akar) {
  const hasil = []
  const kunjungi = (o) => {
    if (!o || typeof o !== 'object') return
    let sex = null
    if (ada(o.name)) {
      sex = jenisKelamin(o.gender)
      hasil.push({ nama: o.name.trim(), sex, sexDari: sex ? 'data' : null, wafat: ada(o.deathDate), peran: 'keturunan' })
    }
    const pasangan = new Set()
    for (const s of [o.spouse, ...(o.marriages ?? []).map((m) => m?.spouse)]) {
      const nama = typeof s === 'string' ? s : s?.name
      if (!ada(nama) || pasangan.has(nama.trim())) continue
      pasangan.add(nama.trim())
      const sexP = lawan(sex)
      hasil.push({ nama: nama.trim(), sex: sexP, sexDari: sexP ? 'perkiraan' : null, wafat: ada(s?.deathDate), peran: 'pasangan' })
    }
    for (const c of o.children ?? []) kunjungi(c)
    for (const m of o.marriages ?? []) for (const c of m?.children ?? []) kunjungi(c)
  }
  kunjungi(akar)
  return hasil
}

// Satu baris CSV sederhana dengan tanda kutip ganda (RFC 4180).
export function bacaCsv(teks) {
  const baris = []
  let sel = ''
  let deret = []
  let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const h = teks[i]
    if (kutip) {
      if (h === '"' && teks[i + 1] === '"') { sel += '"'; i++ }
      else if (h === '"') kutip = false
      else sel += h
    } else if (h === '"') kutip = true
    else if (h === ',') { deret.push(sel); sel = '' }
    else if (h === '\n' || h === '\r') {
      if (h === '\r' && teks[i + 1] === '\n') i++
      deret.push(sel); baris.push(deret); deret = []; sel = ''
    } else sel += h
  }
  if (sel !== '' || deret.length) { deret.push(sel); baris.push(deret) }
  return baris.filter((b) => b.some((s) => s !== ''))
}

// Semua orang dari CSV pertama di `folder`. Melempar galat umum (tanpa isi).
export function bacaOrang(folder) {
  const csv = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.csv')).sort()
  if (csv.length === 0) throw new Error('tidak ada CSV')
  const baris = bacaCsv(fs.readFileSync(path.join(folder, csv[0]), 'utf8').replace(/^﻿/, ''))
  const kolom = baris[0].map((k) => k.trim())
  const iData = kolom.indexOf('data')
  if (iData < 0) throw new Error('kolom data tidak ada')
  return baris.slice(1).flatMap((b) => ratakanPohon(JSON.parse(b[iData])))
}

// Permintaan langsung ke folder data pribadi ditolak DI SINI, sebelum Vite:
// penolakan Vite sendiri mencetak jalur file ke terminal, dan nama file di
// folder itu bisa memuat nama.
const keDataPribadi = (url) => {
  let jalur = String(url ?? '')
  try {
    jalur = decodeURIComponent(jalur)
  } catch {
    // tetap periksa bentuk mentahnya
  }
  return /data-pribadi/i.test(jalur)
}
export function tolakDataPribadi() {
  return (req, res, next) => {
    if (!keDataPribadi(req.url)) return next()
    res.statusCode = 403
    res.setHeader('Cache-Control', 'no-store')
    res.end()
  }
}

const dariKomputerIni = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)

// Middleware: GET ALAMAT_DATA → { orang: [...] }. Hanya untuk 127.0.0.1.
export function middlewareNamaAsli(folder) {
  return (req, res, next) => {
    if ((req.url ?? '').split('?')[0] !== ALAMAT_DATA) return next()
    const kirim = (status, isi) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(isi))
    }
    if (req.method !== 'GET' || !dariKomputerIni(req)) return kirim(403, { galat: 'Hanya dari komputer ini.' })
    try {
      kirim(200, { orang: bacaOrang(folder) })
    } catch {
      // Sengaja tanpa rincian: rincian bisa memuat isi data.
      kirim(500, { galat: 'Data tidak bisa dibaca.' })
    }
  }
}

export function ujiNamaAsli({ folder }) {
  return {
    name: 'uji-nama-asli',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(tolakDataPribadi())
      server.middlewares.use(middlewareNamaAsli(folder))
    },
  }
}
