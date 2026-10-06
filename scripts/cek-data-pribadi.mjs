// Pemindai data pribadi: menolak commit yang memuat nama keluarga atau
// rahasia, sebelum sempat masuk ke repo publik.
//
//   node scripts/cek-data-pribadi.mjs --staged   file yang akan di-commit
//                                                (dipanggil hook pre-commit)
//   node scripts/cek-data-pribadi.mjs --semua    semua file di repo (CI)
//
// Yang diperiksa:
//   1. Nama dari data-pribadi/daftar-nama.txt (satu per baris; baris kosong
//      dan baris yang diawali "#" dilewati). Daftar ini hanya ada di
//      komputer pemilik, jadi di CI bagian ini dilewati.
//   2. Pola rahasia umum: secret key Supabase, token JWT, link undangan
//      atau kode perangkat berisi token, connection string Postgres
//      berpassword, kunci privat.
//   3. File yang tidak boleh ada di repo: isi data-pribadi/, .env, .csv.
//
// Nama yang ditemukan TIDAK ditulis utuh di layar (hanya huruf pertama dan
// nomor barisnya di daftar), supaya tidak bocor lewat log atau tangkapan
// layar.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DAFTAR_BAWAAN = 'data-pribadi/daftar-nama.txt'

export const POLA_RAHASIA = [
  { nama: 'secret key Supabase', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { nama: 'token JWT (kunci API/sesi)', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nama: 'link undangan berisi token', re: /#\/u\/[A-Za-z0-9_-]{20,}/ },
  { nama: 'link kode perangkat berisi kode', re: /#\/kode\/[A-Za-z0-9_-]{6,}/ },
  { nama: 'connection string Postgres berpassword', re: /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/ },
  { nama: 'kunci privat', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nama: 'kunci rahasia age', re: /AGE-SECRET-KEY-1[0-9A-Z]{20,}/ },
]

export function fileTerlarang(p) {
  const f = p.replaceAll('\\', '/')
  if (f.startsWith('data-pribadi/') || f.includes('/data-pribadi/')) return 'file dari folder data-pribadi/'
  const base = f.split('/').pop()
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return 'file .env (rahasia)'
  if (base.toLowerCase().endsWith('.csv')) return 'file .csv (kemungkinan data/backup)'
  return null
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Satu baris daftar → pola yang cocok sebagai kata utuh, tidak peka huruf
// besar/kecil, dengan spasi apa pun di antara kata.
export function bacaDaftarNama(teks) {
  return teks
    .split(/\r?\n/)
    .map((baris, i) => ({ baris: i + 1, nama: baris.trim() }))
    .filter(({ nama }) => nama && !nama.startsWith('#'))
    .map(({ baris, nama }) => ({
      baris,
      samaran: `${nama[0]}${'*'.repeat(Math.max(nama.length - 1, 1))}`,
      re: new RegExp(
        `(?<![\\p{L}\\p{N}])${nama.split(/\s+/).map(escapeRe).join('\\s+')}(?![\\p{L}\\p{N}])`,
        'iu'
      ),
    }))
}

// Memeriksa isi satu file. Hasil: daftar temuan { jenis, baris, keterangan }.
export function periksaTeks(teks, daftarNama = []) {
  const temuan = []
  const barisTeks = teks.split(/\r?\n/)
  barisTeks.forEach((isi, i) => {
    for (const p of POLA_RAHASIA) {
      if (p.re.test(isi)) temuan.push({ jenis: 'rahasia', baris: i + 1, keterangan: p.nama })
    }
    for (const n of daftarNama) {
      if (n.re.test(isi)) {
        temuan.push({
          jenis: 'nama',
          baris: i + 1,
          keterangan: `nama dari daftar (baris ${n.baris} di daftar-nama.txt: ${n.samaran})`,
        })
      }
    }
  })
  return temuan
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })

function daftarFile(mode, cwd) {
  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : ['ls-files', '-z']
  return git(args, cwd).toString('utf8').split('\0').filter(Boolean)
}

function isiFile(mode, p, cwd) {
  // Mode staged membaca versi yang akan di-commit (bukan versi di disk).
  return mode === 'staged' ? git(['show', `:${p}`], cwd) : fs.readFileSync(path.join(cwd, p))
}

export function jalankan({ mode, cwd = process.cwd(), daftarPath = process.env.DAFTAR_NAMA || DAFTAR_BAWAAN, log = console.log }) {
  const lokasiDaftar = path.resolve(cwd, daftarPath)
  let daftarNama = []
  if (fs.existsSync(lokasiDaftar)) {
    daftarNama = bacaDaftarNama(fs.readFileSync(lokasiDaftar, 'utf8'))
  } else {
    log(`ℹ️  ${daftarPath} tidak ditemukan: hanya pola rahasia dan file terlarang yang diperiksa.`)
  }

  const masalah = []
  for (const p of daftarFile(mode, cwd)) {
    const larang = fileTerlarang(p)
    if (larang) {
      masalah.push(`${p}: ${larang}`)
      continue
    }
    const isi = isiFile(mode, p, cwd)
    if (isi.includes(0)) continue // file biner (gambar, ikon)
    for (const t of periksaTeks(isi.toString('utf8'), daftarNama)) {
      masalah.push(`${p}:${t.baris}: ${t.keterangan}`)
    }
  }

  if (masalah.length) {
    log('')
    log('⛔ DITOLAK: ditemukan data pribadi atau rahasia.')
    for (const m of masalah) log(`   • ${m}`)
    log('')
    log('   Hapus data itu dari file, lalu coba lagi.')
    log('   Kalau yang ditemukan sebenarnya kata biasa, nonaktifkan baris itu di')
    log('   data-pribadi/daftar-nama.txt dengan menambahkan "#" di depannya.')
    return 1
  }
  log(`✅ Pemindai data pribadi: bersih (${daftarNama.length} nama diperiksa).`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.includes('--staged') ? 'staged' : process.argv.includes('--semua') ? 'semua' : null
  if (!mode) {
    console.log('Pemakaian: node scripts/cek-data-pribadi.mjs --staged | --semua')
    process.exit(2)
  }
  process.exit(jalankan({ mode }))
}
