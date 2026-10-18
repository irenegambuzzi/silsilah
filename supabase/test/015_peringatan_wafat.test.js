// Tes pilihan "mulai hari berikutnya" untuk peringatan wafat (SQL 015).
// Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, panggilFungsi, pembantuAkses } from './pembantu-akses.js'

let db, h, a, ua
let owner, asisten, asistenLain, biasa, lihat
let lengkap, tanpaHari, hidup, asal, disisihkan
let nomor = 0

const orangBaru = async (extra = {}) => {
  const id = await h.orang(`Cucu ${++nomor} Contoh`, { birth_y: 1960, ...extra })
  await h.anak(ua, id)
  return id
}

const atur = (akun, person, nilai, aal = 'aal1') =>
  a.rpc(akun, 'set_death_rule', { p_person: person, p_start_next_day: nilai }, aal)
const baca = (akun, person, aal = 'aal1') => a.rpc(akun, 'get_death_rule', { p_person: person }, aal)
// Tanggal sebagai teks 'YYYY-MM-DD' (atau null), seperti yang diterima aplikasi.
const mulai = async (akun, person, aal = 'aal1') =>
  (await a.lewatApi(akun, (tx) => baris(tx, 'select public.death_count_start($1)::text as t', [person]), aal))[0].t

beforeAll(async () => {
  db = await buatDatabaseLengkap()
  h = pembantuSilsilah(db)
  a = pembantuAkses(db)
  const kakek = await h.orang('Kakek Contoh', { sex: 'L', birth_y: 1920 })
  const nenek = await h.orang('Nenek Contoh', { sex: 'P', birth_y: 1925 })
  const akar = await h.nikah(kakek, nenek)
  await h.aturPangkal(akar)
  const anak = await h.orang('Anak Contoh', { sex: 'L', birth_y: 1950 })
  await h.anak(akar, anak)
  const menantu = await h.orang('Menantu Contoh', { sex: 'P', birth_y: 1952 })
  ua = await h.nikah(anak, menantu)

  lengkap = await orangBaru({ is_deceased: true, death_y: 1998, death_m: 5, death_d: 20 })
  tanpaHari = await orangBaru({ is_deceased: true, death_y: 2008, death_m: 8 })
  hidup = await orangBaru()
  disisihkan = await orangBaru({ is_deceased: true, death_y: 2000, death_m: 1, death_d: 1 })
  await db.query(`update public.people set deleted_at = now(), delete_batch = gen_random_uuid() where id = $1`, [disisihkan])
  const pohon = await h.pohonAsal(menantu)
  asal = await h.orang('Leluhur Asal Contoh', { tree_id: pohon, is_deceased: true, death_y: 1980, death_m: 2, death_d: 10 })

  owner = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  asisten = await a.anggota(nenek, { role: 'asisten', permissions: ['kelola_peringatan'], nama: 'Asisten Contoh' })
  asistenLain = await a.anggota(await orangBaru(), { role: 'asisten', permissions: ['bendahara'], nama: 'Asisten Lain Contoh' })
  biasa = await a.anggota(anak, { nama: 'Anggota Biasa Contoh' })
  lihat = await a.anggota(await orangBaru(), { role: 'lihat', nama: 'Hanya Melihat Contoh' })
}, 60000)

describe('015_peringatan_wafat.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '015_peringatan_wafat.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '015_peringatan_wafat.sql')).toEqual([])
  })
})

describe('membaca dan mengubah pilihan', () => {
  it('anggota biasa, hanya melihat, asisten tanpa izin, dan admin utama tanpa dua langkah ditolak', async () => {
    for (const akun of [biasa, lihat, asistenLain]) {
      await ditolak(baca(akun, lengkap), 'PW001')
      await ditolak(atur(akun, lengkap, true), 'PW001')
    }
    await ditolak(baca(owner, lengkap, 'aal1'), 'PW001')
    await ditolak(atur(owner, lengkap, true, 'aal1'), 'PW001')
    expect(await baca(asisten, lengkap)).toBe(false)
  })

  it('anon sama sekali tidak bisa memanggil fungsinya', async () => {
    for (const [nama, args] of [
      ['set_death_rule', { p_person: lengkap, p_start_next_day: true }],
      ['get_death_rule', { p_person: lengkap }],
      ['death_count_start', { p_person: lengkap }],
    ]) {
      await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, nama, args))).rejects.toThrow(/permission denied/)
    }
  })

  it('tidak ada pengguna yang bisa membaca atau menulis private.death_rules langsung', async () => {
    for (const akun of [biasa, asisten]) {
      await expect(a.lewatApi(akun, (tx) => baris(tx, 'select * from private.death_rules'))).rejects.toThrow(/permission denied/)
      await expect(a.lewatApi(akun, (tx) => baris(tx, 'insert into private.death_rules (person_id, start_next_day) values ($1, true)', [lengkap])))
        .rejects.toThrow(/permission denied/)
    }
    await expect(a.lewatApi(owner, (tx) => baris(tx, 'select * from private.death_rules'), 'aal2')).rejects.toThrow(/permission denied/)
  })

  it('asisten berizin dan admin utama (dua langkah) bisa mengatur dan membaca; pelaku dicatat', async () => {
    expect(await atur(asisten, lengkap, true)).toBe(true)
    expect(await baca(asisten, lengkap)).toBe(true)
    expect(await baca(owner, lengkap, 'aal2')).toBe(true)
    let r = await h.satu('select start_next_day, updated_by from private.death_rules where person_id = $1', [lengkap])
    expect(r).toEqual({ start_next_day: true, updated_by: asisten.memberId })
    expect(await atur(owner, lengkap, false, 'aal2')).toBe(false)
    r = await h.satu('select start_next_day, updated_by from private.death_rules where person_id = $1', [lengkap])
    expect(r).toEqual({ start_next_day: false, updated_by: owner.memberId })
    await atur(asisten, lengkap, true)
  })

  it('hanya untuk yang wafat dengan tanggal wafat lengkap', async () => {
    await ditolak(atur(asisten, hidup, true), 'PW002')
    await ditolak(baca(asisten, hidup), 'PW002')
    await ditolak(atur(asisten, tanpaHari, true), 'PW002')
    await ditolak(atur(owner, tanpaHari, true, 'aal2'), 'PW002')
  })

  it('orang yang tidak ada, disisihkan, atau di pohon asal yang tidak terlihat: tidak ditemukan', async () => {
    await ditolak(atur(asisten, '00000000-0000-0000-0000-000000000000', true), 'PW003')
    await ditolak(atur(asisten, disisihkan, true), 'PW003')
    await ditolak(atur(asisten, asal, true), 'PW003')
    // Admin utama melihat pohon keluarga asal.
    expect(await atur(owner, asal, true, 'aal2')).toBe(true)
  })

  it('asisten yang sedang ditahan masih bisa membaca, tetapi tidak bisa mengubah', async () => {
    await db.query(`update public.members set hold_until = 'infinity', hold_reason = 'uji' where id = $1`, [asisten.memberId])
    try {
      expect(await baca(asisten, lengkap)).toBe(true)
      await ditolak(atur(asisten, lengkap, false), 'PW001')
    } finally {
      await db.query(`update public.members set hold_until = null, hold_reason = null where id = $1`, [asisten.memberId])
    }
  })
})

describe('death_count_start', () => {
  it('memberi tanggal mulai hitungan: tanggal wafat, atau +1 hari kalau dicentang', async () => {
    await atur(asisten, lengkap, true)
    expect(await mulai(biasa, lengkap)).toBe('1998-05-21')
    expect(await mulai(lihat, lengkap)).toBe('1998-05-21')
    await atur(asisten, lengkap, false)
    expect(await mulai(biasa, lengkap)).toBe('1998-05-20')
    await atur(asisten, lengkap, true)
  })

  it('null kalau tanggal wafat tidak lengkap, orangnya masih hidup, disisihkan, atau tidak terlihat', async () => {
    expect(await mulai(biasa, tanpaHari)).toBeNull()
    expect(await mulai(biasa, hidup)).toBeNull()
    expect(await mulai(biasa, disisihkan)).toBeNull()
    expect(await mulai(biasa, asal)).toBeNull()
    expect(await mulai(biasa, '00000000-0000-0000-0000-000000000000')).toBeNull()
    // Admin utama melihat pohon asal (pilihannya dicentang di tes sebelumnya).
    expect(await mulai(owner, asal, 'aal2')).toBe('1980-02-11')
  })

  it('hanya mengembalikan tanggal, tidak pernah nilai pilihannya', async () => {
    const [r] = await baris(db, `select pg_get_function_result('public.death_count_start(uuid)'::regprocedure) as hasil`)
    expect(r.hasil).toBe('date')
  })
})

describe('cadangan (008) menyertakan death_rules', () => {
  let sekar, salinanId
  const isiSalinan = async (id) => (await h.satu('select data, counts from private.snapshots where id = $1', [id]))

  beforeAll(async () => {
    sekar = await orangBaru({ is_deceased: true, death_y: 1998, death_m: 5, death_d: 20 })
    await atur(asisten, sekar, true)
    salinanId = (await h.satu(`select private.take_snapshot('harian') as id`)).id
  })

  it('salinan berisi pilihan itu, beserta jumlahnya', async () => {
    const { data, counts } = await isiSalinan(salinanId)
    expect(data.death_rules).toContainEqual(expect.objectContaining({ person_id: sekar, start_next_day: true, updated_by: asisten.memberId }))
    const [n] = await baris(db, 'select count(*)::int as n from private.death_rules')
    expect(counts.death_rules).toBe(n.n)
  })

  it('isi salinan cukup untuk mengembalikan pilihan Sekar (YA) setelah hilang', async () => {
    await db.query('delete from private.death_rules where person_id = $1', [sekar])
    expect(await baca(asisten, sekar)).toBe(false)
    expect(await mulai(biasa, sekar)).toBe('1998-05-20')
    // Pemulihan sungguhan dibuat di langkah 2.7; di sini isi salinan dikembalikan
    // dengan cara yang sama: baris JSON → baris tabel.
    await db.query(`
      insert into private.death_rules
      select * from jsonb_populate_recordset(null::private.death_rules,
        (select data -> 'death_rules' from private.snapshots where id = $1))
      on conflict (person_id) do update
        set start_next_day = excluded.start_next_day, updated_by = excluded.updated_by, updated_at = excluded.updated_at`, [salinanId])
    expect(await baca(asisten, sekar)).toBe(true)
    expect(await mulai(biasa, sekar)).toBe('1998-05-21')
  })

  it('anggota biasa tetap tidak bisa membaca pilihan itu, juga tidak lewat salinan', async () => {
    await ditolak(baca(biasa, sekar), 'PW001')
    await expect(a.lewatApi(biasa, (tx) => baris(tx, 'select data from private.snapshots'))).rejects.toThrow(/permission denied/)
    await expect(a.lewatApi(biasa, (tx) => baris(tx, 'select private.snapshot_data()'))).rejects.toThrow(/permission denied/)
    await ditolak(a.lewatApi(biasa, (tx) => baris(tx, 'select * from public.list_snapshots()')), 'AK002')
    // Daftar salinan untuk ADMIN MASTER hanya berisi jumlah, bukan isinya.
    const daftar = await a.lewatApi(owner, (tx) => baris(tx, 'select * from public.list_snapshots()'), 'aal2')
    expect(JSON.stringify(daftar)).not.toContain(sekar)
  })
})
