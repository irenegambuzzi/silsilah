// Tes ujung ke ujung Edge Function pakai-undangan dan pakai-kode: kode
// Edge Function yang SAMA dengan yang di-deploy (buatPenangan dari
// functions/_shared), database tes dengan semua migrasi, dan tiruan Auth
// Supabase (createUser, generateLink, verifyOtp). Semua orang FIKTIF.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { baris, buatDatabaseLengkap } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { ditolak, pembantuAkses } from './pembantu-akses.js'
import { buatPenangan } from '../functions/_shared/http.js'
import { emailSintetis } from '../functions/_shared/penukaran.js'
import { buatTiruanAuth, rpcLayanan } from './tiruan-auth.js'

let db, h, a, auth, rpc, catatan
let owner, biasa, ua
const tahunIni = new Date().getUTCFullYear()
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const tiruanAuth = () => buatTiruanAuth(db)
const rpcServer = (nama, args) => rpcLayanan(db)(nama, args)

let ipBerikut = 1
const kirim = async (jenis, isi, { ip = `198.51.100.${ipBerikut++ % 250}`, uaHeader = UA_IPHONE } = {}) => {
  const penangan = buatPenangan(jenis, () => ({ rpc, auth }), { catat: (x) => catatan.push(x) })
  const res = await penangan(new Request(`https://contoh.invalid/functions/v1/pakai-${jenis}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'user-agent': uaHeader },
    body: JSON.stringify(isi),
  }))
  const teks = await res.text()
  return { status: res.status, teks, isi: JSON.parse(teks) }
}

// Aplikasi setelah menerima jawaban: bentuk sesi, lalu klaim perangkat.
async function masuk(hasil) {
  const sesi = await auth.verifyOtp(hasil.token_hash)
  const perangkat = await a.rpc(sesi, 'claim_device', { p_ticket: hasil.tiket, p_timezone: 'Asia/Jakarta' })
  return { sesi, perangkat }
}

const jumlahAkun = async () => (await baris(db, 'select count(*)::int as n from auth.users'))[0].n

const cucuBaru = async (nama) => {
  const id = await h.orang(nama, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return id
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
  owner = await a.anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  biasa = await a.anggota(anak, { nama: 'Anggota Biasa Contoh' })
}, 60000)

beforeEach(() => {
  auth = tiruanAuth()
  rpc = vi.fn(rpcServer)
  catatan = []
})

describe('pakai-undangan: pertama kali masuk', () => {
  it('link → akun login dibuat (email sintetis) → sesi → perangkat terdaftar → bisa membaca silsilah', async () => {
    const orang = await cucuBaru('Bu Wulan Contoh')
    const u = await a.rpc(owner, 'create_invite', { p_person: orang }, 'aal2')
    const akunSebelum = await jumlahAkun()

    const r = await kirim('undangan', { token: u.token })
    expect(r.status).toBe(200)
    expect(r.isi).toMatchObject({ ok: true, nama: 'Bu Wulan Contoh', via: 'undangan', menit: null })
    expect(r.isi.token_hash).toBeTruthy()
    expect(r.isi.tiket).toBeTruthy()
    expect(await jumlahAkun()).toBe(akunSebelum + 1)
    const m = await h.satu(`select m.auth_user_id, u.email from public.members m join auth.users u on u.id = m.auth_user_id
      where m.id = $1`, [u.member_id])
    expect(m.email).toBe(emailSintetis(u.member_id))

    const { sesi, perangkat } = await masuk(r.isi)
    expect(perangkat).toMatchObject({ member_id: u.member_id, via: 'undangan' })
    expect(await a.siapa(sesi)).toBe(u.member_id)
    const [n] = await a.lewatApi(sesi, (tx) => baris(tx, 'select count(*)::int as n from public.people'))
    expect(n.n).toBeGreaterThan(0)
    const d = await h.satu(`select label, device_type from public.devices where id = $1`, [perangkat.device_id])
    expect(d).toEqual({ label: 'iPhone · Safari', device_type: 'iPhone' })
  })

  it('jawaban tidak pernah memuat token undangan, dan catatan galat kosong', async () => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru('Cucu Rahasia Contoh') }, 'aal2')
    const r = await kirim('undangan', { token: u.token })
    expect(r.teks).not.toContain(u.token)
    expect(catatan).toEqual([])
  })
})

describe('pakai-undangan: link diteruskan, kedaluwarsa, atau dibatalkan', () => {
  it('link yang sudah dipakai lalu diteruskan ke orang lain → "sudah_dipakai", tanpa nama, admin diberi tahu', async () => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru('Cucu Diteruskan Contoh') }, 'aal2')
    const pertama = await kirim('undangan', { token: u.token })
    await masuk(pertama.isi)
    const p = await a.penandaNotifikasi()
    const kedua = await kirim('undangan', { token: u.token }, { ip: '203.0.113.9' })
    expect(kedua.isi).toEqual({ ok: false, alasan: 'sudah_dipakai' })
    expect(kedua.teks).not.toContain('Cucu Diteruskan')
    const n = await a.notifikasiAdminSejak(p)
    expect(n[0]).toMatchObject({ kind: 'login_mencurigakan', priority: 'penting', title: 'Link undangan Cucu Diteruskan Contoh dibuka lagi' })
  })

  it('dua orang menekan "Masuk" BERSAMAAN: tepat satu berhasil, satu akun login saja', async () => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru('Cucu Rebutan Contoh') }, 'aal2')
    const akunSebelum = await jumlahAkun()
    // Paksa keadaan terburuk: tautan masuk baru dibuat setelah KEDUA permintaan
    // lolos pemeriksaan awal, jadi keduanya sampai ke langkah memakai link.
    let lepas
    const keduanyaSudahDiperiksa = new Promise((r) => { lepas = r })
    let diperiksa = 0
    rpc = vi.fn(async (nama, args) => {
      const r = await rpcServer(nama, args)
      if (nama === 'edge_check_redemption' && ++diperiksa === 2) lepas()
      return r
    })
    const generateLinkAsli = auth.generateLink
    auth.generateLink = async (x) => { await keduanyaSudahDiperiksa; return generateLinkAsli(x) }

    const hasil = await Promise.all([kirim('undangan', { token: u.token }), kirim('undangan', { token: u.token })])
    const urutan = rpc.mock.calls.map(([nama]) => nama)
    expect(urutan.slice(0, 2)).toEqual(['edge_check_redemption', 'edge_check_redemption'])
    expect(urutan.filter((n) => n === 'edge_complete_redemption')).toHaveLength(2)
    expect(hasil.filter((r) => r.isi.ok)).toHaveLength(1)
    expect(hasil.find((r) => !r.isi.ok).isi).toEqual({ ok: false, alasan: 'sudah_dipakai' })
    expect(await jumlahAkun()).toBe(akunSebelum + 1)
  })

  it('link kedaluwarsa → "kedaluwarsa"; link yang dibatalkan → "dicabut"', async () => {
    const orang = await cucuBaru('Cucu Kedaluwarsa Contoh')
    const u = await a.rpc(owner, 'create_invite', { p_person: orang }, 'aal2')
    await db.exec(`alter table private.invites disable trigger b_guard`)
    await db.query(`update private.invites set expires_at = now() - interval '1 second' where id = $1`, [u.invite_id])
    await db.exec(`alter table private.invites enable trigger b_guard`)
    expect((await kirim('undangan', { token: u.token })).isi).toEqual({ ok: false, alasan: 'kedaluwarsa' })
    const v = await a.rpc(owner, 'create_invite', { p_person: orang }, 'aal2')
    await a.rpc(owner, 'revoke_invite', { p_invite: v.invite_id }, 'aal2')
    expect((await kirim('undangan', { token: v.token })).isi).toEqual({ ok: false, alasan: 'dicabut' })
  })

  it('link terpotong atau asal-asalan → "tidak_dikenal" tanpa menyentuh database', async () => {
    for (const token of ['', 'abc', 'x'.repeat(42), 'x'.repeat(44), 'ä'.repeat(43)]) {
      expect((await kirim('undangan', { token })).isi).toEqual({ ok: false, alasan: 'tidak_dikenal' })
    }
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('pakai-undangan: gangguan server tidak menghabiskan link', () => {
  it.each(['createUser', 'generateLink'])('%s gagal → 500 "server", link belum terpakai, bisa dicoba lagi', async (metode) => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru(`Cucu Gangguan ${metode} Contoh`) }, 'aal2')
    auth.gangguan = metode
    const r = await kirim('undangan', { token: u.token })
    expect(r.status).toBe(500)
    expect(r.isi).toEqual({ ok: false, alasan: 'server' })
    expect(r.teks).not.toMatch(/Internal Server Error/)
    expect(catatan).toEqual([{ langkah: metode, kode: 500 }])
    expect((await h.satu(`select used_at from private.invites where id = $1`, [u.invite_id])).used_at).toBeNull()
    auth.gangguan = null
    const lagi = await kirim('undangan', { token: u.token })
    expect(lagi.isi.ok).toBe(true)
    await masuk(lagi.isi)
  })

  it('akun login sudah dibuat tetapi belum tertaut (terputus) → akun yang sama dipakai, tidak dobel', async () => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru('Cucu Terputus Contoh') }, 'aal2')
    // Seolah percobaan sebelumnya berhenti setelah createUser.
    await baris(db, 'insert into auth.users (email) values ($1)', [emailSintetis(u.member_id)])
    const akunSebelum = await jumlahAkun()
    const r = await kirim('undangan', { token: u.token })
    expect(r.isi.ok).toBe(true)
    expect(await jumlahAkun()).toBe(akunSebelum)
    await masuk(r.isi)
  })

  it('database gagal → 500 "server" tanpa pesan database', async () => {
    rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST002', message: 'Could not query the database for the schema cache' } }))
    const r = await kirim('undangan', { token: 'a'.repeat(43) })
    expect(r).toMatchObject({ status: 500, isi: { ok: false, alasan: 'server' } })
    expect(r.teks).not.toMatch(/schema cache/)
    expect(catatan).toEqual([{ langkah: 'edge_check_redemption', kode: 'PGRST002' }])
  })
})

describe('pakai-undangan: link baru untuk anggota yang sudah pernah masuk (HP hilang)', () => {
  it('memakai akun login yang sama; perangkat lama tetap sampai dicabut', async () => {
    const u = await a.rpc(owner, 'create_invite', { p_person: await cucuBaru('Cucu HP Hilang Contoh') }, 'aal2')
    const lama = await masuk((await kirim('undangan', { token: u.token })).isi)
    const akunSebelum = await jumlahAkun()
    const v = await a.rpc(owner, 'create_invite', { p_person: (await h.satu(`select person_id from public.members where id = $1`, [u.member_id])).person_id }, 'aal2')
    const baru = await masuk((await kirim('undangan', { token: v.token })).isi)
    expect(await jumlahAkun()).toBe(akunSebelum)
    expect(baru.sesi.userId).toBe(lama.sesi.userId)
    expect(baru.perangkat.device_id).not.toBe(lama.perangkat.device_id)
    // Admin mencabut perangkat lama: langsung tidak bisa membaca.
    await db.query(`update public.devices set revoked_at = now() where id = $1`, [lama.perangkat.device_id])
    expect(await a.siapa(lama.sesi)).toBeNull()
    expect(await a.siapa(baru.sesi)).toBe(u.member_id)
  })
})

describe('pakai-kode', () => {
  it('tambah perangkat: kode diketik huruf kecil dengan spasi tetap diterima', async () => {
    const k = await a.rpc(biasa, 'create_device_code', {})
    const r = await kirim('kode', { kode: ` ${k.code.toLowerCase().replace('-', ' ')} ` })
    expect(r.isi).toMatchObject({ ok: true, via: 'kode', nama: 'Anggota Biasa Contoh' })
    expect(r.teks).not.toContain(k.code.replace('-', ''))
    const { sesi, perangkat } = await masuk(r.isi)
    expect(sesi.userId).toBe(biasa.userId)
    expect(perangkat.via).toBe('kode')
    expect(await a.siapa(sesi)).toBe(biasa.memberId)
    // Kode sekali pakai.
    expect((await kirim('kode', { kode: k.code })).isi).toEqual({ ok: false, alasan: 'sudah_dipakai' })
  })

  it('bentuk kode salah → "format_salah" tanpa menyentuh database (dan tanpa dihitung)', async () => {
    for (const kode of ['', 'ABC', 'ABCD-EFG0', 'ABCD-EFGHI', 'ABCD-EFGI']) {
      expect((await kirim('kode', { kode })).isi).toEqual({ ok: false, alasan: 'format_salah' })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('kode salah berkali-kali dari satu alamat → "terlalu_sering", walaupun kemudian kodenya benar', async () => {
    await db.query(`delete from private.redeem_attempts`)
    const k = await a.rpc(biasa, 'create_device_code', {})
    const salah = ['AAAA-AAAA', 'BBBB-BBBB', 'CCCC-CCCC', 'DDDD-DDDD', 'EEEE-EEEE']
    for (const kode of salah) {
      expect((await kirim('kode', { kode }, { ip: '192.0.2.77' })).isi).toEqual({ ok: false, alasan: 'salah' })
    }
    expect((await kirim('kode', { kode: k.code }, { ip: '192.0.2.77' })).isi).toEqual({ ok: false, alasan: 'terlalu_sering' })
    // Dari alamat lain (misalnya HP yang benar) tetap bisa.
    expect((await kirim('kode', { kode: k.code }, { ip: '192.0.2.78' })).isi.ok).toBe(true)
  })

  it('akses sementara: perangkat berakhir sendiri dan tidak bisa menambah perangkat', async () => {
    const asistenOrang = await cucuBaru('Asisten Akses Contoh')
    const asisten = await a.anggota(asistenOrang, { role: 'asisten', permissions: ['akses_sementara'], nama: 'Asisten Contoh' })
    const k = await a.rpc(asisten, 'create_temp_access_code', { p_member: biasa.memberId, p_minutes: 30 })
    const r = await kirim('kode', { kode: k.code })
    expect(r.isi).toMatchObject({ ok: true, via: 'sementara', menit: 30 })
    const { sesi, perangkat } = await masuk(r.isi)
    expect(perangkat.expires_at).not.toBeNull()
    await ditolak(a.rpc(sesi, 'create_device_code', {}), 'AK014')
    await db.query(`update public.devices set expires_at = now() - interval '1 second' where id = $1`, [perangkat.device_id])
    expect(await a.siapa(sesi)).toBeNull()
  })
})
