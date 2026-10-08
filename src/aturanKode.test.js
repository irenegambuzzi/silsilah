// Aturan yang dijaga untuk SEMUA kode aplikasi (src/), termasuk yang
// ditambahkan nanti: tanpa izin lokasi, tanpa jaringan ke luar, dan
// penyimpanan di perangkat hanya lewat satu pintu (lib/penyimpanan.js).
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const dir = import.meta.dirname
const semua = fs.readdirSync(dir, { recursive: true })
  .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f) && !f.startsWith(`test${path.sep}`))
  .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
// Tanpa komentar: yang diperiksa hanya kode.
const kode = (isi) => isi.split('\n').filter((b) => !b.trim().startsWith('//') && !b.trim().startsWith('*')).join('\n')

describe('kode aplikasi (src/)', () => {
  it('ada berkas yang diperiksa', () => {
    expect(semua.length).toBeGreaterThan(20)
  })

  it('tidak pernah meminta izin lokasi di layar mana pun (izin lokasi hanya untuk Kabar Keluarga darurat, nanti)', () => {
    for (const [f, isi] of semua) {
      expect(kode(isi), f).not.toMatch(/geolocation|getCurrentPosition|watchPosition/)
    }
  })

  it('tidak meminta izin notifikasi (notifikasi dorong belum ada)', () => {
    for (const [f, isi] of semua) expect(kode(isi), f).not.toMatch(/Notification\.requestPermission|pushManager/)
  })

  it('tidak memanggil jaringan sendiri: hanya lewat klien Supabase', () => {
    for (const [f, isi] of semua) {
      expect(kode(isi), f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/)
    }
  })

  it('satu-satunya alamat luar di tampilan: tautan atribusi DB-IP', () => {
    const alamat = semua.flatMap(([f, isi]) => [...kode(isi).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => `${f}: ${m[0]}`))
    expect(alamat).toEqual(['pages/Privasi.jsx: https://db-ip.com'])
  })

  it('penyimpanan di perangkat hanya lewat lib/penyimpanan.js (supaya semuanya berawalan "silsilah" dan ikut terhapus)', () => {
    for (const [f, isi] of semua) {
      if (f === path.join('lib', 'penyimpanan.js')) continue
      expect(kode(isi), f).not.toMatch(/\b(localStorage|sessionStorage|indexedDB|caches)\b/)
    }
  })

  it('klien Supabase memakai kunci penyimpanan sendiri dan tidak membaca sesi dari alamat', () => {
    const isi = semua.find(([f]) => f === path.join('lib', 'supabase.js'))[1]
    expect(isi).toContain('storageKey: KUNCI.auth')
    expect(isi).toContain('detectSessionInUrl: false')
  })

  it('lapisan data silsilah hanya MEMBACA: tanpa insert, upsert, update, delete, rpc, atau Edge Function', () => {
    const data = semua.filter(([f]) => f.startsWith(path.join('lib', 'data') + path.sep))
    expect(data.map(([f]) => path.basename(f)).sort()).toEqual(
      ['DataSilsilah.jsx', 'kolom.js', 'konteksData.js', 'muat.js', 'perubahan.js', 'realtime.js', 'salinan.js'])
    for (const [f, isi] of data) {
      expect(kode(isi), f).not.toMatch(/\.(insert|upsert|update|delete)\s*\(|\.rpc\s*\(|functions\s*\.\s*invoke/)
    }
  })

  it('layar keterangan (galat, kosong, offline) tidak memanggil server', () => {
    for (const f of [path.join('pages', 'Keadaan.jsx'), path.join('components', 'GerbangData.jsx'), path.join('components', 'SpandukData.jsx')]) {
      const isi = semua.find(([nama]) => nama === f)[1]
      expect(kode(isi), f).not.toMatch(/klien|\.from\s*\(|\.rpc\s*\(|from '\.\.\/lib\/api\.js'/)
    }
  })

  it('tidak ada kunci rahasia di kode aplikasi (hanya publishable key dari variabel build)', () => {
    for (const [f, isi] of semua) {
      expect(isi, f).not.toMatch(/sb_secret_|service_role|KUNCI_SERVER/)
    }
  })
})
