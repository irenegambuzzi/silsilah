// Tes link undangan, kode perangkat, akses sementara, batas percobaan, dan
// klaim perangkat (SQL 009). Semua orang FIKTIF.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { baris, buatDatabaseLengkap, buatPengguna, jalankanFileDanPeriksa, sebagai } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, panggilFungsi, pembantuAkses } from './pembantu-akses.js'
import { BENTUK_KODE, BENTUK_TOKEN, rapikanKode, sha256Hex } from '../functions/_shared/rahasia.js'

let db, h, a
const tahunIni = new Date().getUTCFullYear()

let kakek, nenek, anakA, menantu, anakB, cucuDewasa, cucuKecil, cucuTanpaTanggal, orangLepas, cucuLain, ua
let owner, asisten, asistenTanpaIzin, biasa, lihat

// Cucu dewasa baru (untuk anggota yang akan dicabut atau ditahan).
let nomorCucu = 0
const cucuBaru = async () => {
  const id = await h.orang(`Cucu Tambahan ${++nomorCucu} Contoh`, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return id
}

// Alamat IP acak, supaya batas percobaan hanya teruji di tes khususnya.
const ipAcak = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`

// Panggilan Edge Function (service_role).
const cek = (kind, hash, ip = ipAcak()) => a.rpcServer('edge_check_redemption', { p_kind: kind, p_hash: hash, p_ip: ip })
const selesai = (kind, hash, ip = ipAcak(), info = { device_type: 'iPhone', label: 'iPhone · Safari' }) =>
  a.rpcServer('edge_complete_redemption', { p_kind: kind, p_hash: hash, p_ip: ip, p_info: info })
const tautkan = (memberId, userId) => a.rpcServer('edge_attach_auth_user', { p_member: memberId, p_user: userId })

const undangan = (oleh, person, extra = {}, aal = 'aal2') =>
  a.rpc(oleh, 'create_invite', { p_person: person, ...extra }, aal)

// Membuat undangan untuk orang baru, menautkan akun login, dan memakainya
// lewat fungsi Edge. Hasil: { token, memberId, userId, tiket }.
async function pakaiUndanganBaru(person) {
  const u = await undangan(owner, person, { p_adult_confirmed: true })
  const hash = await sha256Hex(u.token)
  const c = await cek('undangan', hash)
  expect(c.status).toBe('ok')
  const userId = c.user_id ?? (await buatPengguna(db)).userId
  if (!c.user_id) expect((await tautkan(u.member_id, userId)).status).toBe('ok')
  const s = await selesai('undangan', hash)
  expect(s.status).toBe('ok')
  return { token: u.token, hash, memberId: u.member_id, userId, tiket: s.ticket, inviteId: u.invite_id }
}

beforeAll(async () => {
  db = await buatDatabaseLengkap()
  h = pembantuSilsilah(db)
  a = pembantuAkses(db)

  kakek = await h.orang('Kakek Contoh', { sex: 'L', birth_y: 1920 })
  nenek = await h.orang('Nenek Contoh', { sex: 'P', birth_y: 1925 })
  const akar = await h.nikah(kakek, nenek)
  await h.aturPangkal(akar)
  anakA = await h.orang('Anak A Contoh', { sex: 'L', birth_y: 1950 })
  anakB = await h.orang('Anak B Contoh', { sex: 'P', birth_y: 1952, nickname: 'Bu Contoh' })
  await h.anak(akar, anakA)
  await h.anak(akar, anakB)
  menantu = await h.orang('Menantu Contoh', { sex: 'P' })
  ua = await h.nikah(anakA, menantu)
  const cucu = async (nama, extra) => { const id = await h.orang(nama, extra); await h.anak(ua, id); return id }
  cucuDewasa = await cucu('Cucu Dewasa Contoh', { birth_y: tahunIni - 30 })
  cucuKecil = await cucu('Cucu Kecil Contoh', { birth_y: tahunIni - 10 })
  cucuTanpaTanggal = await cucu('Cucu Tanpa Tanggal Contoh')
  cucuLain = await cucu('Cucu Lain Contoh', { birth_y: tahunIni - 25 })
  orangLepas = await h.orang('Orang Lepas Contoh')
  const asistenOrang = await cucu('Asisten Dua Contoh', { birth_y: tahunIni - 40 })

  owner = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  asisten = await a.anggota(nenek, { role: 'asisten', permissions: ['buat_undangan', 'akses_sementara'], nama: 'Asisten Contoh' })
  asistenTanpaIzin = await a.anggota(asistenOrang, { role: 'asisten', permissions: ['bendahara'], nama: 'Asisten Tanpa Izin Contoh' })
  biasa = await a.anggota(anakA, { nama: 'Anggota Biasa Contoh' })
  lihat = await a.anggota(menantu, { role: 'lihat', nama: 'Hanya Melihat Contoh' })
}, 60000)

describe('009_undangan_perangkat.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '009_undangan_perangkat.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '009_undangan_perangkat.sql')).toEqual([])
  })
  it('hash SHA-256 di SQL sama dengan di Edge Function', async () => {
    for (const isi of ['abc', 'ABCD2345', 'x'.repeat(43), 'ñ ✓']) {
      const [r] = await baris(db, 'select private.sha256_hex($1) as h', [isi])
      expect(r.h).toBe(await sha256Hex(isi))
    }
  })
})

describe('membuat link undangan', () => {
  it('tamu (anon) tidak bisa memanggilnya sama sekali', async () => {
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'create_invite', { p_person: cucuDewasa })))
      .rejects.toThrow(/permission denied/)
  })

  it('hanya admin utama (dengan verifikasi dua langkah) dan asisten berizin', async () => {
    await ditolak(undangan(biasa, cucuDewasa, {}, 'aal1'), 'AK015')
    await ditolak(undangan(lihat, cucuDewasa, {}, 'aal1'), 'AK015')
    await ditolak(undangan(asistenTanpaIzin, cucuDewasa, {}, 'aal1'), 'AK015')
    await ditolak(undangan(owner, cucuDewasa, {}, 'aal1'), 'AK015')
    expect((await undangan(asisten, cucuDewasa, {}, 'aal1')).token).toBeTruthy()
    expect((await undangan(owner, cucuDewasa)).token).toBeTruthy()
  })

  it('token 32 byte acak ditampilkan sekali; yang disimpan hanya hash-nya; berlaku 7 hari', async () => {
    const u = await undangan(owner, cucuLain)
    expect(u.token).toMatch(BENTUK_TOKEN)
    const [r] = await baris(db, `select token_hash, extract(epoch from (expires_at - created_at)) / 86400 as hari,
      (select count(*)::int from private.invites i2 where i2.token_hash = $2) as token_asli_tersimpan
      from private.invites where id = $1`, [u.invite_id, u.token])
    expect(r.token_hash).toBe(await sha256Hex(u.token))
    expect(r.token_asli_tersimpan).toBe(0)
    expect(Number(r.hari)).toBeCloseTo(7, 3)
    // Tidak ada kolom teks di tabel akses yang memuat token aslinya.
    const [bocor] = await baris(db, `select count(*)::int as n from private.invites i
      where to_jsonb(i)::text like '%' || $1 || '%'`, [u.token])
    expect(bocor.n).toBe(0)
    const [log] = await baris(db, `select count(*)::int as n from private.auth_events e
      where to_jsonb(e)::text like '%' || $1 || '%'`, [u.token])
    expect(log.n).toBe(0)
  })

  it('anggota baru dibuat dari silsilah: nama panggilan kalau ada, peran bawaan "anggota"', async () => {
    const u = await undangan(owner, anakB)
    const m = await h.satu(`select display_name, role, auth_user_id from public.members where id = $1`, [u.member_id])
    expect(m).toEqual({ display_name: 'Bu Contoh', role: 'anggota', auth_user_id: null })
    const v = await undangan(owner, cucuTanpaTanggal, { p_role: 'lihat', p_adult_confirmed: true })
    expect((await h.satu(`select role from public.members where id = $1`, [v.member_id])).role).toBe('lihat')
  })

  it('peran lewat undangan hanya "lihat" atau "anggota", dan tidak mengubah peran anggota yang sudah ada', async () => {
    await ditolak(undangan(owner, orangLepas, { p_role: 'asisten' }), 'AK018')
    await ditolak(undangan(owner, anakB, { p_role: 'lihat' }), 'AK018')
  })

  it('link baru otomatis membatalkan link lama yang belum dipakai untuk orang yang sama', async () => {
    const lama = await undangan(owner, cucuLain)
    const baru = await undangan(owner, cucuLain)
    const r = await baris(db, `select id, revoked_at is not null as dicabut from private.invites where id in ($1, $2)`,
      [lama.invite_id, baru.invite_id])
    expect(Object.fromEntries(r.map((x) => [x.id, x.dicabut]))).toEqual({ [lama.invite_id]: true, [baru.invite_id]: false })
    expect((await cek('undangan', await sha256Hex(lama.token))).status).toBe('dicabut')
  })

  it('anak di bawah umur ditolak, dan tidak meninggalkan baris anggota', async () => {
    await ditolak(undangan(owner, cucuKecil), 'AK004')
    expect(await h.satu(`select id from public.members where person_id = $1`, [cucuKecil])).toBeUndefined()
  })

  it('tanggal lahir tidak diketahui: wajib dicentang "sudah dewasa", dan siapa yang mencentang tercatat', async () => {
    const x = await h.orang('Menantu Tanpa Tanggal Contoh')
    await h.nikah(anakB, x) // menantu: dewasa karena menikah
    const y = await h.orang('Cucu Tanpa Tanggal Dua Contoh')
    await h.anak(ua, y)
    await ditolak(undangan(asisten, y, {}, 'aal1'), 'AK005')
    const u = await undangan(asisten, y, { p_adult_confirmed: true }, 'aal1')
    expect((await h.satu(`select adult_confirmed_by from private.invites where id = $1`, [u.invite_id])).adult_confirmed_by)
      .toBe(asisten.memberId)
    // Yang sudah pasti dewasa tidak perlu (dan tidak mencatat) centang.
    const v = await undangan(owner, x, { p_adult_confirmed: true })
    expect((await h.satu(`select adult_confirmed_by from private.invites where id = $1`, [v.invite_id])).adult_confirmed_by).toBeNull()
  })

  it('yang sudah wafat atau bukan keturunan/menantu ditolak', async () => {
    const wafat = await h.orang('Cucu Wafat Contoh', { birth_y: 1960, is_deceased: true })
    await h.anak(ua, wafat)
    await ditolak(undangan(owner, wafat), 'AK010')
    await ditolak(undangan(owner, orangLepas), 'AK003')
    await ditolak(undangan(owner, '00000000-0000-0000-0000-000000000000'), 'AK003')
  })

  it('link untuk admin utama atau asisten hanya bisa dibuat admin utama', async () => {
    await ditolak(undangan(asisten, kakek, {}, 'aal1'), 'AK017')
    await ditolak(undangan(asisten, nenek, {}, 'aal1'), 'AK017')
    expect((await undangan(owner, nenek)).token).toBeTruthy()
  })

  it('link baru untuk orang yang sudah pernah masuk: admin utama diberi tahu kalau dibuat orang lain', async () => {
    const p = await a.penandaNotifikasi()
    await undangan(asisten, anakA, {}, 'aal1')
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ kind: 'undangan_ulang', priority: 'penting', title: 'Link baru untuk Anggota Biasa Contoh' })
    const q = await a.penandaNotifikasi()
    await undangan(owner, anakA)
    expect(await a.notifikasiAdminSejak(q)).toEqual([])
  })

  it('setiap link yang dibuat tercatat di log', async () => {
    const u = await undangan(asisten, cucuDewasa, {}, 'aal1')
    const ev = await h.satu(`select event, detail from private.auth_events where detail ->> 'invite_id' = $1`, [u.invite_id])
    expect(ev).toMatchObject({ event: 'undangan_dibuat', detail: { oleh: asisten.memberId } })
  })

  it('membatalkan link: berizin saja, hanya link yang belum dipakai, dan link admin/asisten hanya oleh admin utama', async () => {
    const u = await undangan(asisten, cucuDewasa, {}, 'aal1')
    await ditolak(a.rpc(biasa, 'revoke_invite', { p_invite: u.invite_id }), 'AK015')
    await a.rpc(asisten, 'revoke_invite', { p_invite: u.invite_id })
    await ditolak(a.rpc(asisten, 'revoke_invite', { p_invite: u.invite_id }), 'AK006')
    expect((await cek('undangan', await sha256Hex(u.token))).status).toBe('dicabut')
    const w = await undangan(owner, nenek)
    await ditolak(a.rpc(asisten, 'revoke_invite', { p_invite: w.invite_id }), 'AK017')
  })
})

describe('kode tambah perangkat', () => {
  it('hanya dari perangkat yang sudah masuk', async () => {
    const tanpaPerangkat = await a.sesiBaru(biasa.userId)
    await ditolak(a.rpc(tanpaPerangkat, 'create_device_code', {}), 'AK021')
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'create_device_code'))).rejects.toThrow(/permission denied/)
  })

  it('8 karakter yang tidak mudah tertukar, berlaku 10 menit, hanya hash yang disimpan', async () => {
    const k = await a.rpc(lihat, 'create_device_code', {})
    expect(k.code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
    expect(rapikanKode(k.code)).toMatch(BENTUK_KODE)
    const r = await h.satu(`select code_hash, kind, extract(epoch from (expires_at - created_at)) / 60 as menit,
      created_from_device from private.device_codes where id = $1`, [k.code_id])
    expect(r).toMatchObject({ code_hash: await sha256Hex(rapikanKode(k.code)), kind: 'tambah_perangkat', created_from_device: lihat.deviceId })
    expect(Number(r.menit)).toBeCloseTo(10, 3)
  })

  it('kode baru membatalkan kode lama yang belum dipakai', async () => {
    const lama = await a.rpc(biasa, 'create_device_code', {})
    const baru = await a.rpc(biasa, 'create_device_code', {})
    expect((await cek('kode', await sha256Hex(rapikanKode(lama.code)))).status).toBe('dicabut')
    expect((await cek('kode', await sha256Hex(rapikanKode(baru.code)))).status).toBe('ok')
  })

  it('perangkat akses sementara tidak bisa menambah perangkat (akses tidak bisa diperpanjang sendiri)', async () => {
    const sesi = await a.sesiBaru(biasa.userId)
    await db.query(`insert into public.devices (member_id, session_id, via, expires_at) values ($1, $2, 'sementara', now() + interval '1 hour')`,
      [biasa.memberId, sesi.sessionId])
    await ditolak(a.rpc(sesi, 'create_device_code', {}), 'AK014')
  })

  it('bisa dimatikan admin: kode baru ditolak, kode yang sudah ada juga tidak bisa dipakai', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    await db.query(`update public.settings set device_codes_enabled = false`)
    try {
      await ditolak(a.rpc(biasa, 'create_device_code', {}), 'AK013')
      expect((await cek('kode', await sha256Hex(rapikanKode(k.code)))).status).toBe('dimatikan')
    } finally {
      await db.query(`update public.settings set device_codes_enabled = true`)
    }
  })

  it('anggota yang sedang ditahan tidak bisa menambah perangkat', async () => {
    const x = await a.anggota(await cucuBaru(), { nama: 'Ditahan Contoh' })
    await db.query(`update public.members set hold_until = 'infinity', hold_reason = 'uji' where id = $1`, [x.memberId])
    await ditolak(a.rpc(x, 'create_device_code', {}), 'AK023')
    await db.query(`update public.members set hold_until = null, hold_reason = null where id = $1`, [x.memberId])
  })
})

describe('kode akses sementara', () => {
  const akses = (oleh, member, menit, aal = 'aal1') =>
    a.rpc(oleh, 'create_temp_access_code', { p_member: member, p_minutes: menit }, aal)

  it('hanya admin utama dan asisten dengan izin akses_sementara', async () => {
    await ditolak(akses(biasa, lihat.memberId, 60), 'AK016')
    await ditolak(akses(asistenTanpaIzin, lihat.memberId, 60), 'AK016')
    await ditolak(akses(owner, lihat.memberId, 60, 'aal1'), 'AK016')
    expect((await akses(asisten, lihat.memberId, 60)).code).toBeTruthy()
    expect((await akses(owner, lihat.memberId, 60, 'aal2')).code).toBeTruthy()
  })

  it('durasi minimal 30 menit, maksimal batas dari admin (bawaan 24 jam)', async () => {
    await ditolak(akses(asisten, lihat.memberId, 29), 'AK022')
    await ditolak(akses(asisten, lihat.memberId, 1441), 'AK009')
    const k = await akses(asisten, lihat.memberId, 1440)
    expect(k.access_minutes).toBe(1440)
  })

  it('tidak untuk anggota yang dicabut; untuk admin utama/asisten hanya oleh admin utama', async () => {
    await ditolak(akses(asisten, owner.memberId, 60), 'AK017')
    await ditolak(akses(asisten, asistenTanpaIzin.memberId, 60), 'AK017')
    const x = await a.anggota(await cucuBaru(), { nama: 'Dicabut Contoh' })
    await db.query(`update public.members set status = 'dicabut', revoked_at = now() where id = $1`, [x.memberId])
    await ditolak(akses(asisten, x.memberId, 60), 'AK012')
  })

  it('tercatat, dan admin utama diberi tahu kalau diberikan orang lain', async () => {
    const p = await a.penandaNotifikasi()
    const k = await akses(asisten, lihat.memberId, 90)
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([expect.objectContaining({
      kind: 'akses_sementara',
      title: 'Hanya Melihat Contoh diberi akses sementara',
      body: 'Asisten Contoh memberi Hanya Melihat Contoh akses sementara selama 90 menit. Kodenya berlaku 10 menit.',
    })])
    const ev = await h.satu(`select event from private.auth_events where detail ->> 'code_id' = $1`, [k.code_id])
    expect(ev.event).toBe('akses_sementara_diberikan')
  })
})

describe('fungsi khusus Edge Function', () => {
  it('tidak bisa dipanggil tamu maupun pengguna yang login', async () => {
    for (const [nama, args] of [
      ['edge_check_redemption', { p_kind: 'undangan', p_hash: '0'.repeat(64) }],
      ['edge_complete_redemption', { p_kind: 'undangan', p_hash: '0'.repeat(64) }],
      ['edge_attach_auth_user', { p_member: biasa.memberId, p_user: biasa.userId }],
    ]) {
      await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, nama, args))).rejects.toThrow(/permission denied/)
      await expect(a.rpc(owner, nama, args, 'aal2')).rejects.toThrow(/permission denied/)
    }
  })

  it('isian aneh atau link tidak dikenal → tidak_dikenal', async () => {
    expect((await cek('undangan', 'bukan-hash')).status).toBe('tidak_dikenal')
    expect((await cek('lain', '0'.repeat(64))).status).toBe('tidak_dikenal')
    expect((await cek('undangan', 'f'.repeat(64))).status).toBe('tidak_dikenal')
    expect((await cek('kode', 'f'.repeat(64))).status).toBe('salah')
  })

  it('memeriksa tidak memakai link; menautkan akun login tidak bisa mengganti akun yang sudah ada', async () => {
    const u = await undangan(owner, cucuDewasa)
    const hash = await sha256Hex(u.token)
    const c = await cek('undangan', hash)
    expect(c).toMatchObject({ status: 'ok', member_id: u.member_id, user_id: null })
    expect((await h.satu(`select used_at from private.invites where id = $1`, [u.invite_id])).used_at).toBeNull()
    // Belum ada akun login tertaut → link tidak dipakai.
    expect((await selesai('undangan', hash)).status).toBe('server')
    expect((await h.satu(`select used_at from private.invites where id = $1`, [u.invite_id])).used_at).toBeNull()
    const akun = await buatPengguna(db)
    expect((await tautkan(u.member_id, akun.userId)).status).toBe('ok')
    expect((await tautkan(u.member_id, akun.userId)).status).toBe('ok')
    expect((await tautkan(u.member_id, (await buatPengguna(db)).userId)).status).toBe('bentrok')
    expect((await cek('undangan', hash)).user_id).toBe(akun.userId)
  })

  it('SEKALI PAKAI: dipakai sekali → berikutnya "sudah_dipakai", dan admin utama langsung diberi tahu', async () => {
    const x = await pakaiUndanganBaru(cucuLain)
    const r = await h.satu(`select used_at from private.invites where token_hash = $1`, [x.hash])
    expect(r.used_at).not.toBeNull()
    const p = await a.penandaNotifikasi()
    expect((await cek('undangan', x.hash, '203.0.113.50')).status).toBe('sudah_dipakai')
    expect((await selesai('undangan', x.hash, '203.0.113.50')).status).toBe('sudah_dipakai')
    const n = await a.notifikasiAdminSejak(p)
    expect(n.length).toBeGreaterThanOrEqual(1)
    expect(n[0]).toMatchObject({ kind: 'login_mencurigakan', priority: 'penting', title: 'Link undangan Cucu Lain Contoh dibuka lagi' })
    const ev = await h.satu(`select e.event, e.detail, host(i.ip) as ip from private.auth_events e
      left join private.login_ips i on i.event_id = e.id
      where e.member_id = $1 and e.event = 'undangan_ditolak' order by e.id desc limit 1`, [x.memberId])
    expect(ev).toEqual({ event: 'undangan_ditolak', detail: { alasan: 'sudah_dipakai' }, ip: '203.0.113.50' })
  })

  it('dua orang menekan "Masuk" bersamaan dengan link yang sama: hanya satu yang berhasil', async () => {
    const u = await undangan(owner, cucuDewasa)
    const hash = await sha256Hex(u.token)
    // Keduanya lolos pemeriksaan awal …
    expect((await cek('undangan', hash)).status).toBe('ok')
    expect((await cek('undangan', hash)).status).toBe('ok')
    // … tetapi pemakaiannya terkunci: yang kedua ditolak.
    expect((await selesai('undangan', hash)).status).toBe('ok')
    expect((await selesai('undangan', hash)).status).toBe('sudah_dipakai')
    const [r] = await baris(db, `select count(*)::int as n from private.device_claims c join private.invites i on i.id = c.invite_id
      where i.token_hash = $1`, [hash])
    expect(r.n).toBe(1)
  })

  it('link kedaluwarsa (lebih dari 7 hari) → "kedaluwarsa"; admin tidak diganggu', async () => {
    const u = await undangan(owner, cucuDewasa)
    await db.exec(`alter table private.invites disable trigger b_guard`)
    await db.query(`update private.invites set expires_at = now() - interval '1 minute' where id = $1`, [u.invite_id])
    await db.exec(`alter table private.invites enable trigger b_guard`)
    const p = await a.penandaNotifikasi()
    expect((await cek('undangan', await sha256Hex(u.token))).status).toBe('kedaluwarsa')
    expect(await a.notifikasiAdminSejak(p)).toEqual([])
  })

  it('anggota yang aksesnya dicabut: link dan kode yang masih ada tidak berlaku', async () => {
    const x = await a.anggota(await cucuBaru(), { nama: 'Akan Dicabut Contoh' })
    const k = await a.rpc(x, 'create_device_code', {})
    await db.query(`update public.members set status = 'dicabut', revoked_at = now() where id = $1`, [x.memberId])
    expect((await cek('kode', await sha256Hex(rapikanKode(k.code)))).status).toBe('dicabut')
    expect((await selesai('kode', await sha256Hex(rapikanKode(k.code)))).status).toBe('dicabut')
  })

  it('kode: sekali pakai, 10 menit; percobaan memakai kode lama tercatat', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    const hash = await sha256Hex(rapikanKode(k.code))
    expect((await cek('kode', hash)).status).toBe('ok')
    expect(await selesai('kode', hash)).toMatchObject({ status: 'ok', via: 'kode', access_minutes: null })
    expect((await cek('kode', hash)).status).toBe('sudah_dipakai')
    expect((await h.satu(`select attempts from private.device_codes where id = $1`, [k.code_id])).attempts).toBe(1)
    const l = await a.rpc(biasa, 'create_device_code', {})
    await db.exec(`alter table private.device_codes disable trigger b_guard`)
    await db.query(`update private.device_codes set expires_at = now() - interval '1 second' where id = $1`, [l.code_id])
    await db.exec(`alter table private.device_codes enable trigger b_guard`)
    expect((await cek('kode', await sha256Hex(rapikanKode(l.code)))).status).toBe('kedaluwarsa')
  })

  it('kode akses sementara menghasilkan tiket "sementara" dengan durasinya', async () => {
    const k = await a.rpc(asisten, 'create_temp_access_code', { p_member: lihat.memberId, p_minutes: 45 })
    expect(await selesai('kode', await sha256Hex(rapikanKode(k.code)))).toMatchObject({ status: 'ok', via: 'sementara', access_minutes: 45 })
  })

  it('perkiraan perangkat dan lokasi disimpan seadanya; isian aneh dibuang', async () => {
    const u = await undangan(owner, cucuDewasa)
    const hash = await sha256Hex(u.token)
    await cek('undangan', hash)
    const s = await selesai('undangan', hash, 'bukan-ip', { device_type: 'x'.repeat(80), approx_country: 'Indonesia', approx_city: ' Kota Contoh ' })
    expect(s.status).toBe('ok')
    const ev = await h.satu(`select device_type, approx_city, approx_country,
      (select count(*)::int from private.login_ips where event_id = e.id) as ip
      from private.auth_events e where detail ->> 'invite_id' = $1 and event = 'undangan_dipakai'`, [u.invite_id])
    expect(ev).toEqual({ device_type: 'x'.repeat(50), approx_city: 'Kota Contoh', approx_country: null, ip: 0 })
  })
})

describe('batas percobaan yang salah', () => {
  beforeEach(async () => {
    await db.query(`delete from private.redeem_attempts`)
  })
  const kodeAcak = async (i) => sha256Hex(`SALAH${String(i).padStart(3, '0')}`)

  it('kode: 5 kali salah dari satu alamat → alamat itu ditolak 15 menit, walaupun kodenya benar', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    const benar = await sha256Hex(rapikanKode(k.code))
    const p = await a.penandaNotifikasi()
    for (let i = 0; i < 5; i++) expect((await cek('kode', await kodeAcak(i), '192.0.2.10')).status).toBe('salah')
    expect((await cek('kode', benar, '192.0.2.10')).status).toBe('terlalu_sering')
    expect((await cek('kode', await kodeAcak(9), '192.0.2.10')).status).toBe('terlalu_sering')
    // Alamat lain tidak terpengaruh.
    expect((await cek('kode', benar, '192.0.2.11')).status).toBe('ok')
    // Admin utama diberi tahu SEKALI.
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toEqual([expect.objectContaining({ kind: 'login_mencurigakan', title: 'Banyak percobaan kode perangkat yang salah' })])
    // Setelah 15 menit boleh mencoba lagi.
    await db.query(`update private.redeem_attempts set at = at - interval '16 minutes'`)
    expect((await cek('kode', benar, '192.0.2.10')).status).toBe('ok')
  })

  it('kode: 30 kali salah dari berbagai alamat dalam 10 menit → semua pemakaian kode ditolak sementara', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    const benar = await sha256Hex(rapikanKode(k.code))
    const p = await a.penandaNotifikasi()
    for (let i = 0; i < 30; i++) await cek('kode', await kodeAcak(i), `192.0.2.${100 + i}`)
    expect((await cek('kode', benar, '192.0.2.250')).status).toBe('terlalu_sering')
    // Link undangan tidak ikut terhenti.
    const u = await undangan(owner, cucuDewasa)
    expect((await cek('undangan', await sha256Hex(u.token), '192.0.2.250')).status).toBe('ok')
    const n = await a.notifikasiAdminSejak(p)
    expect(n.filter((x) => x.title === 'Pemakaian kode perangkat dihentikan sementara')).toHaveLength(1)
    await db.query(`update private.redeem_attempts set at = at - interval '11 minutes'`)
    expect((await cek('kode', benar, '192.0.2.250')).status).toBe('ok')
  })

  it('undangan: 10 kali salah dari satu alamat → ditolak sementara', async () => {
    for (let i = 0; i < 10; i++) expect((await cek('undangan', await kodeAcak(i), '192.0.2.20')).status).toBe('tidak_dikenal')
    const u = await undangan(owner, cucuDewasa)
    expect((await cek('undangan', await sha256Hex(u.token), '192.0.2.20')).status).toBe('terlalu_sering')
  })

  it('percobaan yang ditolak karena batas tidak menambah hitungan (tidak ada catatan baru)', async () => {
    for (let i = 0; i < 5; i++) await cek('kode', await kodeAcak(i), '192.0.2.30')
    for (let i = 0; i < 5; i++) await cek('kode', await kodeAcak(i), '192.0.2.30')
    const [r] = await baris(db, `select count(*)::int as n from private.redeem_attempts where ip = '192.0.2.30'`)
    expect(r.n).toBe(5)
  })

  it('catatan percobaan (berisi alamat IP) dan tiket lama dihapus setelah 1 hari', async () => {
    await cek('kode', await kodeAcak(1), '192.0.2.40')
    await db.query(`update private.redeem_attempts set at = now() - interval '25 hours'`)
    await db.query(`update private.device_claims set expires_at = now() - interval '25 hours'
                    where id = (select id from private.device_claims order by created_at limit 1)`)
    const [r] = await baris(db, `select private.purge_redeem_data() as n`)
    expect(r.n).toBe(2)
    const [sisa] = await baris(db, `select count(*)::int as n from private.redeem_attempts`)
    expect(sisa.n).toBe(0)
  })
})

describe('klaim perangkat', () => {
  const klaim = (akun, tiket, zona = 'Asia/Jakarta') =>
    a.rpc(akun, 'claim_device', { p_ticket: tiket, p_timezone: zona })

  it('sesi tanpa klaim perangkat tidak bisa membaca apa pun; setelah klaim bisa', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    const sesi = await a.sesiBaru(x.userId)
    expect(await a.siapa(sesi)).toBeNull()
    const [orang] = await a.lewatApi(sesi, (tx) => baris(tx, 'select count(*)::int as n from public.people'))
    expect(orang.n).toBe(0)
    const d = await klaim(sesi, x.tiket)
    expect(d).toMatchObject({ member_id: x.memberId, via: 'undangan', expires_at: null })
    expect(await a.siapa(sesi)).toBe(x.memberId)
    const dev = await h.satu(`select label, device_type, timezone, session_id from public.devices where id = $1`, [d.device_id])
    expect(dev).toEqual({ label: 'iPhone · Safari', device_type: 'iPhone', timezone: 'Asia/Jakarta', session_id: sesi.sessionId })
    // Link dan log menunjuk perangkat ini.
    expect((await h.satu(`select used_device_id from private.invites where id = $1`, [x.inviteId])).used_device_id).toBe(d.device_id)
    expect((await h.satu(`select device_id from private.auth_events where detail ->> 'invite_id' = $1 and event = 'undangan_dipakai'`,
      [x.inviteId])).device_id).toBe(d.device_id)
  })

  it('aman diulang dari sesi yang sama; tiket tidak bisa dipakai sesi lain', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    const sesi = await a.sesiBaru(x.userId)
    const d1 = await klaim(sesi, x.tiket)
    const d2 = await klaim(sesi, x.tiket)
    expect(d2.device_id).toBe(d1.device_id)
    await ditolak(klaim(await a.sesiBaru(x.userId), x.tiket), 'AK019')
  })

  it('tiket hanya untuk akun anggota itu (tiket curian tidak berguna)', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    const penyusup = await buatPengguna(db)
    await ditolak(klaim(penyusup, x.tiket), 'AK019')
    await ditolak(klaim(biasa, x.tiket), 'AK019')
  })

  it('tiket kedaluwarsa (10 menit) atau tidak dikenal ditolak', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    const [t] = await baris(db, `select extract(epoch from (expires_at - created_at)) / 60 as menit from private.device_claims
      where ticket_hash = $1`, [await sha256Hex(x.tiket)])
    expect(Number(t.menit)).toBeCloseTo(10, 3)
    await db.query(`update private.device_claims set expires_at = now() - interval '1 second' where ticket_hash = $1`, [await sha256Hex(x.tiket)])
    await ditolak(klaim(await a.sesiBaru(x.userId), x.tiket), 'AK019')
    await ditolak(klaim(await a.sesiBaru(x.userId), 'tiket-palsu'), 'AK019')
  })

  it('belum masuk, atau sesi yang sudah terdaftar, ditolak', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    await ditolak(sebagai(db, 'authenticated', { sub: x.userId }, (tx) => panggilFungsi(tx, 'claim_device', { p_ticket: x.tiket })), 'AK021')
    await expect(sebagai(db, 'anon', {}, (tx) => panggilFungsi(tx, 'claim_device', { p_ticket: x.tiket }))).rejects.toThrow(/permission denied/)
    // Sesi perangkat lama dipakai untuk tiket baru: ditolak (tidak menggandakan perangkat).
    const sesi = await a.sesiBaru(x.userId)
    await klaim(sesi, x.tiket)
    const k = await a.rpc(sesi, 'create_device_code', {})
    const hash = await sha256Hex(rapikanKode(k.code))
    await cek('kode', hash)
    const s = await selesai('kode', hash)
    await ditolak(klaim(sesi, s.ticket), 'AK020')
  })

  it('zona waktu yang aneh dibuang', async () => {
    const x = await pakaiUndanganBaru(cucuDewasa)
    const sesi = await a.sesiBaru(x.userId)
    const d = await klaim(sesi, x.tiket, "x'; drop table people; --")
    expect((await h.satu(`select timezone from public.devices where id = $1`, [d.device_id])).timezone).toBeNull()
  })

  it('akses sementara: perangkat berakhir sendiri setelah durasinya', async () => {
    const k = await a.rpc(asisten, 'create_temp_access_code', { p_member: lihat.memberId, p_minutes: 30 })
    const hash = await sha256Hex(rapikanKode(k.code))
    await cek('kode', hash)
    const s = await selesai('kode', hash)
    const sesi = await a.sesiBaru(lihat.userId)
    const d = await klaim(sesi, s.ticket)
    expect(d.via).toBe('sementara')
    const [r] = await baris(db, `select extract(epoch from (expires_at - created_at)) / 60 as menit from public.devices where id = $1`, [d.device_id])
    expect(Number(r.menit)).toBeCloseTo(30, 1)
    expect(await a.siapa(sesi)).toBe(lihat.memberId)
    await db.query(`update public.devices set expires_at = now() - interval '1 second' where id = $1`, [d.device_id])
    expect(await a.siapa(sesi)).toBeNull()
    // Perangkat lain anggota itu tidak terpengaruh.
    expect(await a.siapa(lihat)).toBe(lihat.memberId)
  })

  it('tiket dari kode tambah perangkat: perangkat kedua untuk anggota yang sama', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    const hash = await sha256Hex(rapikanKode(k.code))
    await cek('kode', hash)
    const s = await selesai('kode', hash)
    const sesi = await a.sesiBaru(biasa.userId)
    const d = await klaim(sesi, s.ticket)
    expect(d).toMatchObject({ member_id: biasa.memberId, via: 'kode', expires_at: null })
    expect((await h.satu(`select used_device_id from private.device_codes where id = $1`, [k.code_id])).used_device_id).toBe(d.device_id)
  })
})
