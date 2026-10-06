// Tes pemindai data pribadi. Semua nama di sini FIKTIF. Rahasia palsu
// dirakit saat tes berjalan, supaya file ini sendiri tidak ditolak pemindai.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bacaDaftarNama, fileTerlarang, jalankan, periksaTeks } from './cek-data-pribadi.mjs'

const daftar = bacaDaftarNama(['Wiraguna Santosa', 'Kartolo', '# Hartono', '', 'Wulan Lestari'].join('\n'))

describe('daftar nama', () => {
  it('melewati baris kosong dan baris berawalan #', () => {
    expect(daftar.map((n) => n.baris)).toEqual([1, 2, 5])
  })

  it('tidak menampilkan nama utuh di keterangan', () => {
    const t = periksaTeks('halo Kartolo', daftar)
    expect(t[0].keterangan).toContain('baris 2')
    expect(t[0].keterangan).toContain('K*****')
    expect(t[0].keterangan).not.toContain('Kartolo')
  })
})

describe('periksaTeks: nama', () => {
  it('menemukan nama tanpa peduli huruf besar/kecil dan spasi ganda', () => {
    expect(periksaTeks('const x = "wiraguna   SANTOSA"', daftar)).toHaveLength(1)
  })

  it('hanya mencocokkan kata utuh', () => {
    expect(periksaTeks('Kartolowati dan WulanLestari', daftar)).toEqual([])
  })

  it('melaporkan nomor baris di file', () => {
    expect(periksaTeks('baris satu\nbaris dua Kartolo', daftar)[0].baris).toBe(2)
  })

  it('baris yang dinonaktifkan (#) tidak ditolak', () => {
    expect(periksaTeks('Hartono', daftar)).toEqual([])
  })
})

describe('periksaTeks: rahasia', () => {
  const x = (n) => 'A'.repeat(n)
  const kasus = {
    'secret key Supabase': 'sb_' + 'secret_' + x(24),
    'token JWT': 'ey' + 'J' + x(20) + '.ey' + 'J' + x(20) + '.' + x(20),
    'link undangan': 'https://contoh.github.io/silsilah/#' + '/u/' + x(43),
    'link kode perangkat': 'https://contoh.github.io/silsilah/#' + '/kode/' + x(8),
    'connection string': 'postgres' + 'ql://postgres.abc:' + 'rahasia123' + '@pooler.example.com:5432/postgres',
    'kunci privat': '-----BEGIN ' + 'PRIVATE KEY-----',
    'kunci age': 'AGE-SECRET-' + 'KEY-1' + x(30),
  }
  for (const [nama, teks] of Object.entries(kasus)) {
    it(`menolak ${nama}`, () => expect(periksaTeks(teks)).toHaveLength(1))
  }

  it('tidak menolak teks panduan yang hanya menyebut awalan kunci', () => {
    expect(periksaTeks('Buat Secret key (awalan `sb_secret_…`) dan link #/u/<token>')).toEqual([])
  })
})

describe('fileTerlarang', () => {
  it('menolak data-pribadi/, .env, dan .csv', () => {
    expect(fileTerlarang('data-pribadi/daftar-nama.txt')).toBeTruthy()
    expect(fileTerlarang('.env')).toBeTruthy()
    expect(fileTerlarang('scripts/.env.local')).toBeTruthy()
    expect(fileTerlarang('backup/Data Lama.CSV')).toBeTruthy()
  })

  it('mengizinkan .env.example dan file biasa', () => {
    expect(fileTerlarang('.env.example')).toBeNull()
    expect(fileTerlarang('src/App.jsx')).toBeNull()
  })
})

describe('jalankan pada repo git sementara', () => {
  let dir
  const sh = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  const tulis = (f, isi) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), isi)
  }
  const cek = (mode) => {
    const log = []
    const kode = jalankan({ mode, cwd: dir, daftarPath: 'pribadi/daftar.txt', log: (s) => log.push(s) })
    return { kode, log: log.join('\n') }
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cek-data-pribadi-'))
    sh('init', '-q')
    tulis('pribadi/daftar.txt', 'Kartolo\n')
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('meloloskan file biasa yang di-stage', () => {
    tulis('a.js', 'export const salam = "halo"\n')
    sh('add', 'a.js')
    expect(cek('staged').kode).toBe(0)
  })

  it('menolak file ber-nama yang di-stage, tanpa menampilkan nama utuh', () => {
    tulis('b.js', 'const ketua = "Kartolo"\n')
    sh('add', 'b.js')
    const { kode, log } = cek('staged')
    expect(kode).toBe(1)
    expect(log).toContain('b.js:1')
    expect(log).not.toContain('Kartolo')
    sh('rm', '-q', '-f', '--cached', 'b.js')
  })

  it('memeriksa versi yang di-stage, bukan versi di disk', () => {
    tulis('c.js', 'const x = "Kartolo"\n')
    sh('add', 'c.js')
    tulis('c.js', 'const x = "aman"\n') // disk sudah bersih, tapi stage belum
    expect(cek('staged').kode).toBe(1)
    sh('rm', '-q', '-f', '--cached', 'c.js')
  })

  it('menolak file .csv yang di-stage', () => {
    tulis('cadangan.csv', 'id,data\n')
    sh('add', 'cadangan.csv')
    expect(cek('staged').kode).toBe(1)
    sh('rm', '-q', '-f', '--cached', 'cadangan.csv')
  })

  it('tanpa daftar nama (seperti di CI) tetap memeriksa rahasia', () => {
    const log = []
    const kode = jalankan({ mode: 'staged', cwd: dir, daftarPath: 'tidak-ada.txt', log: (s) => log.push(s) })
    expect(kode).toBe(0)
    expect(log.join('\n')).toContain('tidak ditemukan')
  })
})
