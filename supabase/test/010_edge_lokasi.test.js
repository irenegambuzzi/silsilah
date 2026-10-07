// Tes ujung ke ujung perkiraan lokasi login dan cek-perangkat: kode Edge
// Function yang SAMA dengan yang di-deploy, file data lokasi yang dibuat
// skrip pembuat dari CSV contoh (kota FIKTIF, alamat dokumentasi), database
// tes, dan tiruan Auth. Sekaligus membuktikan: tidak ada permintaan jaringan.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import zlib from 'node:zlib'
import { baris, buatDatabaseLengkap } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'
import { pembantuAkses } from './pembantu-akses.js'
import { buatTiruanAuth, rpcLayanan } from './tiruan-auth.js'
import { buatPenangan, buatPenanganCekPerangkat } from '../functions/_shared/http.js'
import { buatPencariLokasi } from '../functions/_shared/sumber-lokasi.js'
import { bangunData, bacaBaris } from '../../scripts/lokasi-ip/buat-data.mjs'

let db, h, a, ua, owner, dataGz, layanan, unduh, fetchSpy
const tahunIni = new Date().getUTCFullYear()
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
let nomor = 0

const orangBaru = async (nama = `Cucu Lokasi ${++nomor} Contoh`) => {
  const id = await h.orang(nama, { birth_y: tahunIni - 30 })
  await h.anak(ua, id)
  return id
}

function buatLayanan() {
  const auth = buatTiruanAuth(db)
  unduh = vi.fn(async () => dataGz)
  return {
    rpc: rpcLayanan(db),
    auth,
    cariLokasi: buatPencariLokasi(unduh),
    // Tiruan supabase.auth.getClaims(): token "sah-<sesi>-<akun>".
    verifikasiToken: async (token) => {
      const m = /^sah-([0-9a-f-]{36})-([0-9a-f-]{36})$/.exec(token)
      return m ? { sessionId: m[1], userId: m[2] } : null
    },
  }
}

const permintaan = (url, { ip, headers = {}, body } = {}) => new Request(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'user-agent': UA_IPHONE, ...headers },
  body,
})

// Masuk lewat Edge Function pakai-undangan dari alamat IP tertentu, lalu klaim perangkat.
async function masuk(person, ip) {
  const u = await a.rpc(owner, 'create_invite', { p_person: person, p_adult_confirmed: true }, 'aal2')
  const res = await buatPenangan('undangan', () => layanan)(
    permintaan('https://contoh.invalid/functions/v1/pakai-undangan', { ip, body: JSON.stringify({ token: u.token }) }))
  const isi = await res.json()
  expect(isi.ok).toBe(true)
  const sesi = await layanan.auth.verifyOtp(isi.token_hash)
  const d = await a.rpc(sesi, 'claim_device', { p_ticket: isi.tiket, p_timezone: 'Asia/Jakarta' })
  return { ...sesi, memberId: u.member_id, deviceId: d.device_id }
}

const cekPerangkat = async (akun, ip = '192.0.2.200') => {
  const res = await buatPenanganCekPerangkat(() => layanan)(permintaan('https://contoh.invalid/functions/v1/cek-perangkat', {
    ip, headers: akun ? { authorization: `Bearer sah-${akun.sessionId}-${akun.userId}` } : {},
  }))
  return { status: res.status, isi: await res.json() }
}

beforeAll(async () => {
  const { data } = await bangunData(bacaBaris(path.join(import.meta.dirname, '../../scripts/lokasi-ip/contoh-dbip.txt')))
  dataGz = new Uint8Array(zlib.gzipSync(data))
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
}, 60000)

beforeEach(() => {
  layanan = buatLayanan()
  // Permintaan jaringan apa pun di tes ini = gagal.
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { throw new Error('jaringan dilarang di tes ini') })
})
afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

describe('perkiraan lokasi saat masuk', () => {
  it('IP Indonesia → kota; tercatat di perangkat dan log; admin melihat "sekitar …"', async () => {
    const p = await a.penandaNotifikasi()
    const x = await masuk(await orangBaru('Bu Lokasi Contoh'), '192.0.2.5')
    expect(await h.satu(`select approx_city, approx_country, device_type from public.devices where id = $1`, [x.deviceId]))
      .toEqual({ approx_city: 'Kota Contoh A', approx_country: 'ID', device_type: 'iPhone' })
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n.title).toBe('Bu Lokasi Contoh baru masuk')
    expect(n.body).toMatch(/^iPhone · sekitar Kota Contoh A, Indonesia · \d\d\.\d\d, lewat link undangan\.$/)
    const ev = await h.satu(`select e.approx_city, host(i.ip) as ip from private.auth_events e join private.login_ips i on i.event_id = e.id
      where e.member_id = $1 and e.event = 'undangan_dipakai'`, [x.memberId])
    expect(ev).toEqual({ approx_city: 'Kota Contoh A', ip: '192.0.2.5' })
    expect(unduh).toHaveBeenCalledTimes(1)
  })

  it('IPv6 Italia → kota; IPv4 dalam IPv6 dikenali', async () => {
    const x = await masuk(await orangBaru(), '2001:db8:1:2::1')
    const y = await masuk(await orangBaru(), '::ffff:198.51.100.7')
    const r = await baris(db, `select approx_city, approx_country from public.devices where id in ($1, $2) order by approx_city`, [x.deviceId, y.deviceId])
    expect(r).toEqual([{ approx_city: 'Kota Contoh C', approx_country: 'IT' }, { approx_city: 'Kota Contoh H', approx_country: 'IT' }])
  })

  it('IP negara lain → negara saja; di luar daftar negara biasa → login mencurigakan', async () => {
    const p = await a.penandaNotifikasi()
    const x = await masuk(await orangBaru('Pak Luar Contoh'), '203.0.113.9')
    expect(await h.satu(`select approx_city, approx_country from public.devices where id = $1`, [x.deviceId]))
      .toEqual({ approx_city: null, approx_country: 'NG' })
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n).toMatchObject({ kind: 'login_mencurigakan', priority: 'penting', title: 'Login mencurigakan: Pak Luar Contoh' })
    expect(n.body).toContain('· sekitar Nigeria ·')
  })

  it('data lokasi belum tersedia → login tetap berhasil, "lokasi tidak diketahui"', async () => {
    layanan.cariLokasi = buatPencariLokasi(async () => { throw new Error('belum diunggah') })
    const p = await a.penandaNotifikasi()
    await masuk(await orangBaru(), '192.0.2.5')
    const [n] = await a.notifikasiAdminSejak(p)
    expect(n.body).toContain('lokasi tidak diketahui')
  })
})

describe('cek-perangkat', () => {
  it('perangkat sah → ok; pembukaan biasa tidak memuat data lokasi sama sekali', async () => {
    const x = await masuk(await orangBaru(), '192.0.2.5')
    layanan = buatLayanan()
    expect(await cekPerangkat(x)).toEqual({ status: 200, isi: { ok: true, status: 'ok', berakhir: null } })
    expect(unduh).not.toHaveBeenCalled()
  })

  it('tanpa token, atau token tidak sah → 401 "sesi_habis"', async () => {
    expect(await cekPerangkat(null)).toEqual({ status: 401, isi: { ok: false, alasan: 'sesi_habis' } })
    const res = await buatPenanganCekPerangkat(() => layanan)(permintaan('https://contoh.invalid/x', { ip: '192.0.2.1', headers: { authorization: 'Bearer palsu' } }))
    expect(res.status).toBe(401)
  })

  it('perangkat yang sudah dicabut dibuka lagi → "dicabut", admin langsung diberi tahu dengan perkiraan lokasi', async () => {
    const x = await masuk(await orangBaru('Pak Dicabut Contoh'), '192.0.2.5')
    await a.rpc(owner, 'revoke_device', { p_device: x.deviceId }, 'aal2')
    const p = await a.penandaNotifikasi()
    expect((await cekPerangkat(x, '192.0.2.200')).isi).toEqual({ ok: true, status: 'dicabut', berakhir: null })
    const n = await a.notifikasiAdminSejak(p)
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ kind: 'login_mencurigakan', priority: 'penting', title: 'Perangkat yang sudah dicabut dibuka lagi: Pak Dicabut Contoh' })
    expect(n[0].body).toContain('· sekitar Kota "Contoh", B, Indonesia ·')
    // Dibuka berkali-kali: tidak membanjiri admin.
    await cekPerangkat(x)
    await cekPerangkat(x)
    expect(await a.notifikasiAdminSejak(p)).toHaveLength(1)
  })
})
