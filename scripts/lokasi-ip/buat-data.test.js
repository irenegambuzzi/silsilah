// Pembuat file data lokasi, dengan CSV contoh berbentuk DB-IP (alamat
// dokumentasi RFC 5737/3849 dan kota FIKTIF).
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { bangunData, bacaBaris, uraiBarisCsv } from './buat-data.mjs'
import { bacaDataLokasi, cariLokasi } from '../../supabase/functions/_shared/lokasi.js'
import { uraiIp } from '../../supabase/functions/_shared/ip.js'

const CONTOH = path.join(import.meta.dirname, 'contoh-dbip.txt')
let hasil, data
const cari = (ip) => cariLokasi(data, uraiIp(ip))

beforeAll(async () => {
  hasil = await bangunData(bacaBaris(CONTOH), { tanggal: 20261001 })
  data = bacaDataLokasi(hasil.data)
})

describe('uraiBarisCsv', () => {
  it('kolom berkutip, koma dan kutip di dalam kutip', () => {
    expect(uraiBarisCsv('1.0.0.0,1.0.0.255,AS,ID,"Jawa, Tengah","Kota ""X""",1,2'))
      .toEqual(['1.0.0.0', '1.0.0.255', 'AS', 'ID', 'Jawa, Tengah', 'Kota "X"', '1', '2'])
  })
})

describe('bangunData (bawaan: kota hanya Indonesia dan Italia)', () => {
  it('IP contoh → negara dan kota yang benar', () => {
    expect(cari('192.0.2.5')).toEqual({ approx_country: 'ID', approx_city: 'Kota Contoh A' })
    expect(cari('192.0.2.200')).toEqual({ approx_country: 'ID', approx_city: 'Kota "Contoh", B' })
    expect(cari('198.51.100.7')).toEqual({ approx_country: 'IT', approx_city: 'Kota Contoh C' })
    expect(cari('::ffff:192.0.2.5')).toEqual({ approx_country: 'ID', approx_city: 'Kota Contoh A' })
  })
  it('negara lain hanya tingkat negara (rentang bertetangga digabung)', () => {
    expect(cari('203.0.113.1')).toEqual({ approx_country: 'NG', approx_city: null })
    expect(cari('203.0.113.250')).toEqual({ approx_country: 'NG', approx_city: null })
  })
  it('alamat tanpa data, cadangan (ZZ), atau di celah → tidak diketahui', () => {
    expect(cari('0.1.2.3')).toBeNull()
    expect(cari('10.0.0.1')).toBeNull()
    expect(cari('203.0.114.0')).toBeNull()
    expect(cari('2001:db8:2::1')).toBeNull()
  })
  it('IPv6 per blok /64: blok yang terpotong ikut rentang yang mencakup awalnya', () => {
    expect(cari('2001:db8::1')).toEqual({ approx_country: 'ID', approx_city: 'Kota Contoh F' })
    expect(cari('2001:db8:0:5::1')).toEqual({ approx_country: 'ID', approx_city: 'Kota Contoh F' })
    expect(cari('2001:db8:1::5')).toEqual({ approx_country: 'IT', approx_city: 'Kota Contoh G' })
    expect(cari('2001:db8:1:0:9000::1')).toEqual({ approx_country: 'IT', approx_city: 'Kota Contoh G' })
    expect(cari('2001:db8:1:2::1')).toEqual({ approx_country: 'IT', approx_city: 'Kota Contoh H' })
  })
  it('TANPA koordinat: angka lintang/bujur dari CSV tidak ikut ke file', () => {
    const teks = new TextDecoder('latin1').decode(hasil.data)
    for (const angka of ['110.4567', '-7.0123', '45.4123', '12.5123']) expect(teks).not.toContain(angka)
    expect(data.teks.every((t) => t === '' || /^[A-Z]{2}\t[^\t\n]*$/.test(t))).toBe(true)
  })
  it('ringkasan dan tanggal data', () => {
    expect(hasil.ringkasan).toMatchObject({ jumlahBaris: 9 })
    expect(data.tanggal).toBe(20261001)
  })
})

describe('pilihan cakupan kota', () => {
  it('--kota semua: kota untuk semua negara', async () => {
    const { data: d } = await bangunData(bacaBaris(CONTOH), { kota: 'semua' })
    expect(cariLokasi(bacaDataLokasi(d), uraiIp('203.0.113.1'))).toEqual({ approx_country: 'NG', approx_city: 'Kota Contoh D' })
  })
  it('--kota IT: Indonesia hanya tingkat negara', async () => {
    const { data: d } = await bangunData(bacaBaris(CONTOH), { kota: ['IT'] })
    expect(cariLokasi(bacaDataLokasi(d), uraiIp('192.0.2.5'))).toEqual({ approx_country: 'ID', approx_city: null })
  })
  it('CSV yang tidak urut ditolak', async () => {
    async function* baris() { yield '192.0.2.0,192.0.2.255,AS,ID,,A,0,0'; yield '10.0.0.0,10.0.0.255,AS,ID,,B,0,0' }
    await expect(bangunData(baris())).rejects.toThrow('tidak urut')
  })
})

describe('perintah baris', () => {
  it('menulis file .gz yang bisa dibaca kembali', () => {
    const keluar = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lokasi-')), 'lokasi-ip.bin.gz')
    execFileSync(process.execPath, [path.join(import.meta.dirname, 'buat-data.mjs'), CONTOH, keluar, '--tanggal', '2026-10'])
    const d = bacaDataLokasi(new Uint8Array(zlib.gunzipSync(fs.readFileSync(keluar))))
    expect(d.tanggal).toBe(20261000)
    expect(cariLokasi(d, uraiIp('198.51.100.7'))).toEqual({ approx_country: 'IT', approx_city: 'Kota Contoh C' })
  })
})
