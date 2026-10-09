// Tes sinkron live (SQL 014): tabel yang didaftarkan ke Realtime, dan
// penanda baris yang didisisihkan. Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, jalankanFileDanPeriksa, klaimUntuk, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { pembantuAkses } from './pembantu-akses.js'

let db, h, a, akar, ua, pemilik, asisten, biasa, t1, kerabatAsal

const penanda = (akun, aal = 'aal1') =>
  a.lewatApi(akun, (tx) => baris(tx, 'select table_name, row_id, tree_id from public.sync_removals order by id'), aal)
const buang = (akun, tabel, id, aal = 'aal1') =>
  a.lewatApi(akun, (tx) => baris(tx, 'select public.move_to_trash($1, $2) as b', [tabel, id]), aal)
const cucuBaru = async (nama) => {
  const id = await h.orang(nama, { birth_y: 1990 })
  const hubungan = await h.anak(ua, id)
  return { id, hubungan }
}

beforeAll(async () => {
  db = await buatDatabaseLengkap()
  h = pembantuSilsilah(db)
  a = pembantuAkses(db)
  const kakek = await h.orang('Kakek Contoh', { sex: 'L', birth_y: 1920 })
  const nenek = await h.orang('Nenek Contoh', { sex: 'P', birth_y: 1925 })
  akar = await h.nikah(kakek, nenek)
  await h.aturPangkal(akar)
  const anak = await h.orang('Anak Contoh', { sex: 'L', birth_y: 1950 })
  await h.anak(akar, anak)
  const menantu = await h.orang('Menantu Contoh', { sex: 'P' })
  ua = await h.nikah(anak, menantu)
  t1 = await h.pohonAsal(menantu)
  kerabatAsal = await h.orang('Kerabat Asal Contoh', { tree_id: t1 })
  pemilik = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  asisten = await a.anggota(nenek, { role: 'asisten', permissions: ['sisihkan'], nama: 'Asisten Contoh' })
  biasa = await a.anggota(anak, { nama: 'Anggota Biasa Contoh' })
}, 60000)

describe('014_sinkron_live.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '014_sinkron_live.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '014_sinkron_live.sql')).toEqual([])
  })

  it('Realtime hanya memuat tabel silsilah, pengaturan, dan penanda; tidak ada tabel anggota, perangkat, riwayat, atau schema private', async () => {
    const r = await baris(db, `select schemaname || '.' || tablename as t from pg_publication_tables
                               where pubname = 'supabase_realtime' order by 1`)
    expect(r.map((x) => x.t)).toEqual([
      'public.birth_ranks', 'public.children', 'public.origin_trees', 'public.people',
      'public.settings', 'public.sync_removals', 'public.unions',
    ])
  })
})

describe('penanda baris yang didisisihkan', () => {
  it('membuang orang → penanda untuk hubungan anak dan orangnya, TANPA isi data; anggota biasa bisa membacanya', async () => {
    const x = await cucuBaru('Cucu Satu Contoh')
    await buang(asisten, 'people', x.id)
    const r = await penanda(biasa)
    expect(r).toEqual(expect.arrayContaining([
      { table_name: 'children', row_id: x.hubungan, tree_id: null },
      { table_name: 'people', row_id: x.id, tree_id: null },
    ]))
    const kolom = await baris(db, `select column_name from information_schema.columns
                                   where table_schema = 'public' and table_name = 'sync_removals' order by ordinal_position`)
    expect(kolom.map((k) => k.column_name)).toEqual(['id', 'table_name', 'row_id', 'tree_id', 'at'])
  })

  it('memulihkan tidak membuat penanda (pemulihan sampai lewat Realtime biasa); membuang lagi membuat penanda baru', async () => {
    const x = await cucuBaru('Cucu Dua Contoh')
    const [{ b }] = await buang(asisten, 'people', x.id)
    const sebelum = (await penanda(biasa)).length
    await a.lewatApi(asisten, (tx) => baris(tx, 'select public.restore_batch($1)', [b]))
    expect(await penanda(biasa)).toHaveLength(sebelum)
    await buang(asisten, 'people', x.id)
    expect((await penanda(biasa)).length).toBe(sebelum + 2)
  })

  it('perubahan biasa (bukan buang) tidak membuat penanda', async () => {
    const x = await cucuBaru('Cucu Tiga Contoh')
    const sebelum = (await penanda(biasa)).length
    await db.query(`update public.people set nickname = 'Panggilan' where id = $1`, [x.id])
    expect(await penanda(biasa)).toHaveLength(sebelum)
  })

  it('penanda pohon keluarga asal hanya terlihat oleh yang boleh melihat pohon itu', async () => {
    await buang(pemilik, 'people', kerabatAsal, 'aal2')
    const milikPemilik = await penanda(pemilik, 'aal2')
    expect(milikPemilik).toContainEqual({ table_name: 'people', row_id: kerabatAsal, tree_id: t1 })
    expect((await penanda(biasa)).filter((p) => p.tree_id === t1)).toEqual([])
  })

  it('pengguna tidak bisa menulis penanda; tamu tidak bisa membaca', async () => {
    const tulis = (sql) => a.lewatApi(biasa, (tx) => tx.query(sql))
    await expect(tulis(`insert into public.sync_removals (table_name, row_id) values ('people', gen_random_uuid())`)).rejects.toThrow(/permission denied/)
    await expect(tulis(`delete from public.sync_removals`)).rejects.toThrow(/permission denied/)
    await expect(tulis(`update public.sync_removals set row_id = gen_random_uuid()`)).rejects.toThrow(/permission denied/)
    await expect(sebagai(db, 'anon', {}, (tx) => tx.query('select * from public.sync_removals'))).rejects.toThrow(/permission denied/)
  })

  it('akun tanpa perangkat terdaftar tidak membaca penanda apa pun', async () => {
    const tanpaPerangkat = { ...klaimUntuk(biasa), session_id: '00000000-0000-4000-8000-000000000000' }
    const r = await sebagai(db, 'authenticated', tanpaPerangkat, (tx) => baris(tx, 'select * from public.sync_removals'))
    expect(r).toEqual([])
  })

  it('penanda yang berumur lebih dari 1 hari terhapus sendiri saat ada pembuangan baru', async () => {
    await db.query(`update public.sync_removals set at = now() - interval '2 days'`)
    const x = await cucuBaru('Cucu Empat Contoh')
    await buang(asisten, 'people', x.id)
    const r = await baris(db, 'select row_id from public.sync_removals')
    expect(r.map((p) => p.row_id).sort()).toEqual([x.hubungan, x.id].sort())
  })
})
