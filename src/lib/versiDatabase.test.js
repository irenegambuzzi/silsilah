import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { VERSI_DATABASE_DIBUTUHKAN, tafsirkanVersiDatabase, versiSudahCukup } from './versiDatabase.js'
import { teks } from '../teks/id.js'

describe('VERSI_DATABASE_DIBUTUHKAN', () => {
  it('sama dengan nomor file SQL bernomor terbesar di folder supabase/', () => {
    const dir = path.join(import.meta.dirname, '../../supabase')
    const nomor = fs
      .readdirSync(dir)
      .map((f) => /^(\d{3})_(?!ROLLBACK).*\.sql$/.exec(f)?.[1])
      .filter(Boolean)
      .sort()
    expect(VERSI_DATABASE_DIBUTUHKAN).toBe(nomor.at(-1))
  })

  it('semua file SQL bernomor mencatat dirinya di app_migrations dengan nomor yang sama', () => {
    const dir = path.join(import.meta.dirname, '../../supabase')
    for (const f of fs.readdirSync(dir).filter((x) => /^\d{3}_(?!ROLLBACK).*\.sql$/.test(x) && !x.startsWith('000'))) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(sql, f).toMatch(new RegExp(`values \\('${f.slice(0, 3)}',`))
    }
  })
})

describe('versiSudahCukup', () => {
  it('membandingkan sebagai angka', () => {
    expect(versiSudahCukup('008', '008')).toBe(true)
    expect(versiSudahCukup('009', '008')).toBe(true)
    expect(versiSudahCukup('007', '008')).toBe(false)
    expect(versiSudahCukup('010', '009')).toBe(true)
  })
  it('kosong atau bentuk aneh dianggap belum cukup', () => {
    for (const v of [null, undefined, '', 'abc', '8', 8]) expect(versiSudahCukup(v, '008')).toBe(false)
  })
})

describe('tafsirkanVersiDatabase', () => {
  it('versi cukup → siap', () => {
    expect(tafsirkanVersiDatabase({ data: VERSI_DATABASE_DIBUTUHKAN })).toEqual({ siap: true })
  })

  it('versi lebih lama → "Database belum diperbarui"', () => {
    const h = tafsirkanVersiDatabase({ data: '005' })
    expect(h).toMatchObject({ siap: false, jenis: 'belumDiperbarui', bisaCobaLagi: false })
    expect(h.judul).toBe('Database belum diperbarui')
    expect(h.pesan).toBe(teks.galat.belumDiperbarui)
  })

  it('db_version belum ada (file 001 belum dijalankan) → belum diperbarui', () => {
    const h = tafsirkanVersiDatabase({
      error: { code: 'PGRST202', message: 'Could not find the function public.db_version without parameters in the schema cache' },
    })
    expect(h).toMatchObject({ siap: false, jenis: 'belumDiperbarui' })
  })

  it('tabel app_migrations kosong (data null) → belum diperbarui', () => {
    expect(tafsirkanVersiDatabase({ data: null })).toMatchObject({ siap: false, jenis: 'belumDiperbarui' })
  })

  it('project dijeda → sedang dipulihkan, bukan "belum diperbarui"', () => {
    const h = tafsirkanVersiDatabase({ error: { message: 'x' }, status: 540 })
    expect(h).toMatchObject({ siap: false, jenis: 'dipulihkan', bisaCobaLagi: true })
    expect(h.pesan).toBe('Aplikasi sedang dipulihkan. Silakan coba beberapa saat lagi.')
  })

  it('tanpa internet → pesan offline', () => {
    const h = tafsirkanVersiDatabase({ error: new TypeError('Failed to fetch') }, { online: false })
    expect(h).toMatchObject({ siap: false, jenis: 'offline' })
  })

  it('sesi habis → minta masuk lagi', () => {
    expect(tafsirkanVersiDatabase({ error: { code: 'PGRST301', message: 'JWT expired' } }).jenis).toBe('sesiHabis')
  })
})
