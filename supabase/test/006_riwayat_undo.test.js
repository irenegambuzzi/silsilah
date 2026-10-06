// Tes riwayat, Undo, kotak masuk, dan penahanan otomatis. Semua FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'

let db, h
let kakek, nenek, akar, a, m, uAM, b, n, uBN, t1, bapakM
const akun = {}

const q = (siapa, sql, params, aal) =>
  sebagai(db, 'authenticated', klaimUntuk(akun[siapa], aal ?? 'aal1'), (tx) => baris(tx, sql, params))
const batchTerakhir = async (tabel, id) =>
  (await h.satu(`select batch_id from public.change_log where table_name = $1 and row_key = jsonb_build_object('id', $2::text)
                 order by id desc limit 1`, [tabel, id])).batch_id
const undo = (siapa, batch, aal) => q(siapa, `select public.undo_batch($1) as b`, [batch], aal)
const ditolak = async (janji, kode) => {
  const e = await janji.then(() => null, (err) => err)
  expect(e, `seharusnya ditolak dengan ${kode}`).not.toBeNull()
  expect(e.code).toBe(kode)
  return e
}

async function jadikanAnggota(nama, personId, { role = 'anggota', permissions = [], isOwner = false } = {}) {
  const u = await buatPengguna(db)
  const mem = await h.satu(`insert into public.members (person_id, display_name, role, permissions, is_owner, auth_user_id)
    values ($1, $2, $3, $4, $5, $6) returning id`, [personId, nama, role, permissions, isOwner, u.userId])
  await db.query(`insert into public.devices (member_id, session_id, via) values ($1, $2, 'undangan')`, [mem.id, u.sessionId])
  akun[nama] = { ...u, memberId: mem.id }
}

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql', '003_aturan_silsilah.sql', '004_akses.sql', '005_akses_silsilah.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '006_riwayat_undo.sql')).toEqual([])
  h = pembantuSilsilah(db)
  kakek = await h.orang('Kakek'); nenek = await h.orang('Nenek')
  akar = await h.nikah(kakek, nenek); await h.aturPangkal(akar)
  a = await h.orang('A'); await h.anak(akar, a)
  b = await h.orang('B'); await h.anak(akar, b)
  m = await h.orang('M'); uAM = await h.nikah(a, m)
  n = await h.orang('N'); uBN = await h.nikah(b, n)
  t1 = await h.pohonAsal(m)
  bapakM = await h.orang('Bapak M', { tree_id: t1 })

  await jadikanAnggota('Pemilik Contoh', kakek, { isOwner: true })
  await jadikanAnggota('Asisten Contoh', nenek, { role: 'asisten', permissions: ['batalkan_orang_lain'] })
  await jadikanAnggota('Wulan', a)
  await jadikanAnggota('Ratna', b)
  await jadikanAnggota('Hanya Lihat', n, { role: 'lihat' })
}, 60000)

describe('006_riwayat_undo.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '006_riwayat_undo.sql')).toEqual([])
  })
})

describe('riwayat', () => {
  it('mencatat siapa, apa, kapan, isi lama dan baru, serta kolom yang berubah', async () => {
    await q('Wulan', `update public.people set nickname = 'Panggilan A', birth_y = 1950 where id = $1`, [a])
    const e = await h.satu(`select * from public.change_log where table_name = 'people' and row_key = jsonb_build_object('id', $1::text)
                            order by id desc limit 1`, [a])
    expect(e.op).toBe('ubah')
    expect(e.actor_member_id).toBe(akun.Wulan.memberId)
    expect(e.changed_fields).toEqual(['birth_y', 'nickname'])
    expect(e.old_row.nickname).toBeNull()
    expect(e.new_row.nickname).toBe('Panggilan A')
  })

  it('simpan tanpa perubahan tidak dicatat', async () => {
    const sebelum = (await h.satu(`select count(*)::int as n from public.change_log`)).n
    await q('Wulan', `update public.people set nickname = 'Panggilan A' where id = $1`, [a])
    expect((await h.satu(`select count(*)::int as n from public.change_log`)).n).toBe(sebelum)
  })

  it('"tambah anak" (orang + hubungan) satu batch; urutan lahir otomatis ditandai otomatis', async () => {
    await sebagai(db, 'authenticated', klaimUntuk(akun.Wulan), async (tx) => {
      const { rows: [p] } = await tx.query(`insert into public.people (full_name, birth_y) values ('Cucu Baru', 1980) returning id`)
      await tx.query(`insert into public.children (union_id, child_id, kind, biological_parent) values ($1, $2, 'kandung', 'keduanya')`, [uAM, p.id])
    })
    const cucu = (await h.satu(`select id from public.people where full_name = 'Cucu Baru'`)).id
    const batch = await batchTerakhir('people', cucu)
    const isi = await baris(db, `select table_name, op, automatic from public.change_log where batch_id = $1 order by id`, [batch])
    expect(isi).toEqual([
      { table_name: 'people', op: 'tambah', automatic: false },
      { table_name: 'birth_ranks', op: 'tambah', automatic: true },
      { table_name: 'children', op: 'tambah', automatic: false },
    ])
  })

  it('aplikasi tidak bisa menulis, mengubah, atau menghapus riwayat', async () => {
    await expect(q('Pemilik Contoh', `delete from public.change_log`, [], 'aal2')).rejects.toThrow(/permission denied/)
    await expect(q('Pemilik Contoh', `update public.change_log set actor_member_id = null`, [], 'aal2')).rejects.toThrow(/permission denied/)
    await expect(q('Wulan', `insert into public.change_log (table_name, row_key, op, batch_id) values ('people', '{}', 'ubah', gen_random_uuid())`)).rejects.toThrow(/permission denied/)
  })

  it('"hanya melihat" tidak melihat riwayat; anggota melihat riwayat silsilah utama', async () => {
    expect(await q('Hanya Lihat', `select id from public.change_log`)).toEqual([])
    expect((await q('Ratna', `select id from public.change_log`)).length).toBeGreaterThan(0)
  })

  it('riwayat pohon keluarga asal hanya untuk yang boleh melihat pohon itu', async () => {
    await q('Pemilik Contoh', `update public.people set nickname = 'Pak M' where id = $1`, [bapakM], 'aal2')
    expect(await q('Ratna', `select id from public.change_log where tree_id is not null`)).toEqual([])
    expect((await q('Pemilik Contoh', `select id from public.change_log where tree_id = $1`, [t1], 'aal2')).length).toBeGreaterThan(0)
  })
})

describe('undo', () => {
  it('membatalkan perubahan sendiri: isi kembali, dan pembatalannya juga tercatat', async () => {
    await q('Ratna', `update public.people set occupation = 'Guru' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    const [{ b: batchUndo }] = await undo('Ratna', batch)
    expect((await h.satu(`select occupation from public.people where id = $1`, [b])).occupation).toBeNull()
    const catat = await h.satu(`select undo_of_batch, actor_member_id from public.change_log where batch_id = $1`, [batchUndo])
    expect(catat).toEqual({ undo_of_batch: batch, actor_member_id: akun.Ratna.memberId })
  })

  it('DITOLAK: membatalkan perubahan orang lain tanpa izin; asisten dengan izin boleh', async () => {
    await q('Ratna', `update public.people set occupation = 'Petani' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    await ditolak(undo('Wulan', batch), 'UN006')
    await undo('Asisten Contoh', batch)
    expect((await h.satu(`select occupation from public.people where id = $1`, [b])).occupation).toBeNull()
  })

  it('DITOLAK: data sudah diubah lagi oleh orang lain (pesan menyebut nama dan jam)', async () => {
    await q('Ratna', `update public.people set occupation = 'Dokter' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    await q('Wulan', `update public.people set occupation = 'Perawat' where id = $1`, [b])
    const e = await ditolak(undo('Ratna', batch), 'UN003')
    expect(e.message).toMatch(/sudah diubah lagi oleh Wulan pada .+ WIB/)
    expect((await h.satu(`select occupation from public.people where id = $1`, [b])).occupation).toBe('Perawat')
  })

  it('perubahan sesudahnya pada kolom LAIN tidak menghalangi undo', async () => {
    await q('Ratna', `update public.people set religious_title = 'H.' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    await q('Wulan', `update public.people set birth_place = 'Kota Contoh' where id = $1`, [b])
    await undo('Ratna', batch)
    const r = await h.satu(`select religious_title, birth_place from public.people where id = $1`, [b])
    expect(r).toEqual({ religious_title: null, birth_place: 'Kota Contoh' })
  })

  it('DITOLAK: dibatalkan dua kali; tetapi pembatalan bisa dibatalkan (redo), lalu dibatalkan lagi', async () => {
    await q('Ratna', `update public.people set academic_title = 'S.Pd.' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    const [{ b: u1 }] = await undo('Ratna', batch)
    await ditolak(undo('Ratna', batch), 'UN002')
    await undo('Ratna', u1) // redo
    expect((await h.satu(`select academic_title from public.people where id = $1`, [b])).academic_title).toBe('S.Pd.')
    await undo('Ratna', batch)
    expect((await h.satu(`select academic_title from public.people where id = $1`, [b])).academic_title).toBeNull()
  })

  it('membatalkan "tambah anak" membuang orang DAN hubungannya ke tempat sampah sekaligus', async () => {
    const cucu = (await h.satu(`select id from public.people where full_name = 'Cucu Baru'`)).id
    await undo('Wulan', await batchTerakhir('people', cucu))
    const r = await h.satu(`select (select deleted_at is not null from public.people where id = $1) as orang,
      (select deleted_at is not null from public.children where child_id = $1) as hubungan,
      (select count(*)::int from public.birth_ranks where child_id = $1) as urutan`, [cucu])
    expect(r).toEqual({ orang: true, hubungan: true, urutan: 0 })
  })

  it('DITOLAK: "hanya melihat" dan anggota yang ditahan', async () => {
    await q('Ratna', `update public.people set nickname = 'B kecil' where id = $1`, [b])
    const batch = await batchTerakhir('people', b)
    await ditolak(undo('Hanya Lihat', batch), 'UN008')
  })

  it('DITOLAK: perubahan pohon keluarga asal kecuali oleh admin utama (aal2)', async () => {
    const batch = await batchTerakhir('people', bapakM)
    await ditolak(undo('Asisten Contoh', batch), 'UN007')
    await undo('Pemilik Contoh', batch, 'aal2')
    expect((await h.satu(`select nickname from public.people where id = $1`, [bapakM])).nickname).toBeNull()
  })

  it('DITOLAK: hapus permanen tidak bisa dibatalkan', async () => {
    const x = await h.orang('Akan Dihapus Permanen')
    await db.query(`delete from public.people where id = $1`, [x])
    const batch = (await h.satu(`select batch_id from public.change_log where op = 'hapus_permanen' order by id desc limit 1`)).batch_id
    await ditolak(undo('Pemilik Contoh', batch, 'aal2'), 'UN004')
  })

  it('DITOLAK: batch yang tidak ada', async () => {
    await ditolak(undo('Wulan', '00000000-0000-0000-0000-000000000000'), 'UN001')
  })

  it('urutan lahir yang digeser manual bisa dibatalkan', async () => {
    const c1 = await h.orang('Anak Satu', { birth_y: 1975 }); await h.anak(uBN, c1)
    const c2 = await h.orang('Anak Dua', { birth_y: 1977 }); await h.anak(uBN, c2)
    await q('Ratna', `select public.move_birth_rank($1, $2, 1)`, [b, c2])
    expect((await h.urutan(b)).map((r) => r.child_id)).toEqual([c2, c1])
    const batch = (await h.satu(`select batch_id from public.change_log where table_name = 'birth_ranks' and not automatic order by id desc limit 1`)).batch_id
    await undo('Ratna', batch)
    expect((await h.urutan(b)).map((r) => r.child_id)).toEqual([c1, c2])
  })
})

describe('aktivitas tidak wajar', () => {
  beforeAll(async () => {
    await db.query(`update public.settings set anomaly_max_changes = 5, anomaly_window_minutes = 10`)
  })

  it('lebih dari batas perubahan dalam jendela waktu → ditahan, hanya bisa membaca, admin diberi tahu', async () => {
    for (let i = 1; i <= 6; i++) {
      await q('Wulan', `update public.people set notes = $2 where id = $1`, [a, `catatan ${i}`])
    }
    const r = await h.satu(`select hold_until = 'infinity' as selamanya, hold_reason from public.members where id = $1`, [akun.Wulan.memberId])
    expect(r.selamanya).toBe(true)
    expect(r.hold_reason).toMatch(/lebih dari 5 perubahan dalam 10 menit/)
    await expect(q('Wulan', `insert into public.people (full_name) values ('Setelah ditahan')`)).rejects.toThrow(/row-level security/)
    expect((await q('Wulan', `select count(*)::int as n from public.people`))[0].n).toBeGreaterThan(0)
    const notif = await q('Pemilik Contoh', `select kind, title, priority from public.notifications`)
    expect(notif).toContainEqual({ kind: 'aktivitas_tidak_wajar', title: 'Wulan ditahan sementara', priority: 'penting' })
  })

  it('anggota yang ditahan tidak bisa membatalkan, tetapi tetap bisa melihat riwayat', async () => {
    const batch = await batchTerakhir('people', a)
    await ditolak(undo('Wulan', batch), 'UN008')
    expect((await q('Wulan', `select id from public.change_log`)).length).toBeGreaterThan(0)
  })

  it('admin utama tidak pernah ditahan', async () => {
    for (let i = 1; i <= 8; i++) {
      await q('Pemilik Contoh', `update public.people set notes = $2 where id = $1`, [kakek, `admin ${i}`], 'aal2')
    }
    expect((await h.satu(`select hold_until from public.members where is_owner`)).hold_until).toBeNull()
  })

  it('hanya admin utama (aal2) yang bisa melepas penahanan', async () => {
    await ditolak(q('Asisten Contoh', `select public.release_hold($1)`, [akun.Wulan.memberId]), 'AK002')
    await ditolak(q('Pemilik Contoh', `select public.release_hold($1)`, [akun.Wulan.memberId], 'aal1'), 'AK002')
    await q('Pemilik Contoh', `select public.release_hold($1)`, [akun.Wulan.memberId], 'aal2')
    expect((await h.satu(`select hold_until from public.members where id = $1`, [akun.Wulan.memberId])).hold_until).toBeNull()
  })

  it('anggota tidak bisa melepas penahanannya sendiri atau memasang penahanan orang lain', async () => {
    await expect(q('Ratna', `update public.members set hold_until = null where id = $1`, [akun.Ratna.memberId])).rejects.toThrow(/permission denied/)
  })
})

describe('kotak masuk', () => {
  it('setiap anggota hanya melihat pesannya sendiri, dan hanya bisa menandai dibaca', async () => {
    expect(await q('Ratna', `select id from public.notifications`)).toEqual([])
    const [p] = await q('Pemilik Contoh', `select id from public.notifications limit 1`)
    expect(await q('Ratna', `update public.notifications set read_at = now() where id = $1 returning id`, [p.id])).toEqual([])
    expect(await q('Pemilik Contoh', `update public.notifications set read_at = now() where id = $1 returning id`, [p.id])).toHaveLength(1)
    await expect(q('Pemilik Contoh', `update public.notifications set title = 'x' where id = $1`, [p.id])).rejects.toThrow(/permission denied/)
  })
})
