// Tes laporan kesalahan, data yang disisihkan, dan hapus permanen. Semua FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'

let db, h
let kakek, nenek, akar, a, m, uAM, b, n, uBN, c1, c2, t1, bapakM
const akun = {}

const q = (siapa, sql, params, aal) =>
  sebagai(db, 'authenticated', klaimUntuk(akun[siapa], aal ?? 'aal1'), (tx) => baris(tx, sql, params))
const satuNilai = async (siapa, sql, params, aal) => Object.values((await q(siapa, sql, params, aal))[0])[0]
const buang = (siapa, tabel, id, aal) => satuNilai(siapa, `select public.move_to_trash($1, $2)`, [tabel, id], aal)
const ditolak = async (janji, kode) => {
  const e = await janji.then(() => null, (err) => err)
  expect(e, `seharusnya ditolak dengan ${kode}`).not.toBeNull()
  expect(e.code).toBe(kode)
  return e
}
const disisihkan = async (tabel, id) => (await h.satu(`select deleted_at is not null as s from public.${tabel} where id = $1`, [id]))?.s

async function jadikanAnggota(nama, personId, { role = 'anggota', permissions = [], isOwner = false } = {}) {
  const u = await buatPengguna(db)
  const mem = await h.satu(`insert into public.members (person_id, display_name, role, permissions, is_owner, auth_user_id)
    values ($1, $2, $3, $4, $5, $6) returning id`, [personId, nama, role, permissions, isOwner, u.userId])
  await db.query(`insert into public.devices (member_id, session_id, via) values ($1, $2, 'undangan')`, [mem.id, u.sessionId])
  akun[nama] = { ...u, memberId: mem.id }
}

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql', '003_aturan_silsilah.sql', '004_akses.sql',
                   '005_akses_silsilah.sql', '006_riwayat_undo.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '007_disisihkan_laporan.sql')).toEqual([])
  h = pembantuSilsilah(db)
  kakek = await h.orang('Kakek'); nenek = await h.orang('Nenek')
  akar = await h.nikah(kakek, nenek); await h.aturPangkal(akar)
  a = await h.orang('A'); await h.anak(akar, a)
  b = await h.orang('B'); await h.anak(akar, b)
  m = await h.orang('M'); uAM = await h.nikah(a, m)
  n = await h.orang('N'); uBN = await h.nikah(b, n)
  c1 = await h.orang('C1', { birth_y: 1970 }); await h.anak(uAM, c1)
  c2 = await h.orang('C2', { birth_y: 1972 }); await h.anak(uAM, c2)
  t1 = await h.pohonAsal(m)
  bapakM = await h.orang('Bapak M', { tree_id: t1 })

  await jadikanAnggota('Pemilik', kakek, { isOwner: true })
  await jadikanAnggota('Asisten', nenek, { role: 'asisten', permissions: ['sisihkan', 'tindak_laporan'] })
  await jadikanAnggota('Anggota A', a)
  await jadikanAnggota('Anggota B', b)
  await jadikanAnggota('Lihat N', n, { role: 'lihat' })
}, 60000)

describe('007_disisihkan_laporan.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '007_disisihkan_laporan.sql')).toEqual([])
  })
})

describe('laporan kesalahan', () => {
  let laporan
  it('anggota melapor; asisten berizin dan admin utama diberi tahu', async () => {
    laporan = await satuNilai('Anggota A', `select public.report_problem('people', $1, 'data_ganda', 'Tercatat dua kali')`, [c2])
    const penerima = await baris(db, `select member_id from public.notifications where kind = 'laporan_baru'`)
    expect(penerima.map((r) => r.member_id).sort()).toEqual([akun.Pemilik.memberId, akun.Asisten.memberId].sort())
  })
  it('"hanya melihat" tidak bisa melapor; laporan tidak bisa ditulis langsung', async () => {
    await ditolak(q('Lihat N', `select public.report_problem('people', $1, 'data_salah')`, [c1]), 'RP001')
    await expect(q('Anggota A', `insert into public.reports (target_table, target_id, reason) values ('people', $1, 'lainnya')`, [c1]))
      .rejects.toThrow(/permission denied/)
  })
  it('pelapor melihat laporannya sendiri; anggota lain tidak; asisten berizin melihat semua', async () => {
    expect((await q('Anggota A', `select id from public.reports`)).map((r) => r.id)).toEqual([laporan])
    expect(await q('Anggota B', `select id from public.reports`)).toEqual([])
    expect((await q('Asisten', `select id from public.reports`)).length).toBe(1)
  })
  it('hanya yang berizin menindaklanjuti; pelapor diberi tahu hasilnya', async () => {
    await ditolak(q('Anggota B', `select public.handle_report($1, 'selesai')`, [laporan]), 'RP004')
    await q('Asisten', `select public.handle_report($1, 'selesai', 'Sudah dirapikan')`, [laporan])
    expect((await h.satu(`select status, handled_by from public.reports where id = $1`, [laporan])))
      .toEqual({ status: 'selesai', handled_by: akun.Asisten.memberId })
    expect(await q('Anggota A', `select title, body from public.notifications where kind = 'laporan_ditanggapi'`))
      .toEqual([{ title: 'Laporan Anda sudah ditindaklanjuti', body: 'Sudah dirapikan' }])
  })
  it('data pohon keluarga asal tidak bisa dilaporkan oleh yang tidak boleh melihatnya', async () => {
    await ditolak(q('Anggota B', `select public.report_problem('people', $1, 'data_salah')`, [bapakM]), 'RP002')
  })
  it('maksimal 10 laporan per jam per orang', async () => {
    for (let i = 0; i < 10; i++) await q('Anggota B', `select public.report_problem('people', $1, 'lainnya')`, [c1])
    await ditolak(q('Anggota B', `select public.report_problem('people', $1, 'lainnya')`, [c1]), 'RP003')
  })
})

describe('siapa boleh memdisisihkan', () => {
  it('anggota biasa dan admin utama tanpa aal2 tidak bisa', async () => {
    const dup = await h.orang('Ganda Satu')
    await ditolak(buang('Anggota A', 'people', dup), 'TR001')
    await ditolak(buang('Pemilik', 'people', dup, 'aal1'), 'TR001')
    await expect(q('Anggota A', `update public.people set deleted_at = now() where id = $1`, [dup])).rejects.toThrow(/permission denied/)
  })
  it('asisten berizin "sisihkan" dan admin utama (aal2) bisa', async () => {
    expect(await buang('Asisten', 'people', await h.orang('Ganda Dua'))).toBeTruthy()
    expect(await buang('Pemilik', 'people', await h.orang('Ganda Tiga'), 'aal2')).toBeTruthy()
  })
  it('data pohon keluarga asal hanya oleh admin utama', async () => {
    await ditolak(buang('Asisten', 'people', bapakM), 'TR012')
  })
})

describe('pengaman saat membuang', () => {
  it('ditolak: masih punya anak aktif, pasangan pangkal, punya pohon asal, anggota aktif', async () => {
    // C2 bukan anggota, dan punya anak.
    const uC2 = await h.nikah(c2, await h.orang('Pasangan C2'))
    await h.anak(uC2, await h.orang('Anak C2'))
    await ditolak(buang('Asisten', 'people', c2), 'TR002')
    await ditolak(buang('Asisten', 'unions', uC2), 'TR002')
    await ditolak(buang('Asisten', 'people', kakek), 'TR004')
    await ditolak(buang('Asisten', 'unions', akar), 'TR004')
    await ditolak(buang('Asisten', 'people', m), 'TR003')
  })
  it('ditolak: anggota aplikasi yang masih aktif', async () => {
    const x = await h.orang('Anggota Tanpa Anak'); await h.anak(uBN, x)
    await jadikanAnggota('Tanpa Anak', x)
    await ditolak(buang('Asisten', 'people', x), 'TR005')
  })
  it('ditolak: hubungan satu-satunya bagi orang yang sudah berkeluarga', async () => {
    const link = (await h.satu(`select id from public.children where child_id = $1`, [c1])).id
    await h.nikah(c1, await h.orang('Pasangan C1'))
    await ditolak(buang('Asisten', 'children', link), 'TR010')
  })
  it('data ganda: orang beserta hubungannya masuk satu kelompok; urutan lahir dirapikan', async () => {
    const ganda = await h.orang('C2 Ganda', { birth_y: 1971 }); await h.anak(uAM, ganda)
    expect((await h.urutan(a)).length).toBe(3)
    const kelompok = await buang('Asisten', 'people', ganda)
    expect(await disisihkan('people', ganda)).toBe(true)
    expect((await h.satu(`select delete_batch from public.children where child_id = $1`, [ganda])).delete_batch).toBe(kelompok)
    expect((await h.urutan(a)).map((r) => r.child_id)).toEqual([c1, c2])
    expect((await q('Anggota A', `select id from public.people where id = $1`, [ganda]))).toEqual([])
    expect((await q('Asisten', `select id from public.people where id = $1`, [ganda]))).toHaveLength(1)
  })
})

describe('memulihkan', () => {
  it('satu kelompok kembali utuh, termasuk urutan lahir; anggota biasa tidak bisa', async () => {
    const ganda = await h.orang('Pulih Contoh', { birth_y: 1971 }); await h.anak(uAM, ganda)
    const kelompok = await buang('Asisten', 'people', ganda)
    await ditolak(q('Anggota A', `select public.restore_batch($1)`, [kelompok]), 'TR001')
    await q('Asisten', `select public.restore_batch($1)`, [kelompok])
    expect(await disisihkan('people', ganda)).toBe(false)
    expect((await h.urutan(a)).map((r) => r.child_id)).toEqual([c1, ganda, c2])
    await buang('Asisten', 'people', ganda) // rapikan lagi untuk tes berikutnya
  })

  it('orang yang sudah berkeluarga (tanpa anak) bisa dibuang dan dipulihkan lewat Undo', async () => {
    const x = await h.orang('Berkeluarga Contoh'); await h.anak(uBN, x)
    await h.nikah(x, await h.orang('Pasangan X'))
    await buang('Asisten', 'people', x)
    const batch = (await h.satu(`select batch_id from public.change_log where table_name = 'people' and op = 'hapus' order by id desc limit 1`)).batch_id
    await q('Asisten', `select public.undo_batch($1)`, [batch])
    expect(await disisihkan('people', x)).toBe(false)
    expect((await h.satu(`select count(*)::int as n from public.unions where partner1_id = $1 and deleted_at is null`, [x])).n).toBe(1)
  })

  it('kelompok yang tidak ada ditolak', async () => {
    await ditolak(q('Asisten', `select public.restore_batch(gen_random_uuid())`), 'TR011')
  })
})

describe('hapus permanen', () => {
  let kelompok, ganda
  beforeAll(async () => {
    ganda = await h.orang('Hapus Permanen Contoh'); await h.anak(uBN, ganda)
    kelompok = await buang('Asisten', 'people', ganda)
    await db.exec(`create table public.uji_kait (jenis text, keterangan jsonb, masih_ada boolean);
      alter table public.uji_kait enable row level security;
      create or replace function private.before_big_action(jenis text, keterangan jsonb)
        returns void language sql security definer set search_path = '' as $$
        insert into public.uji_kait
        select jenis, keterangan, exists (select 1 from public.people where delete_batch = (keterangan ->> 'delete_batch')::uuid)
      $$;`)
  })

  it('hanya admin utama dengan verifikasi dua langkah', async () => {
    await ditolak(q('Asisten', `select public.purge_batch($1, 'HAPUS')`, [kelompok]), 'TR008')
    await ditolak(q('Pemilik', `select public.purge_batch($1, 'HAPUS')`, [kelompok], 'aal1'), 'TR008')
  })

  it('wajib mengetik HAPUS', async () => {
    await ditolak(q('Pemilik', `select public.purge_batch($1, 'hapus')`, [kelompok], 'aal2'), 'TR009')
    await ditolak(q('Pemilik', `select public.purge_batch($1, null)`, [kelompok], 'aal2'), 'TR009')
  })

  it('salinan otomatis dipanggil SEBELUM data dihapus; isi lama tetap di riwayat; tidak bisa di-Undo', async () => {
    expect(await satuNilai('Pemilik', `select public.purge_batch($1, 'HAPUS')`, [kelompok], 'aal2')).toBe(2)
    expect(await h.satu(`select id from public.people where id = $1`, [ganda])).toBeUndefined()
    expect(await baris(db, `select jenis, masih_ada from public.uji_kait`)).toEqual([{ jenis: 'sebelum_hapus_permanen', masih_ada: true }])
    const log = await h.satu(`select old_row ->> 'full_name' as nama, batch_id from public.change_log
                              where op = 'hapus_permanen' and table_name = 'people' order by id desc limit 1`)
    expect(log.nama).toBe('Hapus Permanen Contoh')
    await ditolak(q('Pemilik', `select public.undo_batch($1)`, [log.batch_id], 'aal2'), 'UN004')
  })

  it('ditolak kalau masih dipakai kelompok lain; mengosongkan semua menghapus dengan urutan yang benar', async () => {
    const q2 = await h.orang('Q Contoh'); const link = await h.anak(uBN, q2)
    const kelompokLink = await buang('Asisten', 'children', link)
    const kelompokOrang = await buang('Asisten', 'people', q2)
    await ditolak(q('Pemilik', `select public.purge_batch($1, 'HAPUS')`, [kelompokOrang], 'aal2'), 'TR007')
    expect(kelompokLink).not.toBe(kelompokOrang)
    const sisaSebelum = (await h.satu(`select count(*)::int as n from public.people where deleted_at is not null`)).n
    expect(sisaSebelum).toBeGreaterThan(0)
    await q('Pemilik', `select public.empty_trash('HAPUS')`, [], 'aal2')
    expect((await h.satu(`select count(*)::int as n from public.people where deleted_at is not null`)).n).toBe(0)
    expect((await h.satu(`select count(*)::int as n from public.children where deleted_at is not null`)).n).toBe(0)
  })

  it('menghapus permanen semua data yang disisihkan: kalau satu kelompok tidak bisa dihapus, tidak ada yang dihapus', async () => {
    const x = await h.orang('Mantan Anggota'); await h.anak(uBN, x)
    await jadikanAnggota('Mantan', x)
    await db.query(`update public.members set status = 'dicabut', revoked_at = now() where id = $1`, [akun.Mantan.memberId])
    await buang('Asisten', 'people', x)
    const lain = await h.orang('Ganda Lain'); await buang('Asisten', 'people', lain)
    await ditolak(q('Pemilik', `select public.empty_trash('HAPUS')`, [], 'aal2'), 'TR005')
    expect(await disisihkan('people', lain)).toBe(true)
  })
})

describe('pindahkan ke orang tua lain', () => {
  it('anggota bisa memindah hubungan anak; urutan lahir ikut pindah; bisa di-Undo', async () => {
    const salah = await h.orang('Salah Cabang', { birth_y: 1976 }); const link = await h.anak(uAM, salah)
    await q('Anggota B', `update public.children set union_id = $1 where id = $2`, [uBN, link])
    expect((await h.urutan(a)).map((r) => r.child_id)).not.toContain(salah)
    expect((await h.urutan(b)).map((r) => r.child_id)).toContain(salah)
    const batch = (await h.satu(`select batch_id from public.change_log where table_name = 'children' and op = 'ubah' order by id desc limit 1`)).batch_id
    await q('Anggota B', `select public.undo_batch($1)`, [batch])
    expect((await h.urutan(a)).map((r) => r.child_id)).toContain(salah)
  })
})
