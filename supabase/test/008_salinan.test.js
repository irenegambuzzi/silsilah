// Tes salinan otomatis. Semua data FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'

let db, h, uAB
const akun = {}
const q = (siapa, sql, params, aal) =>
  sebagai(db, 'authenticated', klaimUntuk(akun[siapa], aal ?? 'aal1'), (tx) => baris(tx, sql, params))
const harian = async () => (await h.satu(`select private.daily_snapshot() as r`)).r
const jumlahSalinan = async (jenis = 'harian') =>
  (await h.satu(`select count(*)::int as n from private.snapshots where kind = $1`, [jenis])).n

async function jadikanAnggota(nama, personId, { isOwner = false } = {}) {
  const u = await buatPengguna(db)
  const mem = await h.satu(`insert into public.members (person_id, display_name, is_owner, auth_user_id)
    values ($1, $2, $3, $4) returning id`, [personId, nama, isOwner, u.userId])
  await db.query(`insert into public.devices (member_id, session_id, via) values ($1, $2, 'undangan')`, [mem.id, u.sessionId])
  akun[nama] = { ...u, memberId: mem.id }
}

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql', '003_aturan_silsilah.sql', '004_akses.sql',
                   '005_akses_silsilah.sql', '006_riwayat_undo.sql', '007_disisihkan_laporan.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '008_salinan.sql')).toEqual([])
  h = pembantuSilsilah(db)
  const kakek = await h.orang('Kakek'); const nenek = await h.orang('Nenek')
  const akar = await h.nikah(kakek, nenek); await h.aturPangkal(akar)
  const a = await h.orang('A'); await h.anak(akar, a)
  uAB = await h.nikah(a, await h.orang('Pasangan A'))
  await jadikanAnggota('Pemilik', kakek, { isOwner: true })
  await jadikanAnggota('Anggota', a)
}, 60000)

describe('008_salinan.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '008_salinan.sql')).toEqual([])
  })
})

describe('salinan harian', () => {
  it('dibuat pertama kali; tidak dibuat lagi kalau tidak ada perubahan', async () => {
    expect(await harian()).toBe('dibuat')
    expect(await harian()).toBe('tidak ada perubahan')
    expect(await jumlahSalinan()).toBe(1)
  })

  it('dibuat lagi setelah ada perubahan silsilah', async () => {
    await h.orang('Orang Baru')
    expect(await harian()).toMatch(/^dibuat/)
  })

  it('perubahan yang tidak tercatat di riwayat (anggota baru) juga terhitung', async () => {
    const x = await h.orang('Calon Anggota'); await h.anak(uAB, x)
    await harian()
    await jadikanAnggota('Anggota Baru', x)
    expect(await harian()).toMatch(/^dibuat/)
  })

  it('isi: tabel data dan jumlah barisnya; tanpa riwayat, perangkat, undangan, IP', async () => {
    const s = await h.satu(`select counts, data from private.snapshots order by id desc limit 1`)
    expect(Object.keys(s.data).sort()).toEqual(['birth_ranks', 'children', 'members', 'origin_tree_access', 'origin_trees',
      'people', 'reports', 'settings', 'unions'])
    expect(s.counts.people).toBe((await h.satu(`select count(*)::int as n from public.people`)).n)
    expect(s.data.people.map((p) => p.full_name)).toContain('Orang Baru')
    for (const tidak of ['change_log', 'devices', 'invites', 'login_ips', 'auth_events', 'notifications']) {
      expect(s.data[tidak]).toBeUndefined()
    }
  })

  it('tidak bisa dibaca atau dijalankan lewat aplikasi', async () => {
    await expect(q('Pemilik', `select * from private.snapshots`, [], 'aal2')).rejects.toThrow(/permission denied/)
    await expect(q('Pemilik', `select private.daily_snapshot()`, [], 'aal2')).rejects.toThrow(/permission denied/)
  })
})

describe('salinan otomatis sebelum hapus permanen (BUKTI)', () => {
  it('hapus permanen membuat salinan khusus yang masih berisi data yang dihapus', async () => {
    const ganda = await h.orang('Ganda Untuk Dihapus')
    const kelompok = (await q('Pemilik', `select public.move_to_trash('people', $1) as b`, [ganda], 'aal2'))[0].b
    const sebelum = await jumlahSalinan('sebelum_hapus_permanen')
    await q('Pemilik', `select public.purge_batch($1, 'HAPUS')`, [kelompok], 'aal2')
    expect(await h.satu(`select id from public.people where id = $1`, [ganda])).toBeUndefined()
    expect(await jumlahSalinan('sebelum_hapus_permanen')).toBe(sebelum + 1)
    const s = await h.satu(`select data, detail, taken_by from private.snapshots
                            where kind = 'sebelum_hapus_permanen' order by id desc limit 1`)
    expect(s.detail).toEqual({ delete_batch: kelompok })
    expect(s.taken_by).toBe(akun.Pemilik.memberId)
    const diSalinan = s.data.people.find((p) => p.id === ganda)
    expect(diSalinan.full_name).toBe('Ganda Untuk Dihapus')
    expect(diSalinan.delete_batch).toBe(kelompok)
  })

  it('menghapus permanen semua data yang disisihkan juga membuat salinan dulu', async () => {
    const x = await h.orang('Ganda Dua')
    await q('Pemilik', `select public.move_to_trash('people', $1)`, [x], 'aal2')
    const sebelum = await jumlahSalinan('sebelum_hapus_permanen')
    await q('Pemilik', `select public.empty_trash('HAPUS')`, [], 'aal2')
    expect(await jumlahSalinan('sebelum_hapus_permanen')).toBe(sebelum + 1)
  })

  it('kalau hapus permanen gagal, salinannya juga tidak tertinggal (satu transaksi)', async () => {
    const sebelum = await jumlahSalinan('sebelum_hapus_permanen')
    await expect(q('Pemilik', `select public.purge_batch(gen_random_uuid(), 'HAPUS')`, [], 'aal2')).rejects.toThrow()
    expect(await jumlahSalinan('sebelum_hapus_permanen')).toBe(sebelum)
  })
})

describe('perapian salinan', () => {
  // 400 salinan harian buatan, satu per hari (pukul 02.00 WIB), sampai
  // "sekarang" = 6 Oktober 2026 12.00 WIB.
  const SEKARANG = new Date('2026-10-06T05:00:00Z')
  const hariKe = (i) => new Date(Date.UTC(2026, 9, 6, -5) - i * 86400000) // 02.00 WIB = 19.00 UTC sehari sebelumnya
  // Perhitungan terpisah (JavaScript) dari aturan yang sama, dalam WIB.
  const wib = (d) => new Date(d.getTime() + 7 * 3600000)
  const kunciHari = (d) => wib(d).toISOString().slice(0, 10)
  const kunciBulan = (d) => wib(d).toISOString().slice(0, 7)
  const senin = (d) => { const x = wib(d); const hari = (x.getUTCDay() + 6) % 7; return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - hari)) }
  const kunciMinggu = (d) => senin(d).toISOString().slice(0, 10)

  let ids
  beforeAll(async () => {
    await db.query(`delete from private.snapshots`)
    ids = []
    for (let i = 0; i < 400; i++) {
      const r = await h.satu(`insert into private.snapshots (taken_at, kind, checksum, counts, data)
                              values ($1, 'harian', 'x', '{}', '{}') returning id`, [hariKe(i).toISOString()])
      ids.push({ id: Number(r.id), t: hariKe(i) })
    }
    // Dua salinan di hari yang sama: hanya yang terakhir disimpan.
    const pagi = new Date(hariKe(0).getTime() - 3600000)
    const r = await h.satu(`insert into private.snapshots (taken_at, kind, checksum, counts, data)
                            values ($1, 'harian', 'x', '{}', '{}') returning id`, [pagi.toISOString()])
    ids.push({ id: Number(r.id), t: pagi, ganda: true })
    // Salinan khusus.
    for (const [jenis, bulanLalu] of [['sebelum_hapus_permanen', 11], ['sebelum_hapus_permanen', 13], ['sebelum_migrasi', 36], ['sebelum_impor', 13]]) {
      await db.query(`insert into private.snapshots (taken_at, kind, checksum, counts, data)
                      values ($1::timestamptz - make_interval(months => $2), $3, 'x', '{}', '{}')`, [SEKARANG.toISOString(), bulanLalu, jenis])
    }
    await db.query(`select private.prune_snapshots($1)`, [SEKARANG.toISOString()])
  })

  it('sesuai perhitungan terpisah: 30 terbaru + terakhir tiap minggu (12) + terakhir tiap bulan (12)', async () => {
    const urut = ids.filter((x) => !x.ganda).sort((p, q) => q.t - p.t)
    const harus = new Set(urut.slice(0, 30).map((x) => x.id))
    const mingguIni = senin(SEKARANG).getTime()
    const bulanIni = kunciBulan(SEKARANG)
    const [th, bl] = bulanIni.split('-').map(Number)
    const bulanBatas = new Date(Date.UTC(th, bl - 1 - 11, 1)).toISOString().slice(0, 7)
    const terakhirPer = (kunci) => {
      const peta = new Map()
      for (const x of urut) if (!peta.has(kunci(x.t))) peta.set(kunci(x.t), x) // urut terbaru dulu
      return peta
    }
    for (const [k, x] of terakhirPer(kunciMinggu)) if (new Date(k).getTime() > mingguIni - 12 * 7 * 86400000) harus.add(x.id)
    for (const [k, x] of terakhirPer(kunciBulan)) if (k >= bulanBatas) harus.add(x.id)

    const tersisa = new Set((await baris(db, `select id from private.snapshots where kind = 'harian'`)).map((r) => Number(r.id)))
    expect([...tersisa].sort((p, q) => p - q)).toEqual([...harus].sort((p, q) => p - q))
    // 30 hari + akhir minggu/bulan yang lebih tua dari 30 hari; tidak pernah lebih dari 30 + 12 + 12.
    expect(tersisa.size).toBeGreaterThan(30)
    expect(tersisa.size).toBeLessThanOrEqual(54)
  })

  it('contoh nyata: kemarin disimpan; 45 hari lalu dihapus; 31 Agustus disimpan (akhir bulan)', async () => {
    const ada = async (d) => (await h.satu(`select count(*)::int as n from private.snapshots
       where kind = 'harian' and (taken_at at time zone 'Asia/Jakarta')::date = $1::date`, [kunciHari(d)])).n
    expect(await ada(hariKe(1))).toBe(1)
    expect(await ada(hariKe(45))).toBe(0) // bukan akhir minggu/bulan, di luar 30 hari
    expect(await ada(new Date('2026-08-30T19:00:00Z'))).toBe(1) // 31 Agustus 02.00 WIB
  })

  it('hanya satu salinan harian per hari (yang terakhir)', async () => {
    expect(await h.satu(`select id from private.snapshots where id = $1`, [ids.find((x) => x.ganda).id])).toBeUndefined()
  })

  it('tidak ada salinan harian yang lebih tua dari 12 bulan', async () => {
    const r = await h.satu(`select min(taken_at) as tertua from private.snapshots where kind = 'harian'`)
    expect(new Date(r.tertua) >= new Date('2025-11-01T00:00:00+07:00')).toBe(true)
  })

  it('salinan khusus: 12 bulan; "sebelum_migrasi" selamanya', async () => {
    const r = await baris(db, `select kind, extract(month from age($1::timestamptz, taken_at))
                                 + 12 * extract(year from age($1::timestamptz, taken_at)) as bulan
                               from private.snapshots where kind <> 'harian' order by kind, bulan`, [SEKARANG.toISOString()])
    expect(r.map((x) => [x.kind, Number(x.bulan)])).toEqual([['sebelum_hapus_permanen', 11], ['sebelum_migrasi', 36]])
  })
})

describe('daftar salinan untuk admin', () => {
  it('hanya admin utama (aal2), tanpa isi salinan', async () => {
    await expect(q('Anggota', `select * from public.list_snapshots()`)).rejects.toThrow(/admin utama/)
    await expect(q('Pemilik', `select * from public.list_snapshots()`, [], 'aal1')).rejects.toThrow(/admin utama/)
    const r = await q('Pemilik', `select * from public.list_snapshots()`, [], 'aal2')
    expect(r.length).toBeGreaterThan(0)
    expect(Object.keys(r[0]).sort()).toEqual(['counts', 'detail', 'id', 'kind', 'size_bytes', 'taken_at'])
  })
})
