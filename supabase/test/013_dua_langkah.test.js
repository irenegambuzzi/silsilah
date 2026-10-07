// Tes verifikasi dua langkah admin utama (SQL 004 is_owner + SQL 013).
// Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, pembantuAkses } from './pembantu-akses.js'
import { sha256Hex } from '../functions/_shared/rahasia.js'

let db, h, a, owner, ownerLaptop, asisten, biasa, cucu

const faktor = async (akun, nama, status = 'verified') =>
  (await baris(db, `insert into auth.mfa_factors (user_id, friendly_name, status) values ($1, $2, $3) returning id`,
    [akun.userId, nama, status]))[0].id
const peristiwa = (jenis) =>
  baris(db, `select member_id, device_id, detail from private.auth_events
             where event = 'verifikasi_dua_langkah' and detail ->> 'jenis' = $1 order by id`, [jenis])
const kenal = async () => (await baris(db, `select factor_id from private.owner_factors_seen order by seen_at`)).map((r) => r.factor_id)
const cek = async () => (await baris(db, `select private.check_owner_factors() as n`))[0].n
const darurat = (konfirmasi) => baris(db, `select * from private.emergency_reset_owner_2fa($1)`, [konfirmasi])

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
  const ua = await h.nikah(anak, await h.orang('Menantu Contoh', { sex: 'P' }))
  cucu = await h.orang('Cucu Contoh', { birth_y: 1990 })
  await h.anak(ua, cucu)
  owner = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  // Perangkat kedua admin utama (sesi lain, akun yang sama).
  ownerLaptop = await a.sesiBaru(owner.userId)
  await baris(db, `insert into public.devices (member_id, session_id, via) values ($1, $2, 'kode')`, [owner.memberId, ownerLaptop.sessionId])
  asisten = await a.anggota(nenek, { role: 'asisten', permissions: ['akses_sementara', 'buat_undangan', 'lihat_anggota'], nama: 'Asisten Contoh' })
  biasa = await a.anggota(anak, { nama: 'Anggota Biasa Contoh' })
}, 60000)

describe('013_dua_langkah.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '013_dua_langkah.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '013_dua_langkah.sql')).toEqual([])
  })
})

// Inti langkah 1.19: admin utama tanpa aal2 tidak bisa membuka fungsi admin.
describe('admin utama tanpa verifikasi dua langkah = anggota biasa', () => {
  const ADMIN = [
    ['daftar akses sementara', (aal) => a.rpcTabel(owner, 'list_temp_access', {}, aal), 'AK016'],
    ['membuat kode akses sementara', (aal) => a.rpc(owner, 'create_temp_access_code', { p_member: biasa.memberId, p_minutes: 60 }, aal), 'AK016'],
    ['membuat link undangan', (aal) => a.rpc(owner, 'create_invite', { p_person: cucu, p_adult_confirmed: true }, aal), 'AK015'],
    ['melepas penahanan', (aal) => a.rpc(owner, 'release_hold', { p_member: biasa.memberId }, aal), 'AK002'],
  ]

  it.each(ADMIN)('%s: aal1 ditolak, aal2 boleh', async (_n, panggil, kode) => {
    await ditolak(panggil('aal1'), kode)
    await expect(panggil('aal2')).resolves.not.toThrow()
  })

  it('mencabut perangkat anggota lain: aal1 ditolak, aal2 boleh', async () => {
    const korban = await a.sesiBaru(biasa.userId)
    const [d] = await baris(db, `insert into public.devices (member_id, session_id, via) values ($1, $2, 'kode') returning id`,
      [biasa.memberId, korban.sessionId])
    await ditolak(a.rpc(owner, 'revoke_device', { p_device: d.id }, 'aal1'), 'AK024')
    await a.rpc(owner, 'revoke_device', { p_device: d.id }, 'aal2')
    expect((await h.satu(`select revoked_at from public.devices where id = $1`, [d.id])).revoked_at).toBeTruthy()
  })

  it('daftar perangkat semua anggota: aal1 hanya miliknya sendiri, aal2 semua', async () => {
    const lihat = (aal) => a.lewatApi(owner, (tx) => baris(tx, `select distinct member_id from public.devices`), aal)
    expect((await lihat('aal1')).map((r) => r.member_id)).toEqual([owner.memberId])
    expect((await lihat('aal2')).length).toBeGreaterThan(1)
  })

  it('is_owner(): hanya admin utama DENGAN aal2, dari perangkat yang sah', async () => {
    const isOwner = async (akun, aal) => (await a.lewatApi(akun, (tx) => baris(tx, 'select public.is_owner() as b'), aal))[0].b
    expect(await isOwner(owner, 'aal1')).toBe(false)
    expect(await isOwner(owner, 'aal2')).toBe(true)
    // aal2 tidak membuat anggota lain jadi admin.
    expect(await isOwner(asisten, 'aal2')).toBe(false)
    expect(await isOwner(biasa, 'aal2')).toBe(false)
    // Sesi admin utama yang belum terdaftar sebagai perangkat: bukan admin walau aal2.
    expect(await isOwner(await a.sesiBaru(owner.userId), 'aal2')).toBe(false)
  })

  it('asisten tidak butuh aal2 untuk izinnya (verifikasi dua langkah hanya untuk admin utama)', async () => {
    await expect(a.rpcTabel(asisten, 'list_temp_access', {}, 'aal1')).resolves.toBeTruthy()
  })
})

describe('record_second_factor()', () => {
  it('hanya admin utama; tamu dan pengguna lain ditolak', async () => {
    await ditolak(a.rpc(biasa, 'record_second_factor', {}, 'aal2'), 'AK002')
    await ditolak(a.rpc(asisten, 'record_second_factor', {}, 'aal2'), 'AK002')
    await ditolak(a.rpc(await a.sesiBaru(owner.userId), 'record_second_factor', {}, 'aal2'), 'AK002')
    await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, 'select public.record_second_factor()'))).rejects.toThrow(/permission denied/)
  })

  it('aal1: tidak dicatat "terverifikasi"; aal2: dicatat sekali per perangkat', async () => {
    const sebelum = (await peristiwa('terverifikasi')).length
    expect((await a.rpc(owner, 'record_second_factor', {}, 'aal1')).aal).toBe('aal1')
    expect(await peristiwa('terverifikasi')).toHaveLength(sebelum)
    await a.rpc(owner, 'record_second_factor', {}, 'aal2')
    await a.rpc(owner, 'record_second_factor', {}, 'aal2')
    const r = await peristiwa('terverifikasi')
    expect(r).toHaveLength(sebelum + 1)
    expect(r.at(-1)).toMatchObject({ member_id: owner.memberId, device_id: owner.deviceId })
    await a.rpc(ownerLaptop, 'record_second_factor', {}, 'aal2')
    expect(await peristiwa('terverifikasi')).toHaveLength(sebelum + 2)
  })
})

describe('pemantauan authenticator admin utama', () => {
  it('authenticator baru → dicatat dan admin diberi tahu (penting), sekali saja; yang belum selesai didaftarkan diabaikan', async () => {
    const penanda = await a.penandaNotifikasi()
    const utama = await faktor(owner, 'Utama')
    await faktor(owner, 'Setengah jadi', 'unverified')
    await faktor(biasa, 'Milik orang lain')
    expect(await cek()).toBe(1)
    expect(await cek()).toBe(0)
    expect(await kenal()).toEqual([utama])
    const n = await a.notifikasiAdminSejak(penanda)
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ kind: 'dua_langkah', priority: 'penting', title: 'Authenticator baru untuk akun admin utama' })
    expect(n[0].body).toContain('"Utama"')
    expect(n[0].body).toContain('prosedur darurat')
    expect((await peristiwa('authenticator_baru')).at(-1).detail.faktor).toBe(utama)
  })

  it('juga lewat record_second_factor() dari aplikasi', async () => {
    const cadangan = await faktor(owner, 'Cadangan')
    expect((await a.rpc(owner, 'record_second_factor', {}, 'aal2')).perubahan).toBe(1)
    expect(await kenal()).toContain(cadangan)
  })

  it('authenticator dihapus → dicatat dan admin diberi tahu', async () => {
    const penanda = await a.penandaNotifikasi()
    await baris(db, `delete from auth.mfa_factors where friendly_name = 'Cadangan'`)
    expect(await cek()).toBe(1)
    const n = await a.notifikasiAdminSejak(penanda)
    expect(n.map((x) => x.title)).toEqual(['Authenticator dihapus dari akun admin utama'])
    expect(await kenal()).toHaveLength(1)
  })

  it('nama authenticator yang sangat panjang dipotong (50 huruf)', async () => {
    const penanda = await a.penandaNotifikasi()
    await faktor(owner, 'x'.repeat(300))
    await cek()
    const [n] = await a.notifikasiAdminSejak(penanda)
    expect(n.body).toContain(`"${'x'.repeat(50)}"`)
    expect(n.body).not.toContain('x'.repeat(51))
  })

  it('pengguna yang login tidak bisa menyentuh tabel dan fungsi pemantauan', async () => {
    await expect(a.lewatApi(owner, (tx) => baris(tx, 'select * from private.owner_factors_seen'), 'aal2')).rejects.toThrow(/permission denied/)
    await expect(a.lewatApi(owner, (tx) => baris(tx, 'select private.check_owner_factors()'), 'aal2')).rejects.toThrow(/permission denied/)
  })
})

describe('prosedur darurat: authenticator admin utama hilang', () => {
  it('tidak bisa lewat aplikasi/API, termasuk oleh admin utama dengan aal2', async () => {
    await expect(a.lewatApi(owner, (tx) => baris(tx, `select * from private.emergency_reset_owner_2fa('PULIHKAN')`), 'aal2'))
      .rejects.toThrow(/permission denied/)
    await expect(sebagai(db, 'service_role', {}, (tx) => baris(tx, `select * from private.emergency_reset_owner_2fa('PULIHKAN')`)))
      .rejects.toThrow(/permission denied/)
  })

  it('ditolak kalau ada klaim login (bukan SQL Editor), walaupun dijalankan pemilik database', async () => {
    const e = await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: owner.userId, aal: 'aal2' })])
      return tx.query(`select * from private.emergency_reset_owner_2fa('PULIHKAN')`).then(() => null, (err) => err)
    })
    expect(e?.code).toBe('AK028')
  })

  it('tanpa kata PULIHKAN yang tepat: ditolak, tidak ada yang berubah', async () => {
    const sebelum = await baris(db, `select count(*)::int as n from auth.mfa_factors`)
    await ditolak(darurat('KETIK-DI-SINI'), 'AK027')
    await ditolak(darurat('pulihkan'), 'AK027')
    await ditolak(darurat(null), 'AK027')
    expect(await baris(db, `select count(*)::int as n from auth.mfa_factors`)).toEqual(sebelum)
  })

  it('PULIHKAN: authenticator, perangkat, dan sesi admin utama habis; satu link baru yang bisa dipakai; anggota lain tidak tersentuh', async () => {
    const lain = await faktor(biasa, 'Milik anggota lain')
    const penanda = await a.penandaNotifikasi()
    const undanganLama = await a.rpc(owner, 'create_invite', { p_person: (await h.satu('select person_id from public.members where id = $1', [owner.memberId])).person_id }, 'aal2')
      .catch(() => null)

    const hasil = await darurat('PULIHKAN')
    expect(hasil.map((r) => r.langkah)).toHaveLength(4)
    expect(Number(hasil[0].hasil)).toBeGreaterThan(0)
    expect(hasil[1].hasil).toBe('2')
    expect(Number(hasil[2].hasil)).toBeGreaterThanOrEqual(2)
    const link = hasil[3].hasil
    expect(link).toMatch(/^#\/u\/[A-Za-z0-9_-]{43}$/)

    expect(await baris(db, `select id from auth.mfa_factors where user_id = $1`, [owner.userId])).toEqual([])
    expect(await baris(db, `select id from auth.mfa_factors where id = $1`, [lain])).toHaveLength(1)
    expect(await kenal()).toEqual([])
    expect(await baris(db, `select id from public.devices where member_id = $1 and revoked_at is null`, [owner.memberId])).toEqual([])
    expect(await baris(db, `select id from auth.sessions where user_id = $1`, [owner.userId])).toEqual([])
    expect(await baris(db, `select id from public.devices where member_id = $1 and revoked_at is null`, [biasa.memberId])).not.toEqual([])

    // HP yang hilang (sesi lama, aal2) tidak bisa apa-apa lagi.
    expect(await a.siapa(owner)).toBeNull()

    // Link baru bisa dipakai untuk akun admin utama yang sama.
    const r = await a.rpcServer('edge_check_redemption', { p_kind: 'undangan', p_hash: await sha256Hex(link.slice(4)) })
    expect(r).toMatchObject({ status: 'ok', member_id: owner.memberId, user_id: owner.userId })
    // Link lain untuk admin utama yang belum dipakai dibatalkan.
    if (undanganLama) {
      const lama = await a.rpcServer('edge_check_redemption', { p_kind: 'undangan', p_hash: await sha256Hex(undanganLama.token) })
      expect(lama.status).not.toBe('ok')
    }

    expect((await peristiwa('pemulihan_darurat')).at(-1).detail).toMatchObject({ authenticator: Number(hasil[0].hasil), perangkat: 2 })
    const n = await a.notifikasiAdminSejak(penanda)
    expect(n.map((x) => x.title)).toContain('Pemulihan darurat verifikasi dua langkah')
    // Link tidak pernah ikut tercatat di log atau pemberitahuan.
    const semua = JSON.stringify([await baris(db, 'select detail from private.auth_events'), n])
    expect(semua).not.toContain(link.slice(4))
  })

  it('dijalankan lagi → link pertama otomatis dibatalkan', async () => {
    const [pertama] = (await darurat('PULIHKAN')).slice(3)
    const [kedua] = (await darurat('PULIHKAN')).slice(3)
    expect(kedua.hasil).not.toBe(pertama.hasil)
    const r1 = await a.rpcServer('edge_check_redemption', { p_kind: 'undangan', p_hash: await sha256Hex(pertama.hasil.slice(4)) })
    const r2 = await a.rpcServer('edge_check_redemption', { p_kind: 'undangan', p_hash: await sha256Hex(kedua.hasil.slice(4)) })
    expect(r1.status).not.toBe('ok')
    expect(r2.status).toBe('ok')
  })

  it('file darurat memanggil fungsi ini dan TIDAK berjalan tanpa diedit dulu', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const isi = fs.readFileSync(path.join(import.meta.dirname, '..', 'darurat', 'pulihkan_dua_langkah_admin.sql'), 'utf8')
    expect(isi).toContain(`select * from private.emergency_reset_owner_2fa('KETIK-DI-SINI');`)
    await expect(db.exec(isi)).rejects.toMatchObject({ code: 'AK027' })
  })
})
