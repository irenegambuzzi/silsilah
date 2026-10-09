// Tes siapa boleh membaca/mengubah apa. Semua orang FIKTIF.
//
//   Kakek + Nenek (pangkal)
//   ├─ A (L) + M (istri; pasangan khusus, pohon asal T1)   + W (istri ke-2)
//   │   ├─ cAM       (kandung A&M)       → keturunan darah M
//   │   │   └─ cicit (kandung)           → keturunan darah M
//   │   ├─ cSambung  (anak M dari sebelumnya) → keturunan darah M
//   │   ├─ cAngkat   (anak angkat A&M)   → BUKAN keturunan darah M
//   │   └─ cAW       (kandung A&W)       → BUKAN keturunan darah M
//   └─ B (P) + N (suami; pasangan khusus, pohon asal T2)
//       └─ cBN
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak } from './pembantu-akses.js'

let db, h
let kakek, nenek, akar, a, m, w, uAM, uAW, b, n, uBN
let cAM, cicit, cSambung, cAngkat, cAW, cBN, cDitahan, disisih
let t1, t2, bapakM, ibuM, uOrtuM, bapakN
const akun = {}

const lewat = (siapa, fn, aal) => sebagai(db, 'authenticated', klaimUntuk(akun[siapa], aal ?? akun[siapa].aal ?? 'aal1'), fn)
const q = (siapa, sql, params, aal) => lewat(siapa, (tx) => baris(tx, sql, params), aal)
const namaTerlihat = async (siapa, aal) => (await q(siapa, `select full_name from public.people order by full_name`, [], aal)).map((r) => r.full_name)
const pohonTerlihat = async (siapa, aal) => (await q(siapa, `select id from public.origin_trees`, [], aal)).map((r) => r.id).sort()
const ditolakRls = (janji) => expect(janji).rejects.toThrow(/row-level security/)
const ditolakHak = (janji) => expect(janji).rejects.toThrow(/permission denied/)

async function jadikanAnggota(nama, personId, { role = 'anggota', permissions = [], isOwner = false } = {}) {
  const u = await buatPengguna(db)
  const mem = await h.satu(`insert into public.members (person_id, display_name, role, permissions, is_owner, auth_user_id)
    values ($1, $2, $3, $4, $5, $6) returning id`, [personId, nama, role, permissions, isOwner, u.userId])
  const d = await h.satu(`insert into public.devices (member_id, session_id, via) values ($1, $2, 'undangan') returning id`, [mem.id, u.sessionId])
  akun[nama] = { ...u, memberId: mem.id, deviceId: d.id }
}

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql', '003_aturan_silsilah.sql', '004_akses.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '005_akses_silsilah.sql')).toEqual([])
  h = pembantuSilsilah(db)

  kakek = await h.orang('Kakek'); nenek = await h.orang('Nenek')
  akar = await h.nikah(kakek, nenek); await h.aturPangkal(akar)
  a = await h.orang('A', { birth_y: 1950 }); await h.anak(akar, a)
  b = await h.orang('B', { birth_y: 1952 }); await h.anak(akar, b)
  m = await h.orang('M'); w = await h.orang('W'); n = await h.orang('N')
  uAM = await h.nikah(a, m, { sort_order: 1 }); uAW = await h.nikah(a, w, { sort_order: 2 }); uBN = await h.nikah(b, n)
  cAM = await h.orang('cAM', { birth_y: 1975 }); await h.anak(uAM, cAM)
  cSambung = await h.orang('cSambung', { birth_y: 1970 }); await h.anak(uAM, cSambung, 'sambung', 'partner2')
  cAngkat = await h.orang('cAngkat', { birth_y: 1978 }); await h.anak(uAM, cAngkat, 'angkat')
  cAW = await h.orang('cAW', { birth_y: 1985 }); await h.anak(uAW, cAW)
  cBN = await h.orang('cBN', { birth_y: 1980 }); await h.anak(uBN, cBN)
  cDitahan = await h.orang('cDitahan', { birth_y: 1982 }); await h.anak(uBN, cDitahan)
  const uCicit = await h.nikah(cAM, await h.orang('Pasangan cAM'))
  cicit = await h.orang('cicit', { birth_y: 2000 }); await h.anak(uCicit, cicit)
  disisih = await h.orang('Data Ganda (disisihkan)')
  await db.query(`update public.people set deleted_at = now(), delete_batch = gen_random_uuid() where id = $1`, [disisih])

  t1 = await h.pohonAsal(m); t2 = await h.pohonAsal(n)
  bapakM = await h.orang('Bapak M', { tree_id: t1 }); ibuM = await h.orang('Ibu M', { tree_id: t1 })
  uOrtuM = await h.nikah(bapakM, ibuM); await h.anak(uOrtuM, m)
  bapakN = await h.orang('Bapak N', { tree_id: t2 })

  await jadikanAnggota('pemilik', b, { isOwner: true })
  await jadikanAnggota('asistenSisih', kakek, { role: 'asisten', permissions: ['sisihkan', 'lihat_anggota'] })
  await jadikanAnggota('anggotaA', a)
  await jadikanAnggota('lihatAW', cAW, { role: 'lihat' })
  await jadikanAnggota('anchorM', m)
  await jadikanAnggota('memberAM', cAM)
  await jadikanAnggota('memberSambung', cSambung)
  await jadikanAnggota('memberAngkat', cAngkat)
  await jadikanAnggota('ditahan', cDitahan)
  await db.query(`update public.members set hold_until = 'infinity' where id = $1`, [akun.ditahan.memberId])
  await jadikanAnggota('asistenStatus', cicit, { role: 'asisten', permissions: ['status_pernikahan'] })
  await jadikanAnggota('dicabut', nenek)
  await db.query(`update public.devices set revoked_at = now() where id = $1`, [akun.dicabut.deviceId])
  akun.tanpaPerangkat = await buatPengguna(db)
}, 60000)

// Semua orang di silsilah utama yang tidak disisihkan (dibaca sebagai pemilik database).
const utamaAktif = async () =>
  (await baris(db, `select full_name from public.people where tree_id is null and deleted_at is null order by full_name`)).map((r) => r.full_name)

describe('005_akses_silsilah.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '005_akses_silsilah.sql')).toEqual([])
  })
})

describe('tamu, akun tanpa perangkat, perangkat dicabut', () => {
  it('tamu (anon) ditolak sama sekali', async () => {
    for (const t of ['people', 'unions', 'children', 'birth_ranks', 'origin_trees', 'settings', 'members', 'devices']) {
      await ditolakHak(sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from public.${t}`)))
    }
    await ditolakHak(sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from public.member_names()`)))
  })
  it('login tanpa perangkat terdaftar, atau perangkat dicabut: tidak melihat apa pun', async () => {
    for (const siapa of ['tanpaPerangkat', 'dicabut']) {
      expect(await namaTerlihat(siapa)).toEqual([])
      expect(await q(siapa, `select * from public.settings`)).toEqual([])
      expect(await q(siapa, `select * from public.member_names()`)).toEqual([])
      expect(await pohonTerlihat(siapa)).toEqual([])
    }
  })
})

describe('silsilah utama', () => {
  it('semua anggota (termasuk "hanya melihat") membaca silsilah utama, tanpa data yang disisihkan', async () => {
    for (const siapa of ['lihatAW', 'anggotaA', 'ditahan', 'memberAngkat']) {
      expect(await namaTerlihat(siapa), siapa).toEqual(await utamaAktif())
    }
  })

  it('"hanya melihat" tidak bisa menambah atau mengubah', async () => {
    await ditolakRls(q('lihatAW', `insert into public.people (full_name) values ('Baru dari lihat')`))
    const r = await q('lihatAW', `update public.people set nickname = 'diubah' where id = $1 returning id`, [cBN])
    expect(r).toEqual([])
    expect((await h.satu(`select nickname from public.people where id = $1`, [cBN])).nickname).toBeNull()
  })

  it('anggota bisa menambah dan mengubah', async () => {
    const [baru] = await q('anggotaA', `insert into public.people (full_name) values ('Ditambah anggota') returning id`)
    expect(baru.id).toBeTruthy()
    const r = await q('anggotaA', `update public.people set nickname = 'Panggilan' where id = $1 returning version`, [cBN])
    expect(r).toEqual([{ version: 2 }])
  })

  it('anggota tidak bisa menghapus, menyisihkan langsung, atau menulis kolom sistem', async () => {
    await ditolakHak(q('anggotaA', `delete from public.people where id = $1`, [cBN]))
    await ditolakHak(q('anggotaA', `update public.people set deleted_at = now(), delete_batch = gen_random_uuid() where id = $1`, [cBN]))
    await ditolakHak(q('anggotaA', `update public.people set version = 1 where id = $1`, [cBN]))
    await ditolakHak(q('anggotaA', `update public.people set created_by = null where id = $1`, [cBN]))
    await ditolakHak(q('anggotaA', `insert into public.people (full_name, legacy_id) values ('x', 'y')`))
  })

  it('anggota yang ditahan hanya bisa membaca', async () => {
    await ditolakRls(q('ditahan', `insert into public.people (full_name) values ('Dari yang ditahan')`))
  })

  it('data yang disisihkan hanya terlihat oleh izin "sisihkan", dan tidak bisa diubah', async () => {
    expect(await namaTerlihat('asistenSisih')).toContain('Data Ganda (disisihkan)')
    expect(await namaTerlihat('anggotaA')).not.toContain('Data Ganda (disisihkan)')
    expect(await q('asistenSisih', `update public.people set nickname = 'x' where id = $1 returning id`, [disisih])).toEqual([])
  })

  it('urutan lahir: anggota bisa menggeser, "hanya melihat" tidak', async () => {
    const urutan = async () => (await h.urutan(a)).map((r) => r.child_id)
    const awal = await urutan()
    await q('lihatAW', `select public.move_birth_rank($1, $2, 1)`, [a, cAW])
    expect(await urutan()).toEqual(awal)
    await q('anggotaA', `select public.move_birth_rank($1, $2, 1)`, [a, cAW])
    expect((await urutan())[0]).toBe(cAW)
    await ditolakHak(q('anggotaA', `insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, 99)`, [a, cAM]))
  })

  it('anggota tidak bisa menulis ke pohon keluarga asal', async () => {
    await ditolakRls(q('anggotaA', `insert into public.people (full_name, tree_id) values ('Penyusup', $1)`, [t1]))
  })
})

describe('pohon keluarga asal', () => {
  const grantAll = (tree, on) => q('pemilik', `update public.origin_trees set grant_all_descendants = $2 where id = $1`, [tree, on], 'aal2')

  it('awalnya hanya admin utama (dengan aal2) yang melihatnya', async () => {
    expect(await pohonTerlihat('pemilik', 'aal2')).toEqual([t1, t2].sort())
    expect(await pohonTerlihat('pemilik', 'aal1')).toEqual([])
    for (const siapa of ['anchorM', 'memberAM', 'memberSambung', 'anggotaA', 'asistenSisih']) {
      expect(await pohonTerlihat(siapa), siapa).toEqual([])
    }
  })

  it('"Beri akses ke semua keturunan M": keturunan darah M (dan M sendiri) melihat T1, bukan T2', async () => {
    await grantAll(t1, true)
    for (const siapa of ['anchorM', 'memberAM', 'memberSambung']) {
      expect(await pohonTerlihat(siapa), siapa).toEqual([t1])
      expect(await namaTerlihat(siapa), siapa).toEqual([...(await utamaAktif()), 'Bapak M', 'Ibu M'].sort())
    }
  })

  it('yang bukan keturunan darah M tetap tidak melihat: suami, anak angkat, anak dari istri lain', async () => {
    for (const siapa of ['anggotaA', 'memberAngkat', 'lihatAW']) {
      expect(await pohonTerlihat(siapa), siapa).toEqual([])
      expect(await namaTerlihat(siapa), siapa).toEqual(await utamaAktif())
    }
  })

  it('keturunan yang ditambahkan NANTI otomatis mendapat akses', async () => {
    const uCicit = (await h.satu(`select id from public.unions where partner1_id = $1`, [cAM])).id
    const bayi = await h.orang('Bayi Baru', { birth_y: 2020 })
    await h.anak(uCicit, bayi)
    await jadikanAnggota('bayiBaru', bayi)
    expect(await pohonTerlihat('bayiBaru')).toEqual([t1])
  })

  it('izin per orang: "izinkan" membuka, "tolak" menutup walaupun keturunan', async () => {
    await q('pemilik', `insert into public.origin_tree_access (tree_id, member_id, mode) values ($1, $2, 'izinkan')`, [t1, akun.lihatAW.memberId], 'aal2')
    expect(await pohonTerlihat('lihatAW')).toEqual([t1])
    await q('pemilik', `insert into public.origin_tree_access (tree_id, member_id, mode) values ($1, $2, 'tolak')`, [t1, akun.memberAM.memberId], 'aal2')
    expect(await pohonTerlihat('memberAM')).toEqual([])
  })

  it('sakelar dimatikan: hanya admin utama yang masih melihat', async () => {
    await q('pemilik', `update public.origin_trees set is_active = false where id = $1`, [t1], 'aal2')
    for (const siapa of ['anchorM', 'memberSambung', 'lihatAW']) expect(await pohonTerlihat(siapa), siapa).toEqual([])
    expect(await pohonTerlihat('pemilik', 'aal2')).toEqual([t1, t2].sort())
    await q('pemilik', `update public.origin_trees set is_active = true where id = $1`, [t1], 'aal2')
  })

  it('hanya admin utama (aal2) yang bisa menulis di pohon keluarga asal dan mengatur aksesnya', async () => {
    const [r] = await q('pemilik', `insert into public.people (full_name, tree_id) values ('Kakek M', $1) returning tree_id`, [t1], 'aal2')
    expect(r.tree_id).toBe(t1)
    await ditolakRls(q('pemilik', `insert into public.people (full_name, tree_id) values ('Tanpa aal2', $1)`, [t1], 'aal1'))
    await ditolakRls(q('anchorM', `insert into public.people (full_name, tree_id) values ('Dari M', $1)`, [t1]))
    expect(await q('anchorM', `update public.people set nickname = 'x' where id = $1 returning id`, [bapakM])).toEqual([])
    await ditolakRls(q('asistenSisih', `insert into public.origin_tree_access (tree_id, member_id, mode) values ($1, $2, 'izinkan')`, [t2, akun.anggotaA.memberId]))
    expect(await q('anchorM', `update public.origin_trees set grant_all_descendants = false where id = $1 returning id`, [t1])).toEqual([])
  })

  it('BUKTI: tanpa akses, tidak ada satu pun jejak pohon keluarga asal yang terbaca', async () => {
    const siapa = 'memberAngkat'
    for (const t of ['people', 'unions', 'children', 'birth_ranks']) {
      expect(await q(siapa, `select * from public.${t} where tree_id is not null`), t).toEqual([])
      expect(await q(siapa, `select * from public.${t} where tree_id = $1 or tree_id = $2`, [t1, t2]), t).toEqual([])
    }
    expect(await q(siapa, `select * from public.origin_trees`)).toEqual([])
    expect(await q(siapa, `select * from public.origin_tree_access`)).toEqual([])
    // Sambungan resmi M → orang tuanya (baris anak di pohon T1) juga tidak terlihat.
    expect(await q(siapa, `select * from public.children where child_id = $1`, [m])).toEqual([])
    expect(await q(siapa, `select * from public.birth_rank_warnings($1)`, [bapakM])).toEqual([])
    expect(await q(siapa, `select * from public.people where id in ($1, $2, $3)`, [bapakM, ibuM, bapakN])).toEqual([])
  })
})

describe('pengaturan, anggota, perangkat', () => {
  it('pengaturan: semua anggota membaca; hanya admin utama (aal2) mengubah', async () => {
    expect((await q('lihatAW', `select near_radius_km from public.settings`))[0].near_radius_km).toBe(50)
    expect(await q('anggotaA', `update public.settings set near_radius_km = 1 returning id`)).toEqual([])
    expect(await q('pemilik', `update public.settings set near_radius_km = 1 returning id`, [], 'aal1')).toEqual([])
    expect(await q('pemilik', `update public.settings set near_radius_km = 60 returning near_radius_km`, [], 'aal2')).toEqual([{ near_radius_km: 60 }])
  })

  it('anggota: melihat barisnya sendiri; daftar lengkap hanya dengan izin "lihat_anggota"', async () => {
    expect((await q('anggotaA', `select id from public.members`)).map((r) => r.id)).toEqual([akun.anggotaA.memberId])
    expect((await q('asistenSisih', `select id from public.members`)).length).toBeGreaterThan(5)
  })

  it('nama semua anggota tersedia untuk riwayat, tanpa kolom lain', async () => {
    const r = await q('lihatAW', `select * from public.member_names()`)
    expect(r.length).toBeGreaterThan(5)
    expect(Object.keys(r[0]).sort()).toEqual(['display_name', 'id', 'person_id'])
  })

  it('anggota bisa mengganti nama tampilannya sendiri, bukan milik orang lain atau perannya', async () => {
    expect(await q('anggotaA', `update public.members set display_name = 'A Baru' where id = $1 returning id`, [akun.anggotaA.memberId])).toHaveLength(1)
    expect(await q('anggotaA', `update public.members set display_name = 'X' where id = $1 returning id`, [akun.lihatAW.memberId])).toEqual([])
    await ditolakHak(q('anggotaA', `update public.members set role = 'asisten' where id = $1`, [akun.anggotaA.memberId]))
  })

  it('perangkat: hanya milik sendiri (admin utama melihat semua); tidak bisa mencabut lewat ubah langsung', async () => {
    expect((await q('anggotaA', `select id from public.devices`)).map((r) => r.id)).toEqual([akun.anggotaA.deviceId])
    expect((await q('pemilik', `select id from public.devices`, [], 'aal2')).length).toBeGreaterThan(5)
    expect(await q('anggotaA', `update public.devices set label = 'HP saya' where id = $1 returning id`, [akun.anggotaA.deviceId])).toHaveLength(1)
    expect(await q('anggotaA', `update public.devices set label = 'x' where id = $1 returning id`, [akun.lihatAW.deviceId])).toEqual([])
    await ditolakHak(q('anggotaA', `update public.devices set revoked_at = now() where id = $1`, [akun.anggotaA.deviceId]))
  })
})

describe('status pernikahan', () => {
  const statusUAW = async () => (await h.satu(`select status from public.unions where id = $1`, [uAW])).status
  const ubahUAW = (siapa, status, aal) => q(siapa, `update public.unions set status = $1 where id = $2 returning id`, [status, uAW], aal)

  it('menandai berpisah: anggota yang bukan salah satu pasangan ditolak, termasuk anaknya sendiri', async () => {
    await ditolak(ubahUAW('memberAM', 'cerai'), 'SL010')
    await ditolak(ubahUAW('asistenSisih', 'cerai'), 'SL010') // asisten tanpa izin "status_pernikahan"
    await ditolak(ubahUAW('pemilik', 'cerai', 'aal1'), 'SL010') // admin utama tanpa verifikasi dua langkah
    expect(await statusUAW()).toBe('menikah')
  })

  it('salah satu dari kedua pasangan boleh menandai dan membatalkan', async () => {
    expect(await ubahUAW('anggotaA', 'cerai')).toHaveLength(1)
    expect(await statusUAW()).toBe('cerai')
    await ditolak(ubahUAW('memberAM', 'menikah'), 'SL010') // membatalkan juga dijaga
    expect(await ubahUAW('anggotaA', 'menikah')).toHaveLength(1)
  })

  it('admin utama (aal2) dan asisten dengan izin "status_pernikahan" boleh', async () => {
    expect(await ubahUAW('pemilik', 'cerai', 'aal2')).toHaveLength(1)
    expect(await ubahUAW('asistenStatus', 'menikah')).toHaveLength(1)
    expect(await statusUAW()).toBe('menikah')
  })

  it('kolom lain di pernikahan tetap bisa diubah anggota biasa', async () => {
    expect(await q('memberAM', `update public.unions set notes = 'Catatan' where id = $1 returning id`, [uAW])).toHaveLength(1)
  })

  it('mencatat pernikahan baru yang langsung berstatus berpisah juga dijaga', async () => {
    const [p] = await q('anggotaA', `insert into public.people (full_name) values ('Calon Contoh') returning id`)
    await ditolak(q('memberAM', `insert into public.unions (partner1_id, partner2_id, status) values ($1, $2, 'cerai')`, [b, p.id]), 'SL010')
    expect(await q('anggotaA', `insert into public.unions (partner1_id, partner2_id, status) values ($1, $2, 'cerai') returning id`, [a, p.id])).toHaveLength(1)
  })

  it('pernikahan baru boleh dicatat walaupun pernikahan sebelumnya belum ditandai berakhir', async () => {
    expect((await h.satu(`select status from public.unions where id = $1`, [uBN])).status).toBe('menikah')
    const [p] = await q('anggotaA', `insert into public.people (full_name) values ('Pasangan Baru Contoh') returning id`)
    expect(await q('memberAM', `insert into public.unions (partner1_id, partner2_id) values ($1, $2) returning id`, [b, p.id])).toHaveLength(1)
  })
})

describe('"Belum menikah" hanya dipilih orangnya sendiri', () => {
  const pilihan = async (id) => (await h.satu(`select marital_choice from public.people where id = $1`, [id])).marital_choice

  it('orangnya sendiri boleh memilih dan menghapus pilihannya', async () => {
    expect(await q('memberAM', `update public.people set marital_choice = 'belum_menikah' where id = $1 returning id`, [cAM])).toHaveLength(1)
    expect(await pilihan(cAM)).toBe('belum_menikah')
    expect(await q('memberAM', `update public.people set marital_choice = null where id = $1 returning id`, [cAM])).toHaveLength(1)
    expect(await pilihan(cAM)).toBeNull()
  })

  it('orang lain ditolak, termasuk orang tuanya dan admin utama', async () => {
    await ditolak(q('anggotaA', `update public.people set marital_choice = 'belum_menikah' where id = $1`, [cAM]), 'SL011')
    await ditolak(q('pemilik', `update public.people set marital_choice = 'belum_menikah' where id = $1`, [cAM], 'aal2'), 'SL011')
    await ditolakHak(q('anggotaA', `insert into public.people (full_name, marital_choice) values ('x', 'belum_menikah')`))
    expect(await pilihan(cAM)).toBeNull()
  })

  it('hanya pilihan tetap: teks bebas ditolak', async () => {
    await expect(q('memberAM', `update public.people set marital_choice = 'jomblo' where id = $1`, [cAM])).rejects.toThrow(/check constraint/)
  })
})
