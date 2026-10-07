// Tes "Bukan saya" dan "Keluar" (SQL 011). Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, panggilFungsi, pembantuAkses } from './pembantu-akses.js'

let db, h, a, ua
const tahunIni = new Date().getUTCFullYear()
let nomor = 0

const anggotaBaru = async (opsi = {}) => {
  const id = await h.orang(`Cucu ${++nomor} Contoh`, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return a.anggota(id, { nama: `Anggota ${nomor} Contoh`, ...opsi })
}
// Perangkat tambahan untuk anggota yang sama (sesi baru).
const perangkatLain = async (akun) => {
  const sesi = await a.sesiBaru(akun.userId)
  const [d] = await baris(db, `insert into public.devices (member_id, session_id, via) values ($1, $2, 'kode') returning id`, [akun.memberId, sesi.sessionId])
  return { ...sesi, memberId: akun.memberId, deviceId: d.id }
}

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
  await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
}, 60000)

describe('011_layar_masuk.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '011_layar_masuk.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '011_layar_masuk.sql')).toEqual([])
  })
})

describe('"Bukan saya"', () => {
  it('perangkat itu langsung ditutup aksesnya dan admin utama diberi tahu (penting)', async () => {
    const x = await anggotaBaru({ nama: 'Pak Salah Alamat Contoh' })
    await db.query(`update public.devices set label = 'iPhone · Safari', device_type = 'iPhone',
      approx_city = 'Kota Contoh', approx_country = 'ID', approx_country_name = 'Indonesia' where id = $1`, [x.deviceId])
    expect(await a.siapa(x)).toBe(x.memberId)
    const p = await a.penandaNotifikasi()
    expect(await a.rpc(x, 'report_not_me', {})).toEqual({ status: 'ok' })
    expect(await a.siapa(x)).toBeNull()
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([{
      kind: 'bukan_saya',
      title: '"Bukan saya": link untuk Pak Salah Alamat Contoh',
      body: expect.stringContaining('iPhone · Safari (sekitar Kota Contoh, Indonesia, '),
      priority: 'penting',
    }])
    expect(n[0].body).toContain('Buat link baru untuk Pak Salah Alamat Contoh')
    const ev = await h.satu(`select event from private.auth_events where device_id = $1 and event = 'bukan_saya'`, [x.deviceId])
    expect(ev).toEqual({ event: 'bukan_saya' })
  })

  it('perangkat lain milik anggota yang sama tidak ikut ditutup', async () => {
    const x = await anggotaBaru()
    const y = await perangkatLain(x)
    await a.rpc(x, 'report_not_me', {})
    expect(await a.siapa(y)).toBe(x.memberId)
  })

  it('tidak bisa dipakai tamu, atau dari perangkat yang tidak sah', async () => {
    const x = await anggotaBaru()
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'report_not_me'))).rejects.toThrow(/permission denied/)
    await db.query(`update public.devices set revoked_at = now() where id = $1`, [x.deviceId])
    await ditolak(a.rpc(x, 'report_not_me', {}), 'AK025')
  })
})

describe('keluar', () => {
  it('dari perangkat ini: hanya perangkat ini dicabut, tercatat di log', async () => {
    const x = await anggotaBaru()
    const y = await perangkatLain(x)
    expect(await a.rpc(x, 'sign_out_devices', {})).toBe(1)
    expect(await a.siapa(x)).toBeNull()
    expect(await a.siapa(y)).toBe(x.memberId)
    const ev = await h.satu(`select event, detail from private.auth_events where device_id = $1 and event = 'keluar'`, [x.deviceId])
    expect(ev.detail).toEqual({ semua: false, jumlah: 1 })
  })

  it('dari semua perangkat: semua perangkat anggota itu dicabut, perangkat anggota lain tidak', async () => {
    const x = await anggotaBaru()
    const y = await perangkatLain(x)
    const lain = await anggotaBaru()
    expect(await a.rpc(y, 'sign_out_devices', { p_all: true })).toBe(2)
    expect(await a.siapa(x)).toBeNull()
    expect(await a.siapa(y)).toBeNull()
    expect(await a.siapa(lain)).toBe(lain.memberId)
  })

  it('perangkat yang sudah tidak sah: tidak berbuat apa-apa dan tidak error (aplikasi tetap bisa keluar)', async () => {
    const x = await anggotaBaru()
    await db.query(`update public.devices set revoked_at = now() where id = $1`, [x.deviceId])
    expect(await a.rpc(x, 'sign_out_devices', {})).toBe(0)
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'sign_out_devices'))).rejects.toThrow(/permission denied/)
  })
})
