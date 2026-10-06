import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  baris, buatDatabase, buatPengguna, FOLDER_SQL, jalankanFileDanPeriksa, klaimUntuk, sebagai,
} from './tiruan-supabase.js'

let db
let budi
const sebagaiBudi = (fn) => sebagai(db, 'authenticated', klaimUntuk(budi), fn)
const sebagaiAnon = (fn) => sebagai(db, 'anon', {}, fn)

beforeAll(async () => {
  db = await buatDatabase()
  budi = await buatPengguna(db)
}, 30000)

describe('001_dasar_keamanan.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan dua kali', async () => {
    expect(await jalankanFileDanPeriksa(db, '001_dasar_keamanan.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '001_dasar_keamanan.sql')).toEqual([])
    const [r] = await baris(db, `select count(*)::int as n from public.app_migrations`)
    expect(r.n).toBe(1)
  })

  it('tabel BARU setelah 001 tidak bisa disentuh anon/authenticated, tapi bisa oleh service_role', async () => {
    await db.exec(`create table public.tabel_baru (id int); insert into public.tabel_baru values (1);`)
    await expect(sebagaiAnon((tx) => baris(tx, 'select * from public.tabel_baru'))).rejects.toThrow(/permission denied/)
    await expect(sebagaiBudi((tx) => baris(tx, 'select * from public.tabel_baru'))).rejects.toThrow(/permission denied/)
    const r = await sebagai(db, 'service_role', {}, (tx) => baris(tx, 'select * from public.tabel_baru'))
    expect(r).toEqual([{ id: 1 }])
    await db.exec('drop table public.tabel_baru')
  })

  it('JEBAKAN Postgres: fungsi baru tetap bisa dijalankan anon lewat PUBLIC, kecuali dicabut sendiri', async () => {
    await db.exec(`create function public.fungsi_baru() returns int language sql as 'select 1'`)
    const [r] = await sebagaiAnon((tx) => baris(tx, 'select public.fungsi_baru() as x'))
    expect(r.x).toBe(1)
    await db.exec(`revoke all on function public.fungsi_baru() from public`)
    await expect(sebagaiAnon((tx) => baris(tx, 'select public.fungsi_baru()'))).rejects.toThrow(/permission denied/)
    await db.exec('drop function public.fungsi_baru()')
  })

  it('settings dan app_migrations tertutup untuk anon dan authenticated', async () => {
    for (const tabel of ['public.settings', 'public.app_migrations']) {
      await expect(sebagaiAnon((tx) => baris(tx, `select * from ${tabel}`))).rejects.toThrow(/permission denied/)
      await expect(sebagaiBudi((tx) => baris(tx, `select * from ${tabel}`))).rejects.toThrow(/permission denied/)
      await expect(sebagaiBudi((tx) => tx.query(`delete from ${tabel}`))).rejects.toThrow(/permission denied/)
    }
  })

  it('db_version(): bisa untuk yang login, ditolak untuk anon', async () => {
    const [r] = await sebagaiBudi((tx) => baris(tx, 'select public.db_version() as v'))
    expect(r.v).toBe('001')
    await expect(sebagaiAnon((tx) => baris(tx, 'select public.db_version()'))).rejects.toThrow(/permission denied/)
  })

  it('schema private tertutup untuk anon dan authenticated', async () => {
    await db.exec(`create table private.uji (id int); alter table private.uji enable row level security;`)
    await expect(sebagaiBudi((tx) => baris(tx, 'select * from private.uji'))).rejects.toThrow(/permission denied for schema private/)
    await expect(sebagaiAnon((tx) => baris(tx, 'select * from private.uji'))).rejects.toThrow(/permission denied for schema private/)
    await db.exec('drop table private.uji')
  })

  it('settings: nilai bawaan sesuai rencana dan hanya satu baris', async () => {
    const [s] = await baris(db, `select * from public.settings`)
    expect(s.generation_terms).toHaveLength(11)
    expect(s.generation_terms[0]).toBe('Pangkal')
    expect(s.generation_terms[10]).toBe('Galih asem')
    expect([s.contact_quota_member, s.contact_quota_assistant]).toEqual([20, 50])
    expect(s.temp_access_max_minutes).toBe(1440)
    expect([s.quiet_hours_start, s.quiet_hours_end]).toEqual(['21:00:00', '06:00:00'])
    expect(s.usual_countries).toEqual(['ID', 'IT'])
    expect([s.near_radius_km, s.news_daily_limit]).toEqual([50, 5])
    expect([s.gathering_reminder_morning, s.gathering_reminder_hours_before]).toEqual(['07:00:00', 2])
    await expect(db.query(`insert into public.settings (id) values (false)`)).rejects.toThrow(/check/)
    await expect(db.query(`insert into public.settings (id) values (true)`)).rejects.toThrow(/duplicate/)
  })

  it('nilai pengaturan yang tidak masuk akal ditolak', async () => {
    await expect(db.query(`update public.settings set temp_access_max_minutes = 5`)).rejects.toThrow(/check/)
    await expect(db.query(`update public.settings set contact_quota_member = -1`)).rejects.toThrow(/check/)
  })
})

describe('001_ROLLBACK.sql', () => {
  it('mengembalikan keadaan awal, lalu 001 bisa dijalankan lagi', async () => {
    const db2 = await buatDatabase()
    expect(await jalankanFileDanPeriksa(db2, '001_dasar_keamanan.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db2, '001_ROLLBACK.sql')).toEqual([])
    const [r] = await baris(db2, `select to_regclass('public.settings') as s, to_regclass('public.app_migrations') as m`)
    expect(r).toEqual({ s: null, m: null })
    // Hak otomatis Supabase kembali: tabel baru bisa disentuh anon lagi.
    await db2.exec('create table public.t (id int)')
    const [h] = await baris(db2, `select has_table_privilege('anon', 'public.t', 'select') as ok`)
    expect(h.ok).toBe(true)
    await db2.exec('drop table public.t')
    expect(await jalankanFileDanPeriksa(db2, '001_dasar_keamanan.sql')).toEqual([])
    await db2.close()
  }, 30000)

  it('isi rollback tidak menyentuh data keluarga', () => {
    const sql = fs.readFileSync(path.join(FOLDER_SQL, '001_ROLLBACK.sql'), 'utf8')
    expect(sql).not.toMatch(/people|unions|children|family_tree/i)
  })
})
