// Tes daftar dan pengakhiran akses sementara (SQL 012). Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, panggilFungsi, panggilTabel, pembantuAkses } from './pembantu-akses.js'
import { sha256Hex } from '../functions/_shared/rahasia.js'

let db, h, a, ua, owner, asisten, biasa, asistenLain
const tahunIni = new Date().getUTCFullYear()
let nomor = 0

const orangBaru = async () => {
  const id = await h.orang(`Cucu ${++nomor} Contoh`, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return id
}
// Akses sementara yang sedang berjalan untuk anggota (lewat alur sungguhan).
async function berikanAkses(untuk, menit = 60, oleh = asisten) {
  const k = await a.rpc(oleh, 'create_temp_access_code', { p_member: untuk.memberId, p_minutes: menit })
  const hash = await sha256Hex(k.code.replace('-', ''))
  await a.rpcServer('edge_check_redemption', { p_kind: 'kode', p_hash: hash })
  const s = await a.rpcServer('edge_complete_redemption', { p_kind: 'kode', p_hash: hash, p_info: { device_type: 'Laptop Windows', label: 'Laptop Windows · Chrome' } })
  const sesi = await a.sesiBaru(untuk.userId)
  const d = await a.rpc(sesi, 'claim_device', { p_ticket: s.ticket })
  return { ...sesi, memberId: untuk.memberId, deviceId: d.device_id, kodeId: k.code_id }
}
const daftar = (akun, aal = 'aal1') => a.rpcTabel(akun, 'list_temp_access', {}, aal)

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
  ua = await h.nikah(anak, await h.orang('Menantu Contoh', { sex: 'P' }))
  owner = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  asisten = await a.anggota(nenek, { role: 'asisten', permissions: ['akses_sementara'], nama: 'Asisten Contoh' })
  asistenLain = await a.anggota(await orangBaru(), { role: 'asisten', permissions: ['bendahara'], nama: 'Asisten Lain Contoh' })
  biasa = await a.anggota(anak, { nama: 'Anggota Biasa Contoh' })
}, 60000)

describe('012_akses_sementara.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '012_akses_sementara.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '012_akses_sementara.sql')).toEqual([])
  })
})

describe('daftar akses sementara', () => {
  it('hanya admin utama (dua langkah) dan asisten berizin; tamu tidak bisa', async () => {
    await ditolak(daftar(biasa), 'AK016')
    await ditolak(daftar(asistenLain), 'AK016')
    await ditolak(daftar(owner, 'aal1'), 'AK016')
    expect(await daftar(asisten)).toBeTruthy()
    expect(await daftar(owner, 'aal2')).toBeTruthy()
    await expect(sebagai(db, 'anon', {}, (tx) => panggilTabel(tx, 'list_temp_access'))).rejects.toThrow(/permission denied/)
  })

  it('akses yang berjalan muncul "aktif" dengan batas waktu; kode yang belum dipakai "menunggu"; yang berakhir hilang', async () => {
    const x = await anggotaDenganAkses()
    const menunggu = await a.rpc(asisten, 'create_temp_access_code', { p_member: biasa.memberId, p_minutes: 45 })
    const r = await daftar(asisten)
    const aktif = r.find((b) => b.id === x.deviceId)
    expect(aktif).toMatchObject({ kind: 'aktif', display_name: x.nama, label: 'Laptop Windows · Chrome' })
    expect(Date.parse(aktif.expires_at) - Date.now()).toBeGreaterThan(50 * 60000)
    expect(r.find((b) => b.id === menunggu.code_id)).toMatchObject({ kind: 'menunggu', display_name: 'Anggota Biasa Contoh', access_minutes: 45 })
    // Tidak ada isi kode/hash di daftar.
    expect(JSON.stringify(r)).not.toContain(menunggu.code.replace('-', ''))
    await db.query(`update public.devices set expires_at = now() - interval '1 second' where id = $1`, [x.deviceId])
    expect((await daftar(asisten)).find((b) => b.id === x.deviceId)).toBeUndefined()
  })

  it('perangkat biasa (bukan sementara) tidak ikut terdaftar', async () => {
    const r = await daftar(asisten)
    expect(r.find((b) => b.id === biasa.deviceId)).toBeUndefined()
  })
})

let urut = 0
async function anggotaDenganAkses(menit = 60) {
  const nama = `Peminjam ${++urut} Contoh`
  const akun = await a.anggota(await orangBaru(), { nama })
  return { ...(await berikanAkses(akun, menit)), nama }
}

describe('mengakhiri akses sementara', () => {
  it('perangkat itu langsung tidak bisa membaca; perangkat lain anggota itu tidak terpengaruh', async () => {
    const nama = `Peminjam Dua Contoh`
    const akun = await a.anggota(await orangBaru(), { nama })
    const sementara = await berikanAkses(akun)
    expect(await a.siapa(sementara)).toBe(akun.memberId)
    await a.rpc(asisten, 'revoke_temp_access', { p_device: sementara.deviceId })
    expect(await a.siapa(sementara)).toBeNull()
    expect(await a.siapa(akun)).toBe(akun.memberId)
    const ev = await h.satu(`select detail from private.auth_events where device_id = $1 and event = 'perangkat_dicabut'`, [sementara.deviceId])
    expect(ev.detail).toEqual({ oleh: asisten.memberId, akses_sementara: true })
  })

  it('admin utama diberi tahu kalau pelakunya asisten; tidak kalau admin sendiri', async () => {
    const x = await anggotaDenganAkses()
    const p = await a.penandaNotifikasi()
    await a.rpc(asisten, 'revoke_temp_access', { p_device: x.deviceId })
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([expect.objectContaining({ kind: 'akses_sementara', title: `Akses sementara ${x.nama} diakhiri`, priority: 'biasa' })])
    const y = await anggotaDenganAkses()
    const q = await a.penandaNotifikasi()
    await a.rpc(owner, 'revoke_temp_access', { p_device: y.deviceId }, 'aal2')
    expect(await a.notifikasiAdminSejak(q)).toEqual([])
  })

  it('tanpa izin ditolak; perangkat biasa tidak bisa "diakhiri" lewat sini; sudah berakhir ditolak', async () => {
    const x = await anggotaDenganAkses()
    await ditolak(a.rpc(biasa, 'revoke_temp_access', { p_device: x.deviceId }), 'AK016')
    await ditolak(a.rpc(asistenLain, 'revoke_temp_access', { p_device: x.deviceId }), 'AK016')
    await ditolak(a.rpc(asisten, 'revoke_temp_access', { p_device: biasa.deviceId }), 'AK026')
    expect(await a.siapa(biasa)).toBe(biasa.memberId)
    await a.rpc(asisten, 'revoke_temp_access', { p_device: x.deviceId })
    await ditolak(a.rpc(asisten, 'revoke_temp_access', { p_device: x.deviceId }), 'AK026')
    await ditolak(a.rpc(asisten, 'revoke_temp_access', { p_device: '00000000-0000-0000-0000-000000000000' }), 'AK026')
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'revoke_temp_access', { p_device: x.deviceId }))).rejects.toThrow(/permission denied/)
  })

  it('akses sementara berakhir sendiri setelah waktunya dan RLS menolak', async () => {
    const x = await anggotaDenganAkses(30)
    expect(await a.siapa(x)).toBe(x.memberId)
    await db.query(`update public.devices set expires_at = now() - interval '1 second' where id = $1`, [x.deviceId])
    expect(await a.siapa(x)).toBeNull()
    const [r] = await a.lewatApi(x, (tx) => baris(tx, 'select count(*)::int as n from public.people'))
    expect(r.n).toBe(0)
  })
})
