import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { petakanGalat, tampaknyaInggris } from './galat.js'
import { teks } from '../teks/id.js'

const pg = (code, message, extra = {}) => ({ code, message, details: null, hint: null, ...extra })

describe('tampaknyaInggris', () => {
  it('mengenali pesan Inggris dan membiarkan pesan Indonesia', () => {
    expect(tampaknyaInggris('permission denied for table people')).toBe(true)
    expect(tampaknyaInggris('new row violates row-level security policy')).toBe(true)
    expect(tampaknyaInggris('JWT expired')).toBe(true)
    expect(tampaknyaInggris('Data ini sudah berubah sejak perubahan itu.')).toBe(false)
    expect(tampaknyaInggris('Server sedang bermasalah.')).toBe(false)
  })
})

describe('project dijeda atau layanan tidak tersedia', () => {
  it('status 540 → "Aplikasi sedang dipulihkan"', () => {
    const h = petakanGalat({ message: 'whatever' }, { status: 540 })
    expect(h).toMatchObject({ jenis: 'dipulihkan', bisaCobaLagi: true })
    expect(h.pesan).toBe('Aplikasi sedang dipulihkan. Silakan coba beberapa saat lagi.')
    expect(h.judul).toBe('Aplikasi sedang dipulihkan')
  })
  it('status 503, kode PGRST002, atau teks "project paused"', () => {
    expect(petakanGalat({ message: 'x' }, { status: 503 }).jenis).toBe('dipulihkan')
    expect(petakanGalat(pg('PGRST002', 'Could not query the database for the schema cache. Retrying.')).jenis).toBe('dipulihkan')
    expect(petakanGalat({ message: 'Project is paused' }).jenis).toBe('dipulihkan')
  })
  it('status bisa datang dari galatnya sendiri (Edge Function)', () => {
    expect(petakanGalat({ name: 'FunctionsHttpError', message: 'x', context: { status: 540 } }).jenis).toBe('dipulihkan')
  })
})

describe('database belum diperbarui', () => {
  it.each(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42883', '42703'])('kode %s', (kode) => {
    const h = petakanGalat(pg(kode, 'Could not find the function public.db_version in the schema cache'))
    expect(h).toMatchObject({ jenis: 'belumDiperbarui', bisaCobaLagi: false })
    expect(h.pesan).toBe(teks.galat.belumDiperbarui)
  })
})

describe('kode galat buatan kita (file SQL)', () => {
  it('memakai pesan server kalau berbahasa Indonesia (bisa memuat nama dan waktu)', () => {
    const pesan = 'Data ini sudah diubah lagi oleh Contoh pada 07-10-2026 15.30 WIB. Batalkan perubahan itu dulu, atau ubah secara manual.'
    const h = petakanGalat(pg('UN003', pesan))
    expect(h).toMatchObject({ jenis: 'aturan', pesan, bisaCobaLagi: false, kode: 'UN003' })
  })
  it('kalau pesan server bukan Indonesia, pakai pesan di teks/id.js', () => {
    const h = petakanGalat(pg('SL001', 'cycle detected in the tree'))
    expect(h.pesan).toBe(teks.galat.kode.SL001)
  })
  it('kode mirip tapi belum terdaftar → pesan umum, bukan pesan server berbahasa Inggris', () => {
    const h = petakanGalat(pg('SL999', 'something odd happened'))
    expect(h.pesan).toBe(teks.galat.dataDitolak)
  })
  it('SEMUA pesan di file SQL berbahasa Indonesia', () => {
    const dir = path.join(import.meta.dirname, '../../supabase')
    const buruk = []
    let jumlah = 0
    for (const f of fs.readdirSync(dir).filter((x) => /^\d{3}_.*\.sql$/.test(x) && !x.includes('ROLLBACK'))) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8')
      for (const m of sql.matchAll(/private\.fail\('([A-Z]{2}\d{3})',([^;]*);/g)) {
        jumlah++
        const teksSql = [...m[2].matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1]).join(' ')
        if (tampaknyaInggris(teksSql)) buruk.push(`${f} ${m[1]}`)
      }
    }
    expect(jumlah).toBeGreaterThan(40)
    expect(buruk).toEqual([])
  })
})

describe('standar Postgres', () => {
  it('batasan data entri yang dikenal → pesan spesifik', () => {
    const h = petakanGalat(pg('23514', 'new row for relation "people" violates check constraint "people_death_after_birth"'))
    expect(h).toMatchObject({ jenis: 'dataDitolak', bisaCobaLagi: false })
    expect(h.pesan).toBe('Tahun wafat tidak bisa sebelum tahun lahir.')
  })
  it('duplikat: anak sudah tercatat, urutan lahir kembar', () => {
    expect(
      petakanGalat(pg('23505', 'duplicate key value violates unique constraint "children_union_child_active"')).pesan
    ).toBe('Anak ini sudah tercatat di pernikahan ini.')
    expect(
      petakanGalat(pg('23505', 'duplicate key value violates unique constraint "birth_ranks_unique_rank"')).pesan
    ).toBe('Dua anak tidak bisa punya urutan lahir yang sama.')
  })
  it('nama batasan juga dibaca dari details', () => {
    const h = petakanGalat(pg('23505', 'conflict', { details: 'violates unique constraint "members_one_owner"' }))
    expect(h.pesan).toBe('Hanya boleh ada satu admin utama.')
  })
  it('batasan tidak dikenal → pesan standar per kode', () => {
    expect(petakanGalat(pg('23505', 'duplicate key value violates unique constraint "xyz"')).pesan).toBe('Data ini sudah ada.')
    expect(petakanGalat(pg('23502', 'null value in column "full_name"')).pesan).toBe('Ada isian wajib yang masih kosong.')
    expect(petakanGalat(pg('23503', 'violates foreign key constraint "x"')).pesan).toBe(teks.galat.standar['23503'])
    expect(petakanGalat(pg('22007', 'invalid input syntax for type date')).pesan).toBe('Ada tanggal yang tidak valid.')
    expect(petakanGalat(pg('22999', 'something')).pesan).toBe(teks.galat.dataDitolak)
  })
  it('RLS menolak → tidak punya izin', () => {
    const h = petakanGalat(pg('42501', 'new row violates row-level security policy for table "people"'))
    expect(h).toMatchObject({ jenis: 'tanpaIzin', pesan: 'Anda tidak punya izin untuk melakukan ini.' })
    expect(petakanGalat({ message: 'x' }, { status: 403 }).jenis).toBe('tanpaIzin')
  })
  it('data berubah bersamaan atau tidak ada lagi → bisa coba lagi', () => {
    for (const kode of ['PGRST116', '40001', '40P01']) {
      expect(petakanGalat(pg(kode, 'The result contains 0 rows'))).toMatchObject({ jenis: 'bentrok', bisaCobaLagi: true })
    }
  })
})

describe('sesi dan akun', () => {
  it('status 401 atau kode sesi → sesi berakhir', () => {
    expect(petakanGalat(pg('PGRST301', 'JWT expired')).jenis).toBe('sesiHabis')
    expect(petakanGalat({ name: 'AuthApiError', message: 'Invalid Refresh Token', code: 'refresh_token_not_found', status: 400 }).jenis).toBe('sesiHabis')
    expect(petakanGalat({ message: 'x' }, { status: 401 }).pesan).toBe('Sesi Anda berakhir. Silakan masuk lagi.')
  })
  it('terlalu sering', () => {
    expect(petakanGalat({ message: 'x', status: 429 }).jenis).toBe('terlaluSering')
    expect(petakanGalat({ name: 'AuthApiError', message: 'x', code: 'over_request_rate_limit', status: 429 }).bisaCobaLagi).toBe(true)
  })
  it('verifikasi dua langkah: kode salah dan sesi belum aal2 → pesan Indonesia (bukan "tidak punya izin")', () => {
    const salah = petakanGalat({ name: 'AuthApiError', message: 'Invalid TOTP code entered', code: 'mfa_verification_failed', status: 422 })
    expect(salah).toMatchObject({ jenis: 'duaLangkah', kode: 'mfa_verification_failed' })
    expect(salah.pesan).toMatch(/^Kode salah\./)
    const aal = petakanGalat({ name: 'AuthApiError', message: 'AAL2 required', code: 'insufficient_aal', status: 403 })
    expect(aal.jenis).toBe('duaLangkah')
    expect(tampaknyaInggris(aal.pesan)).toBe(false)
  })
})

describe('jaringan dan server', () => {
  it('tanpa internet → pesan offline; dengan internet → pesan jaringan', () => {
    const galat = new TypeError('Failed to fetch')
    expect(petakanGalat(galat, { online: false }).jenis).toBe('offline')
    expect(petakanGalat(galat, { online: true }).jenis).toBe('jaringan')
    expect(petakanGalat(galat).jenis).toBe('jaringan')
    expect(petakanGalat(new TypeError('Load failed')).jenis).toBe('jaringan') // Safari
    expect(petakanGalat(new TypeError('NetworkError when attempting to fetch resource.')).jenis).toBe('jaringan') // Firefox
    expect(petakanGalat({ name: 'AuthRetryableFetchError', message: 'x', status: 0 }).jenis).toBe('jaringan')
  })
  it('TypeError biasa (bug kode) tidak disamarkan sebagai masalah internet', () => {
    expect(petakanGalat(new TypeError("Cannot read properties of undefined (reading 'id')")).jenis).toBe('tidakDikenal')
  })
  it('waktu habis dan galat server', () => {
    expect(petakanGalat(pg('57014', 'canceling statement due to statement timeout')).jenis).toBe('sibuk')
    expect(petakanGalat({ message: 'x' }, { status: 504 }).jenis).toBe('sibuk')
    expect(petakanGalat({ message: 'x' }, { status: 500 })).toMatchObject({ jenis: 'server', bisaCobaLagi: true })
    expect(petakanGalat({ message: 'x' }, { status: 404 }).jenis).toBe('tidakDitemukan')
  })
})

describe('tidak ada pesan bahasa Inggris yang lolos', () => {
  const contoh = [
    pg('42501', 'permission denied for table people'),
    pg('42P17', 'infinite recursion detected in policy for relation "members"'),
    pg('XX000', 'internal error'),
    pg('PGRST100', 'unexpected "x" expecting "("'),
    pg('23514', 'new row for relation "unions" violates check constraint "mystery"'),
    pg('P0001', 'Only admin can do this'),
    new Error('Something went wrong'),
    new TypeError('Failed to fetch'),
    { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
    { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: 500 } },
    'Request failed with status code 418',
    {},
  ]
  it.each(contoh.map((c, i) => [i, c]))('contoh %i: pesan Indonesia dan tidak memuat teks server', (_i, galat) => {
    const h = petakanGalat(galat)
    expect(h.pesan.length).toBeGreaterThan(10)
    expect(tampaknyaInggris(h.pesan)).toBe(false)
    expect(tampaknyaInggris(h.judul)).toBe(false)
    const asli = typeof galat === 'string' ? galat : galat.message
    if (asli) expect(h.pesan).not.toContain(asli)
  })
  it('galat kosong → null (tidak ada galat)', () => {
    expect(petakanGalat(null)).toBeNull()
    expect(petakanGalat(undefined)).toBeNull()
  })
  it('galat tidak dikenal menyimpan kodenya untuk admin', () => {
    expect(petakanGalat(pg('XX000', 'internal error'))).toMatchObject({ jenis: 'tidakDikenal', kode: 'XX000', bisaCobaLagi: true })
  })
})
