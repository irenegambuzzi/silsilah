// "Pagar" keamanan: berlaku untuk SEMUA file SQL kita, termasuk yang
// ditambahkan nanti. Kalau sebuah file baru lupa RLS atau lupa mencabut
// hak, tes ini merah.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, daftarMigrasi } from './tiruan-supabase.js'

// Fungsi yang SENGAJA boleh dijalankan anon (harus ada alasannya).
const FUNGSI_BOLEH_ANON = []

let db
beforeAll(async () => {
  db = await buatDatabaseLengkap()
}, 60000)

const tabelKita = `
  select c.oid, n.nspname || '.' || c.relname as nama, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')`

describe('pagar keamanan untuk semua migrasi', () => {
  it('ada migrasi yang diuji', () => {
    expect(daftarMigrasi().length).toBeGreaterThan(0)
  })

  it('setiap tabel di public dan private memakai RLS', async () => {
    const r = await baris(db, `select nama from (${tabelKita}) t where not rls order by nama`)
    expect(r.map((x) => x.nama)).toEqual([])
  })

  it('anon tidak punya hak apa pun atas tabel kita', async () => {
    const r = await baris(db, `select nama from (${tabelKita}) t where
      has_table_privilege('anon', oid, 'select') or has_table_privilege('anon', oid, 'insert')
      or has_table_privilege('anon', oid, 'update') or has_table_privilege('anon', oid, 'delete')`)
    expect(r.map((x) => x.nama)).toEqual([])
  })

  it('anon tidak bisa menjalankan fungsi kita (kecuali yang sengaja diizinkan)', async () => {
    const r = await baris(db, `
      select n.nspname || '.' || p.proname as nama
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'execute')`)
    expect(r.map((x) => x.nama).filter((n) => !FUNGSI_BOLEH_ANON.includes(n))).toEqual([])
  })

  it('schema private tidak bisa dipakai anon maupun authenticated', async () => {
    const [r] = await baris(db, `select has_schema_privilege('anon', 'private', 'usage') as a,
                                        has_schema_privilege('authenticated', 'private', 'usage') as b`)
    expect(r).toEqual({ a: false, b: false })
  })

  it('hak otomatis untuk anon/authenticated di public tetap tercabut', async () => {
    const [r] = await baris(db, `
      select count(*)::int as n from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
      where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
        and a.grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid)`)
    expect(r.n).toBe(0)
  })

  it('setiap file migrasi mencatat dirinya di app_migrations', async () => {
    const r = await baris(db, `select version from public.app_migrations order by version`)
    expect(r.map((x) => x.version)).toEqual(daftarMigrasi().map((f) => f.slice(0, 3)))
  })
})
