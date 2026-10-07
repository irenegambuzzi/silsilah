// Membuat file data perkiraan lokasi (lokasi-ip.bin) dari CSV DB-IP
// "IP to City Lite" (https://db-ip.com, lisensi CC BY 4.0).
//
//   node scripts/lokasi-ip/buat-data.mjs <dbip-city-lite.csv[.gz]> <lokasi-ip.bin.gz> [--kota ID,IT] [--tanggal 2026-10]
//
// Keluaran berakhiran .gz dikompres (±2 MB; yang diunggah ke Storage privat
// bucket lokasi-ip sebagai lokasi-ip.bin.gz).
//
// Tingkat KOTA hanya untuk negara di --kota (bawaan Indonesia dan Italia);
// negara lain hanya tingkat NEGARA. Kota untuk semua negara (±76 MB) tidak
// muat di Storage paket gratis (maks. 50 MB per file) dan terlalu berat
// untuk Edge Function; ID+IT ±7 MB. Koordinat di CSV TIDAK diambil.
// Dipakai workflow bulanan di repo cadangan (langkah 1.28).

import fs from 'node:fs'
import readline from 'node:readline'
import zlib from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { urai6 } from '../../supabase/functions/_shared/ip.js'
import { susunDataLokasi } from '../../supabase/functions/_shared/lokasi.js'

export const KOTA_BAWAAN = ['ID', 'IT']
const MAKS64 = (1n << 64n) - 1n

// Satu baris CSV (kolom boleh berkutip, "" = kutip di dalam kolom).
export function uraiBarisCsv(baris) {
  const kolom = []
  let isi = ''
  let dalamKutip = false
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i]
    if (dalamKutip) {
      if (c === '"' && baris[i + 1] === '"') { isi += '"'; i++ } else if (c === '"') dalamKutip = false
      else isi += c
    } else if (c === '"') dalamKutip = true
    else if (c === ',') { kolom.push(isi); isi = '' } else isi += c
  }
  kolom.push(isi)
  return kolom
}

const ke4 = (teks) => teks.split('.').reduce((n, b) => n * 256 + Number(b), 0)
const ke128 = (teks) => urai6(teks).reduce((n, k) => (n << 16n) | BigInt(k), 0n)

// Rentang berurutan → daftar awal + kunci, dengan celah (kunci '') dan
// penggabungan rentang bertetangga yang kuncinya sama.
function penyusun(satu) {
  const daftar = []
  return {
    daftar,
    tambah(awal, akhir, kunci) {
      const akhirLalu = daftar.length ? daftar.at(-1).akhir : null
      if (akhirLalu !== null) {
        if (awal <= akhirLalu) awal = akhirLalu + satu // tumpang tindih kecil (pembulatan /64)
        if (awal > akhir) return
        if (awal > akhirLalu + satu) daftar.push({ awal: akhirLalu + satu, akhir: awal - satu, kunci: '' })
      }
      const lalu = daftar.at(-1)
      if (lalu && lalu.kunci === kunci) lalu.akhir = akhir
      else daftar.push({ awal, akhir, kunci })
    },
  }
}

// baris: async iterable baris CSV. Hasil: { data: Uint8Array, ringkasan }.
export async function bangunData(baris, { kota = KOTA_BAWAAN, tanggal = 0 } = {}) {
  const kotaUntuk = kota === 'semua' ? null : new Set(kota)
  const v4 = penyusun(1)
  const v6 = penyusun(1n)
  let jumlahBaris = 0
  for await (const b of baris) {
    if (!b.trim()) continue
    const [awal, akhir, , negaraMentah, , kotaMentah] = uraiBarisCsv(b)
    jumlahBaris++
    const negara = /^[A-Z]{2}$/.test(negaraMentah) && negaraMentah !== 'ZZ' ? negaraMentah : null
    const namaKota = negara && (!kotaUntuk || kotaUntuk.has(negara)) ? kotaMentah.replace(/[\t\n]/g, ' ').trim() : ''
    const kunci = negara ? `${negara}\t${namaKota}` : ''
    if (awal.includes(':')) {
      const a = ke128(awal)
      const z = ke128(akhir)
      // Dicatat per blok /64: blok yang terpotong ikut rentang yang mencakup awalnya.
      const a64 = (a >> 64n) + ((a & MAKS64) ? 1n : 0n)
      if (v6.daftar.length && a64 < v6.daftar.at(-1).awal) throw new Error('CSV tidak urut (IPv6)')
      v6.tambah(a64, z >> 64n, kunci)
    } else {
      const a = ke4(awal)
      if (v4.daftar.length && a <= v4.daftar.at(-1).awal) throw new Error('CSV tidak urut (IPv4)')
      v4.tambah(a, ke4(akhir), kunci)
    }
  }
  // Sesudah rentang terakhir: tidak diketahui (bukan ikut negara rentang terakhir).
  for (const [p, maks, satu] of [[v4, 0xffffffff, 1], [v6, MAKS64, 1n]]) {
    const akhir = p.daftar.at(-1)?.akhir
    if (akhir !== undefined && akhir < maks) p.daftar.push({ awal: akhir + satu, akhir: maks, kunci: '' })
  }
  const nomor = new Map([['', 0]])
  const teks = ['']
  const indeks = (k) => {
    if (!nomor.has(k)) { nomor.set(k, teks.length); teks.push(k) }
    return nomor.get(k)
  }
  const data = susunDataLokasi({
    v4: v4.daftar.map((r) => ({ awal: r.awal, indeks: indeks(r.kunci) })),
    v6: v6.daftar.map((r) => ({ hi: Number(r.awal >> 32n), lo: Number(r.awal & 0xffffffffn), indeks: indeks(r.kunci) })),
    teks,
    tanggal,
  })
  return {
    data,
    ringkasan: { jumlahBaris, rentang4: v4.daftar.length, rentang6: v6.daftar.length, entriTeks: teks.length, byte: data.length },
  }
}

export function bacaBaris(berkas) {
  let aliran = fs.createReadStream(berkas)
  if (berkas.endsWith('.gz')) aliran = aliran.pipe(zlib.createGunzip())
  return readline.createInterface({ input: aliran, crlfDelay: Infinity })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [masuk, keluar, ...sisa] = process.argv.slice(2)
  const opsi = Object.fromEntries(sisa.map((x, i) => (x.startsWith('--') ? [x.slice(2), sisa[i + 1]] : null)).filter(Boolean))
  if (!masuk || !keluar) {
    console.error('Pakai: node scripts/lokasi-ip/buat-data.mjs <dbip-city-lite.csv[.gz]> <keluar.bin> [--kota ID,IT|semua] [--tanggal 2026-10]')
    process.exit(1)
  }
  const kota = opsi.kota === 'semua' ? 'semua' : (opsi.kota ?? KOTA_BAWAAN.join(',')).split(',').map((x) => x.trim().toUpperCase())
  const tanggal = Number(String(opsi.tanggal ?? '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8)) || 0
  const { data, ringkasan } = await bangunData(bacaBaris(masuk), { kota, tanggal })
  fs.writeFileSync(keluar, keluar.endsWith('.gz') ? zlib.gzipSync(data, { level: 9 }) : data)
  console.log(JSON.stringify(ringkasan))
}
