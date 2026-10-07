// Tes notifikasi login, login mencurigakan, cek perangkat, cabut perangkat,
// dan penghapusan IP mentah (SQL 010). Semua orang dan kota FIKTIF.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, buatPengguna, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, panggilFungsi, pembantuAkses } from './pembantu-akses.js'
import { sha256Hex } from '../functions/_shared/rahasia.js'
import { namaNegara } from '../functions/_shared/sumber-lokasi.js'

let db, h, a, ua, owner, asisten
const tahunIni = new Date().getUTCFullYear()
let nomor = 0
const IPHONE = { device_type: 'iPhone', label: 'iPhone · Safari' }

async function orangBaru(nama = `Cucu ${++nomor} Contoh`) {
  const id = await h.orang(nama, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return id
}

// Alur login lengkap lewat fungsi database (seperti Edge Function + aplikasi):
// undangan → periksa → tautkan akun → pakai (dengan perkiraan lokasi) → klaim.
async function masukLewatUndangan(person, info = {}, ip = '192.0.2.10') {
  const u = await a.rpc(owner, 'create_invite', { p_person: person, p_adult_confirmed: true }, 'aal2')
  const hash = await sha256Hex(u.token)
  const c = await a.rpcServer('edge_check_redemption', { p_kind: 'undangan', p_hash: hash, p_ip: ip })
  const userId = c.user_id ?? (await buatPengguna(db)).userId
  if (!c.user_id) await a.rpcServer('edge_attach_auth_user', { p_member: u.member_id, p_user: userId })
  // Seperti Edge Function: nama negara bahasa Indonesia ikut dikirim.
  const lengkap = { ...IPHONE, ...info, ...(info.approx_country ? { approx_country_name: namaNegara(info.approx_country) } : {}) }
  const s = await a.rpcServer('edge_complete_redemption', { p_kind: 'undangan', p_hash: hash, p_ip: ip, p_info: lengkap })
  expect(s.status).toBe('ok')
  const sesi = await a.sesiBaru(userId)
  const d = await a.rpc(sesi, 'claim_device', { p_ticket: s.ticket, p_timezone: 'Asia/Jakarta' })
  return { ...sesi, memberId: u.member_id, deviceId: d.device_id }
}

const jamOwner = async () => (await baris(db, `select private.owner_clock() as j`))[0].j

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
}, 60000)

beforeEach(async () => {
  await db.query(`update public.settings set login_digest_hourly = false, usual_countries = '{ID,IT}'`)
  await db.query(`delete from private.login_digest`)
})

describe('010_lokasi_login.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '010_lokasi_login.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '010_lokasi_login.sql')).toEqual([])
  })
})

describe('label lokasi dan jam', () => {
  it('selalu "sekitar …", nama negara bahasa Indonesia, tanpa koordinat', async () => {
    const r = await baris(db, `select private.location_label('Kota Contoh', 'ID', 'Indonesia') as a, private.location_label(null, 'NG', 'Nigeria') as b,
      private.location_label('  ', 'SA', 'Arab Saudi') as c, private.location_label(null, null, null) as d, private.location_label('X', 'QQ') as e`)
    expect(r[0]).toEqual({ a: 'sekitar Kota Contoh, Indonesia', b: 'sekitar Nigeria', c: 'sekitar Arab Saudi', d: 'lokasi tidak diketahui', e: 'sekitar X, QQ' })
  })
  it('jam mengikuti zona waktu perangkat admin utama (bawaan WIB)', async () => {
    const [r] = await baris(db, `select private.owner_clock('2026-01-15 07:05:00+00') as wib`)
    expect(r.wib).toBe('14.05')
    await db.query(`update public.devices set timezone = 'Europe/Rome' where id = $1`, [owner.deviceId])
    const [s] = await baris(db, `select private.owner_clock('2026-01-15 07:05:00+00') as roma`)
    expect(s.roma).toBe('08.05')
    await db.query(`update public.devices set timezone = 'Zona/Ngawur' where id = $1`, [owner.deviceId])
    const [t] = await baris(db, `select private.owner_clock('2026-01-15 07:05:00+00') as cadangan`)
    expect(t.cadangan).toBe('14.05')
    await db.query(`update public.devices set timezone = null where id = $1`, [owner.deviceId])
  })
})

describe('notifikasi login baru untuk admin utama', () => {
  it('satu per satu (bawaan): nama · perangkat · sekitar kota · jam · lewat apa', async () => {
    const p = await a.penandaNotifikasi()
    const x = await masukLewatUndangan(await orangBaru('Bu Wulan Contoh'), { approx_city: 'Kota Contoh', approx_country: 'ID' })
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([{
      kind: 'login_baru',
      title: 'Bu Wulan Contoh baru masuk',
      body: `iPhone · sekitar Kota Contoh, Indonesia · ${await jamOwner()}, lewat link undangan.`,
      priority: 'biasa',
    }])
    const d = await h.satu(`select approx_city, approx_country, approx_country_name from public.devices where id = $1`, [x.deviceId])
    expect(d).toEqual({ approx_city: 'Kota Contoh', approx_country: 'ID', approx_country_name: 'Indonesia' })
  })

  it('akses sementara disebut beserta durasinya; lokasi kosong → "lokasi tidak diketahui"', async () => {
    const x = await masukLewatUndangan(await orangBaru())
    const k = await a.rpc(asisten, 'create_temp_access_code', { p_member: x.memberId, p_minutes: 90 })
    const hash = await sha256Hex(k.code.replace('-', ''))
    await a.rpcServer('edge_check_redemption', { p_kind: 'kode', p_hash: hash })
    const s = await a.rpcServer('edge_complete_redemption', { p_kind: 'kode', p_hash: hash, p_info: { device_type: 'Laptop Windows' } })
    const p = await a.penandaNotifikasi()
    await a.rpc(await a.sesiBaru(x.userId), 'claim_device', { p_ticket: s.ticket })
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n.body).toBe(`Laptop Windows · lokasi tidak diketahui · ${await jamOwner()}, akses sementara 90 menit.`)
  })

  it('ringkasan per jam: login biasa dikumpulkan, lalu dikirim sebagai SATU pesan', async () => {
    await db.query(`update public.settings set login_digest_hourly = true`)
    const p = await a.penandaNotifikasi()
    await masukLewatUndangan(await orangBaru('Pak Satu Contoh'), { approx_city: 'Kota Contoh', approx_country: 'ID' })
    await masukLewatUndangan(await orangBaru('Bu Dua Contoh'), { approx_country: 'IT', approx_city: 'Kota Lain Contoh' })
    expect(await a.notifikasiAdminSejak(p)).toEqual([])
    const [r] = await baris(db, `select private.send_login_digest() as n`)
    expect(r.n).toBe(2)
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ kind: 'ringkasan_login', title: 'Ringkasan login: 2 kali dalam 1 jam terakhir', priority: 'biasa' })
    expect(n[0].body.split('\n')).toEqual([
      expect.stringMatching(/^Pak Satu Contoh · iPhone · sekitar Kota Contoh, Indonesia · \d\d\.\d\d$/),
      expect.stringMatching(/^Bu Dua Contoh · iPhone · sekitar Kota Lain Contoh, Italia · \d\d\.\d\d$/),
    ])
    // Tanpa login baru: tidak ada pesan kosong.
    expect((await baris(db, `select private.send_login_digest() as n`))[0].n).toBe(0)
    expect(await a.notifikasiAdminSejak(p)).toHaveLength(1)
  })

  it('ringkasan yang sangat panjang dipotong dengan rapi', async () => {
    await db.query(`insert into private.login_digest (line) select 'Anggota ' || g || ' Contoh · iPhone · sekitar Kota Contoh, Indonesia · 10.00'
                    from generate_series(1, 60) g`)
    const p = await a.penandaNotifikasi()
    await baris(db, `select private.send_login_digest()`)
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n.title).toBe('Ringkasan login: 60 kali dalam 1 jam terakhir')
    expect(n.body.length).toBeLessThanOrEqual(2000)
    expect(n.body).toMatch(/… dan \d+ login lainnya\.$/)
  })

  it('perangkat yang didaftarkan lewat SQL Editor tidak memicu notifikasi', async () => {
    const p = await a.penandaNotifikasi()
    await a.anggota(await orangBaru())
    expect(await a.notifikasiAdminSejak(p)).toEqual([])
  })
})

describe('login mencurigakan', () => {
  it('negara di luar daftar biasa → LANGSUNG (walaupun mode ringkasan), penting, dengan "Cabut perangkat ini"', async () => {
    await db.query(`update public.settings set login_digest_hourly = true`)
    const p = await a.penandaNotifikasi()
    const x = await masukLewatUndangan(await orangBaru('Pak Jauh Contoh'), { approx_country: 'NG', device_type: 'Laptop Windows' })
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([{
      kind: 'login_mencurigakan',
      title: 'Login mencurigakan: Pak Jauh Contoh',
      body: `Pak Jauh Contoh baru masuk dari negara yang tidak biasa · Laptop Windows · sekitar Nigeria · ${await jamOwner()}, lewat link undangan. Kalau ini bukan Pak Jauh Contoh, tekan "Cabut perangkat ini".`,
      priority: 'penting',
    }])
    const [l] = await baris(db, `select n.link from public.notifications n where n.kind = 'login_mencurigakan' order by id desc limit 1`)
    expect(l.link).toBe(`#/admin/perangkat?cabut=${x.deviceId}`)
    const ev = await h.satu(`select event, approx_country, detail from private.auth_events where device_id = $1 and event = 'login_mencurigakan'`, [x.deviceId])
    expect(ev).toEqual({ event: 'login_mencurigakan', approx_country: 'NG', detail: { alasan: 'negara_tidak_biasa', via: 'undangan' } })
    expect(await baris(db, `select * from private.login_digest`)).toEqual([])
  })

  it('negara yang sudah dipakai anggota itu dalam 90 hari tidak dianggap mencurigakan lagi (misalnya umroh)', async () => {
    const orang = await orangBaru('Bu Umroh Contoh')
    const p = await a.penandaNotifikasi()
    const pertama = await masukLewatUndangan(orang, { approx_country: 'SA', approx_city: 'Kota Suci Contoh' })
    await masukLewatUndangan(orang, { approx_country: 'SA' })
    const n = await a.notifikasiAdminSejak(p)
    expect(n.map((x) => x.kind)).toEqual(['login_mencurigakan', 'login_baru'])
    // Lebih dari 90 hari lalu: mencurigakan lagi.
    await db.query(`update public.devices set created_at = now() - interval '91 days' where member_id = $1`, [pertama.memberId])
    const q = await a.penandaNotifikasi()
    await masukLewatUndangan(orang, { approx_country: 'SA' })
    expect((await a.notifikasiAdminSejak(q)).map((x) => x.kind)).toEqual(['login_mencurigakan'])
  })

  it('daftar negara biasa bisa diubah admin; negara tidak diketahui tidak dianggap mencurigakan', async () => {
    await db.query(`update public.settings set usual_countries = '{ID,IT,MY}'`)
    const p = await a.penandaNotifikasi()
    await masukLewatUndangan(await orangBaru(), { approx_country: 'MY' })
    await masukLewatUndangan(await orangBaru(), {})
    expect((await a.notifikasiAdminSejak(p)).map((x) => x.kind)).toEqual(['login_baru', 'login_baru'])
  })
})

describe('mencabut perangkat', () => {
  it('perangkat sendiri bisa dicabut (langsung tertutup); perangkat orang lain tidak', async () => {
    const x = await masukLewatUndangan(await orangBaru())
    const y = await masukLewatUndangan(await orangBaru())
    await ditolak(a.rpc(x, 'revoke_device', { p_device: y.deviceId }), 'AK024')
    await a.rpc(y, 'revoke_device', { p_device: y.deviceId })
    expect(await a.siapa(y)).toBeNull()
    const ev = await h.satu(`select event, detail from private.auth_events where device_id = $1 and event = 'perangkat_dicabut'`, [y.deviceId])
    expect(ev.detail).toEqual({ oleh: y.memberId })
  })

  it('admin utama ("Cabut perangkat ini") hanya dengan verifikasi dua langkah; asisten tidak bisa', async () => {
    const x = await masukLewatUndangan(await orangBaru())
    await ditolak(a.rpc(owner, 'revoke_device', { p_device: x.deviceId }, 'aal1'), 'AK024')
    await ditolak(a.rpc(asisten, 'revoke_device', { p_device: x.deviceId }), 'AK024')
    await a.rpc(owner, 'revoke_device', { p_device: x.deviceId }, 'aal2')
    expect(await a.siapa(x)).toBeNull()
    await a.rpc(owner, 'revoke_device', { p_device: x.deviceId }, 'aal2') // mencabut lagi: tidak apa-apa
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'revoke_device', { p_device: x.deviceId }))).rejects.toThrow(/permission denied/)
  })
})

describe('cek perangkat saat aplikasi dibuka (fungsi Edge)', () => {
  const cek = (akun) => a.rpcServer('edge_device_check', { p_user: akun.userId, p_session: akun.sessionId })
  const lapor = (deviceId, info = {}, ip = '203.0.113.99') =>
    a.rpcServer('edge_report_revoked_device', { p_device: deviceId, p_ip: ip, p_info: info })

  it('tidak bisa dipanggil pengguna yang login', async () => {
    await expect(a.rpc(owner, 'edge_device_check', { p_user: owner.userId, p_session: owner.sessionId }, 'aal2')).rejects.toThrow(/permission denied/)
    await expect(a.rpc(owner, 'edge_report_revoked_device', { p_device: owner.deviceId }, 'aal2')).rejects.toThrow(/permission denied/)
  })

  it('perangkat sah → "ok" dan "terakhir aktif" dicatat (tidak terlalu sering)', async () => {
    const x = await masukLewatUndangan(await orangBaru())
    await db.query(`update public.devices set last_seen_at = now() - interval '1 hour' where id = $1`, [x.deviceId])
    expect(await cek(x)).toMatchObject({ status: 'ok', member_id: x.memberId, expires_at: null })
    const d = await h.satu(`select last_seen_at > now() - interval '1 minute' as baru from public.devices where id = $1`, [x.deviceId])
    expect(d.baru).toBe(true)
  })

  it('sesi tanpa perangkat, atau sesi milik akun lain → "tidak_terdaftar"; akses sementara habis → "kedaluwarsa"', async () => {
    const x = await masukLewatUndangan(await orangBaru())
    expect((await cek(await a.sesiBaru(x.userId))).status).toBe('tidak_terdaftar')
    expect((await cek({ userId: owner.userId, sessionId: x.sessionId })).status).toBe('tidak_terdaftar')
    const sementara = await a.anggota(await orangBaru(), { via: 'sementara', expiresAt: new Date(Date.now() - 1000) })
    expect((await cek(sementara)).status).toBe('kedaluwarsa')
  })

  it('perangkat yang sudah DICABUT dibuka lagi → admin langsung diberi tahu, dengan perkiraan lokasi; sekali sehari', async () => {
    const x = await masukLewatUndangan(await orangBaru('Pak Hilang Contoh'))
    await a.rpc(x, 'revoke_device', { p_device: x.deviceId })
    const r = await cek(x)
    expect(r).toEqual({ status: 'dicabut', device_id: x.deviceId, lapor: true })
    const p = await a.penandaNotifikasi()
    expect(await lapor(x.deviceId, { approx_country: 'ID', approx_country_name: 'Indonesia', approx_city: 'Kota Contoh', device_type: 'iPhone' })).toEqual({ status: 'ok' })
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([{
      kind: 'login_mencurigakan',
      title: 'Perangkat yang sudah dicabut dibuka lagi: Pak Hilang Contoh',
      body: `iPhone · Safari milik Pak Hilang Contoh dibuka lagi · sekitar Kota Contoh, Indonesia · ${await jamOwner()}. Data tetap tertutup untuk perangkat ini. Kalau ini mencurigakan, cabut akses Pak Hilang Contoh sepenuhnya.`,
      priority: 'penting',
    }])
    // Dalam 24 jam tidak diulang.
    expect((await cek(x)).lapor).toBe(false)
    expect(await lapor(x.deviceId)).toEqual({ status: 'dilewati' })
    expect(await a.notifikasiAdminSejak(p)).toHaveLength(1)
    // Perangkat yang masih sah tidak bisa "dilaporkan".
    const y = await masukLewatUndangan(await orangBaru())
    expect(await lapor(y.deviceId)).toEqual({ status: 'dilewati' })
  })

  it('anggota yang aksesnya dicabut tetapi membuka aplikasi → pesan khusus', async () => {
    const x = await masukLewatUndangan(await orangBaru('Bu Dicabut Contoh'))
    await db.query(`update public.members set status = 'dicabut', revoked_at = now() where id = $1`, [x.memberId])
    expect((await cek(x)).status).toBe('dicabut')
    const p = await a.penandaNotifikasi()
    await lapor(x.deviceId, {})
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n.title).toBe('Bu Dicabut Contoh membuka aplikasi walaupun aksesnya sudah dicabut')
    expect(n.body).toContain('lokasi tidak diketahui')
  })
})

describe('privasi: alamat IP mentah', () => {
  it('IP dari login dan dari laporan perangkat dicabut DIHAPUS setelah 30 hari; kota/negara tetap', async () => {
    const x = await masukLewatUndangan(await orangBaru(), { approx_country: 'ID', approx_city: 'Kota Contoh' }, '192.0.2.77')
    await a.rpc(x, 'revoke_device', { p_device: x.deviceId })
    await a.rpcServer('edge_report_revoked_device', { p_device: x.deviceId, p_ip: '203.0.113.77', p_info: { approx_country: 'ID' } })
    const ipAnggota = `select host(i.ip) as ip from private.login_ips i join private.auth_events e on e.id = i.event_id
                       where e.member_id = $1 order by 1`
    expect((await baris(db, ipAnggota, [x.memberId])).map((r) => r.ip)).toEqual(['192.0.2.77', '203.0.113.77'])

    // 29 hari: masih ada (untuk pemeriksaan keamanan).
    await db.query(`update private.login_ips set at = now() - interval '29 days'
                    where event_id in (select id from private.auth_events where member_id = $1)`, [x.memberId])
    await baris(db, `select private.purge_old_login_ips()`)
    expect(await baris(db, ipAnggota, [x.memberId])).toHaveLength(2)

    // 31 hari: terhapus.
    await db.query(`update private.login_ips set at = now() - interval '31 days'
                    where event_id in (select id from private.auth_events where member_id = $1)`, [x.memberId])
    await baris(db, `select private.purge_old_login_ips()`)
    expect(await baris(db, ipAnggota, [x.memberId])).toEqual([])

    // Alamat IP tidak tersisa di tempat lain mana pun (log, perangkat, notifikasi, tiket).
    for (const t of ['private.auth_events', 'public.devices', 'public.notifications', 'private.device_claims', 'private.login_digest']) {
      const [r] = await baris(db, `select count(*)::int as n from ${t} x where to_jsonb(x)::text ~ '(192\\.0\\.2\\.77|203\\.0\\.113\\.77)'`)
      expect(r.n, t).toBe(0)
    }

    // Yang tersisa hanya perkiraan kota/negara, jenis perangkat, dan waktu.
    const ev = await baris(db, `select approx_city, approx_country from private.auth_events
                                where member_id = $1 and event = 'undangan_dipakai'`, [x.memberId])
    expect(ev).toEqual([{ approx_city: 'Kota Contoh', approx_country: 'ID' }])
  })

  it('tidak ada kolom koordinat di tabel mana pun', async () => {
    const r = await baris(db, `select table_schema || '.' || table_name || '.' || column_name as k from information_schema.columns
      where table_schema in ('public', 'private') and column_name ~* '(^|_)(lat|lon|lng|latitude|longitude|koordinat|gps)($|_)'`)
    expect(r).toEqual([])
  })

  it('file data lokasi di Storage privat: pengguna yang login tidak bisa membacanya', async () => {
    await db.query(`insert into storage.objects (bucket_id, name) values ('lokasi-ip', 'lokasi-ip.bin.gz')`)
    const x = await masukLewatUndangan(await orangBaru())
    const r = await a.lewatApi(x, (tx) => baris(tx, `select name from storage.objects where bucket_id = 'lokasi-ip'`)).catch((e) => e)
    expect(Array.isArray(r) ? r : []).toEqual([])
    expect((await h.satu(`select public from storage.buckets where id = 'lokasi-ip'`)).public).toBe(false)
  })
})
