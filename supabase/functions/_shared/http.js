// Bagian HTTP Edge Function pakai-undangan dan pakai-kode: CORS, hanya
// POST, isi JSON kecil, alamat IP, dan galat yang tidak pernah membocorkan
// isi server. Hanya memakai Request/Response standar (ada di Deno dan Node).

import { GalatLayanan, tukar } from './penukaran.js'
import { cekPerangkat } from './cek-perangkat.js'

const BATAS_ISI = 2000

// Alamat IP pengirim, untuk batas percobaan dan log. cf-connecting-ip
// dipasang ulang oleh Cloudflare di depan Supabase; x-forwarded-for hanya
// cadangan. Header bisa saja dipalsukan di jalur yang tidak memasangnya
// ulang, karena itu batas percobaan kode juga punya batas untuk SEMUA
// alamat sekaligus (SQL 009).
export function ambilIp(headers) {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const xff = headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() || null : null
}

function headerCors(req, asal) {
  const origin = req.headers.get('origin')
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  if (!asal?.length) h['Access-Control-Allow-Origin'] = '*'
  else if (origin && asal.includes(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

const json = (isi, status, cors) =>
  new Response(JSON.stringify(isi), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

// jenis: 'undangan' (isi { token }) atau 'kode' (isi { kode }).
// ambilLayanan(): { rpc, auth } — dipanggil saat permintaan masuk, supaya
// pengaturan yang kurang menjadi galat 500 biasa, bukan fungsi mati.
// opsi: { asal: [origin yang diizinkan] (kosong = semua), domainEmail, catat(galat) }
export function buatPenangan(jenis, ambilLayanan, opsi = {}) {
  const namaIsi = jenis === 'undangan' ? 'token' : 'kode'
  return async (req) => {
    const cors = headerCors(req, opsi.asal)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ ok: false, alasan: 'permintaan_salah' }, 405, cors)

    let rahasia
    try {
      const teks = await req.text()
      if (teks.length > BATAS_ISI) throw new Error('terlalu panjang')
      rahasia = JSON.parse(teks)?.[namaIsi]
    } catch {
      rahasia = undefined
    }
    if (typeof rahasia !== 'string') return json({ ok: false, alasan: 'permintaan_salah' }, 400, cors)

    try {
      const konteks = {
        ip: ambilIp(req.headers),
        userAgent: req.headers.get('user-agent') ?? '',
        domainEmail: opsi.domainEmail,
      }
      return json(await tukar(jenis, rahasia, konteks, ambilLayanan()), 200, cors)
    } catch (galat) {
      return galatServer(galat, opsi, cors)
    }
  }
}

// Hanya nama langkah dan kodenya yang dicatat; tidak pernah token, kode,
// atau pesan server.
function galatServer(galat, opsi, cors) {
  const dikenal = galat instanceof GalatLayanan
  opsi.catat?.({ langkah: dikenal ? galat.message : (galat?.name ?? null), kode: dikenal ? galat.kode : null })
  return json({ ok: false, alasan: 'server' }, 500, cors)
}

// Edge Function cek-perangkat: POST dengan header Authorization: Bearer
// <token login perangkat ini>. Isi permintaan tidak dipakai.
export function buatPenanganCekPerangkat(ambilLayanan, opsi = {}) {
  return async (req) => {
    const cors = headerCors(req, opsi.asal)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return json({ ok: false, alasan: 'permintaan_salah' }, 405, cors)
    const token = /^Bearer\s+(\S{1,4000})$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? null
    try {
      const konteks = { ip: ambilIp(req.headers), userAgent: req.headers.get('user-agent') ?? '' }
      const hasil = await cekPerangkat(token, konteks, ambilLayanan())
      return json(hasil, hasil.ok ? 200 : 401, cors)
    } catch (galat) {
      return galatServer(galat, opsi, cors)
    }
  }
}
