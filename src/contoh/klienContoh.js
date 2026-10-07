// MODE CONTOH: server tiruan di memori untuk mengembangkan dan melihat
// layar tanpa database. Semua nama dan data FIKTIF. Hanya dimuat lewat
// src/main.jsx di build pengembangan (npm run dev:contoh); tes build
// memastikan berkas ini TIDAK ikut ke build produksi.
//
// Cara mencoba (alamat dibuka setelah "npm run dev:contoh"):
//   /#/u/<43 huruf A>   link undangan yang berhasil
//   /#/u/<43 huruf B>   link sudah dipakai        /#/u/<43 huruf C>  kedaluwarsa
//   /#/u/<43 huruf E>   link dicabut              /#/u/<43 huruf D>  gangguan server
//   kode ABCD2345       masuk sebagai perangkat tambahan
//   kode AKSES234       masuk dengan akses sementara 30 menit
import { BENTUK_KODE, BENTUK_TOKEN, rapikanKode } from '../../supabase/functions/_shared/rahasia.js'
import { bacaTersimpan, tulisTersimpan } from '../lib/penyimpanan.js'

export const PENANDA_KLIEN_CONTOH = 'KLIEN-CONTOH-FIKTIF'
const KUNCI = 'silsilah-contoh-keadaan'
const ABJAD = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const ok = (data) => ({ data, error: null })
const galat = (kode, pesan, status) => ({ data: null, error: { code: kode, message: pesan, status } })
const acak = (panjang) => Array.from({ length: panjang }, () => ABJAD[Math.floor(Math.random() * ABJAD.length)]).join('')
const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (idSesi) => `${b64({ alg: 'none' })}.${b64({ session_id: idSesi, sub: 'akun-contoh' })}.contoh`

const ANGGOTA = {
  id: 'anggota-contoh', auth_user_id: 'akun-contoh', display_name: 'Bu Contoh',
  role: 'anggota', is_owner: false, permissions: [],
}

const awal = (sekarang) => ({
  idSesi: null,
  tiket: {},
  kode: null,
  devices: [
    {
      id: 'perangkat-lain', member_id: ANGGOTA.id, session_id: 'sesi-laptop', label: 'Laptop Windows · Chrome',
      device_type: 'Laptop Windows', via: 'kode', expires_at: null, approx_city: null, approx_country: 'IT',
      approx_country_name: 'Italia', created_at: new Date(sekarang - 5 * 86400000).toISOString(),
      last_seen_at: new Date(sekarang - 3600000).toISOString(), revoked_at: null,
    },
  ],
  notifications: [],
})

// jeda: tundaan tiap panggilan (ms), supaya terasa seperti server sungguhan.
export function buatKlienContoh({ sekarang = Date.now, jeda = 150 } = {}) {
  let k
  try {
    k = JSON.parse(bacaTersimpan(KUNCI) ?? 'null') ?? awal(sekarang())
  } catch {
    k = awal(sekarang())
  }
  const simpan = () => tulisTersimpan(KUNCI, JSON.stringify(k))
  const pendengar = new Set()
  const beritahu = (p) => pendengar.forEach((f) => f(p, sesiSaatIni()))
  const sesiSaatIni = () => (k.idSesi ? { access_token: token(k.idSesi), user: { id: ANGGOTA.auth_user_id } } : null)
  const perangkatIni = () => k.devices.find((d) => d.session_id === k.idSesi)
  const tunggu = (data) => new Promise((r) => setTimeout(() => r(data), jeda))

  const tabel = (nama) => {
    const sumber = () => ({ members: [ANGGOTA], devices: k.devices, notifications: k.notifications })[nama] ?? []
    const saringan = []
    const b = {
      select: () => b,
      eq: (kol, nilai) => { saringan.push((r) => r[kol] === nilai); return b },
      is: (kol, nilai) => { saringan.push((r) => (r[kol] ?? null) === nilai); return b },
      order: () => b,
      limit: () => b,
      then: (selesai, gagal) =>
        tunggu(ok(structuredClone(sumber().filter((r) => saringan.every((f) => f(r)))))).then(selesai, gagal),
    }
    return b
  }

  const fungsi = {
    async 'cek-perangkat'() {
      if (!k.idSesi) return galat(undefined, 'Unauthorized', 401)
      const d = perangkatIni()
      if (!d) return ok({ ok: true, status: 'tidak_terdaftar', berakhir: null })
      if (d.revoked_at) return ok({ ok: true, status: 'dicabut', berakhir: null })
      if (d.expires_at && Date.parse(d.expires_at) <= sekarang()) return ok({ ok: true, status: 'kedaluwarsa', berakhir: null })
      return ok({ ok: true, status: 'ok', berakhir: d.expires_at })
    },
    async 'pakai-undangan'({ token: t }) {
      if (!BENTUK_TOKEN.test(t ?? '')) return ok({ ok: false, alasan: 'tidak_dikenal' })
      const alasan = { B: 'sudah_dipakai', C: 'kedaluwarsa', E: 'dicabut' }[t[0]]
      if (alasan) return ok({ ok: false, alasan })
      if (t[0] === 'D') return { data: null, error: Object.assign(new Error('x'), { name: 'FunctionsHttpError', context: { status: 500 } }) }
      if (t[0] !== 'A') return ok({ ok: false, alasan: 'tidak_dikenal' })
      const tiket = `tiket-${acak(8)}`
      k.tiket[tiket] = { via: 'undangan' }
      return ok({ ok: true, token_hash: 'contoh', tiket, nama: ANGGOTA.display_name, via: 'undangan', menit: null })
    },
    async 'pakai-kode'({ kode }) {
      const bersih = rapikanKode(kode)
      if (!BENTUK_KODE.test(bersih)) return ok({ ok: false, alasan: 'format_salah' })
      let via = null
      let menit = null
      if (bersih === 'ABCD2345') via = 'kode'
      else if (bersih === 'AKSES234') { via = 'sementara'; menit = 30 }
      else if (k.kode && k.kode.teks === bersih) {
        if (Date.parse(k.kode.berakhir) <= sekarang()) return ok({ ok: false, alasan: 'kedaluwarsa' })
        via = 'kode'
        k.kode = null
      }
      if (!via) return ok({ ok: false, alasan: 'salah' })
      const tiket = `tiket-${acak(8)}`
      k.tiket[tiket] = { via, menit }
      return ok({ ok: true, token_hash: 'contoh', tiket, nama: ANGGOTA.display_name, via, menit })
    },
  }

  const rpc = {
    async db_version() { return ok('999') },
    async claim_device({ p_ticket, p_timezone }) {
      const t = k.tiket[p_ticket]
      if (!t || !k.idSesi) return galat('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.')
      delete k.tiket[p_ticket]
      const d = {
        id: `perangkat-${acak(6)}`, member_id: ANGGOTA.id, session_id: k.idSesi,
        label: 'Perangkat contoh · Browser', device_type: 'Perangkat contoh', via: t.via,
        expires_at: t.menit ? new Date(sekarang() + t.menit * 60000).toISOString() : null,
        approx_city: 'Kota Contoh', approx_country: 'ID', approx_country_name: 'Indonesia',
        created_at: new Date(sekarang()).toISOString(), last_seen_at: new Date(sekarang()).toISOString(), revoked_at: null,
        timezone: p_timezone ?? null,
      }
      k.devices.push(d)
      return ok({ device_id: d.id, member_id: ANGGOTA.id, via: d.via, expires_at: d.expires_at })
    },
    async create_device_code() {
      const d = perangkatIni()
      if (d?.via === 'sementara') return galat('AK014', 'Perangkat dengan akses sementara tidak bisa menambah perangkat lain.')
      k.kode = { teks: acak(8), berakhir: new Date(sekarang() + 600000).toISOString() }
      return ok({ code_id: 'kode-contoh', code: `${k.kode.teks.slice(0, 4)}-${k.kode.teks.slice(4)}`, expires_at: k.kode.berakhir })
    },
    async revoke_device({ p_device }) {
      const d = k.devices.find((x) => x.id === p_device)
      if (!d || d.member_id !== ANGGOTA.id) return galat('AK024', 'Perangkat ini tidak ditemukan, atau bukan milik Anda.')
      d.revoked_at ??= new Date(sekarang()).toISOString()
      return ok(null)
    },
    async sign_out_devices({ p_all }) {
      const sekarangIso = new Date(sekarang()).toISOString()
      const sasaran = k.devices.filter((d) => !d.revoked_at && (p_all || d.session_id === k.idSesi))
      sasaran.forEach((d) => { d.revoked_at = sekarangIso })
      return ok(sasaran.length)
    },
    async report_not_me() {
      const d = perangkatIni()
      if (d) d.revoked_at = new Date(sekarang()).toISOString()
      return ok({ status: 'ok' })
    },
  }

  const klien = {
    [PENANDA_KLIEN_CONTOH]: true,
    auth: {
      async getSession() { return tunggu(ok({ session: sesiSaatIni() })) },
      async verifyOtp() {
        k.idSesi = `sesi-${acak(8)}`
        simpan()
        beritahu('SIGNED_IN')
        return ok({ session: sesiSaatIni() })
      },
      async signOut({ scope } = {}) {
        k.idSesi = null
        if (scope === 'global') k.devices.forEach((d) => { d.revoked_at ??= new Date(sekarang()).toISOString() })
        simpan()
        beritahu('SIGNED_OUT')
        return { error: null }
      },
      onAuthStateChange(f) {
        pendengar.add(f)
        return { data: { subscription: { unsubscribe: () => pendengar.delete(f) } } }
      },
    },
    functions: {
      async invoke(nama, { body } = {}) {
        const h = await tunggu(await fungsi[nama](body ?? {}))
        simpan()
        return h
      },
    },
    async rpc(nama, args) {
      const h = await tunggu(await (rpc[nama] ?? (async () => galat('PGRST202', 'tidak ada')))(args ?? {}))
      simpan()
      return h
    },
    from: tabel,
  }
  return klien
}
