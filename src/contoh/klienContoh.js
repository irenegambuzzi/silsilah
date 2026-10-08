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
//   kode PENGURUS       masuk sebagai asisten admin (kotak masuk berisi contoh
//                       pemberitahuan, dan menu "Beri akses sementara")
//   kode UTAMA234       masuk sebagai admin utama: layar admin terkunci sampai
//                       verifikasi dua langkah. Authenticator di sini TIRUAN:
//                       kode yang diterima hanya 123456.
//
// Silsilah contoh: keluarga fiktif dari src/lib/silsilah/keluargaFiktif.js
// (pohon keluarga asal "T1" hanya terlihat oleh admin utama).
// Mencoba offline: setelah masuk dan data termuat, matikan internet (atau
// DevTools → Network → Offline), lalu muat ulang halaman: aplikasi dibuka
// dari salinan di perangkat. Klien contoh menjawab seperti jaringan putus
// selama browser offline.
import { BENTUK_KODE, BENTUK_TOKEN, rapikanKode } from '../../supabase/functions/_shared/rahasia.js'
import { bangunKeluargaFiktif } from '../lib/silsilah/keluargaFiktif.js'
import { bacaTersimpan, tulisTersimpan } from '../lib/penyimpanan.js'

export const PENANDA_KLIEN_CONTOH = 'KLIEN-CONTOH-FIKTIF'
const KUNCI = 'silsilah-contoh-keadaan'
const ABJAD = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const ok = (data) => ({ data, error: null })
const galat = (kode, pesan, status) => ({ data: null, error: { code: kode, message: pesan, status } })
const acak = (panjang) => Array.from({ length: panjang }, () => ABJAD[Math.floor(Math.random() * ABJAD.length)]).join('')
const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (idSesi, akun) => `${b64({ alg: 'none' })}.${b64({ session_id: idSesi, sub: akun })}.contoh`

const ANGGOTA = {
  id: 'anggota-contoh', auth_user_id: 'akun-contoh', display_name: 'Bu Contoh',
  role: 'anggota', is_owner: false, permissions: [],
}
const PENGURUS = {
  id: 'anggota-pengurus', auth_user_id: 'akun-pengurus', display_name: 'Pak Pengurus Contoh',
  role: 'asisten', is_owner: false, permissions: ['akses_sementara'],
}
const PEMILIK = {
  id: 'anggota-pemilik', auth_user_id: 'akun-pemilik', display_name: 'Admin Utama Contoh',
  role: 'anggota', is_owner: true, permissions: [],
}
const SEMUA = [ANGGOTA, PENGURUS, PEMILIK]
// Authenticator tiruan: hanya kode ini yang diterima. Kuncinya bukan kunci sungguhan.
const KODE_DUA_LANGKAH_CONTOH = '123456'
const KUNCI_TOTP_CONTOH = 'CONTOHFIKTIFBUKANKUNCI23'

const contohPemberitahuan = (sekarang) => [
  { id: 1, kind: 'login_mencurigakan', title: 'Login mencurigakan: Pak Jauh Contoh', priority: 'penting',
    body: 'Pak Jauh Contoh baru masuk dari negara yang tidak biasa · Laptop Windows · sekitar Nigeria · 14.05, lewat link undangan. Kalau ini bukan Pak Jauh Contoh, tekan "Cabut perangkat ini".',
    link: '#/admin/perangkat?cabut=00000000-0000-4000-8000-000000000001', created_at: new Date(sekarang - 600000).toISOString(), read_at: null },
  { id: 2, kind: 'login_baru', title: 'Bu Contoh baru masuk', priority: 'biasa',
    body: 'iPhone · sekitar Kota Contoh, Indonesia · 13.40, lewat link undangan.',
    link: '#/admin/perangkat', created_at: new Date(sekarang - 3600000).toISOString(), read_at: null },
  { id: 3, kind: 'akses_sementara', title: 'Bu Contoh diberi akses sementara', priority: 'biasa',
    body: 'Asisten Contoh memberi Bu Contoh akses sementara selama 1 jam. Kodenya berlaku 10 menit.',
    link: null, created_at: new Date(sekarang - 86400000).toISOString(), read_at: new Date(sekarang - 80000000).toISOString() },
]

const awal = (sekarang) => ({
  idSesi: null,
  tiket: {},
  kode: null,
  kodeSementara: null,
  anggotaId: ANGGOTA.id,
  devices: [
    {
      id: '00000000-0000-4000-8000-000000000001', member_id: ANGGOTA.id, session_id: 'sesi-jauh', label: 'Laptop Windows · Edge',
      device_type: 'Laptop Windows', via: 'undangan', expires_at: null, approx_city: null, approx_country: 'NG',
      approx_country_name: 'Nigeria', created_at: new Date(sekarang - 600000).toISOString(),
      last_seen_at: new Date(sekarang - 600000).toISOString(), revoked_at: null,
    },
    {
      id: 'perangkat-lain', member_id: ANGGOTA.id, session_id: 'sesi-laptop', label: 'Laptop Windows · Chrome',
      device_type: 'Laptop Windows', via: 'kode', expires_at: null, approx_city: null, approx_country: 'IT',
      approx_country_name: 'Italia', created_at: new Date(sekarang - 5 * 86400000).toISOString(),
      last_seen_at: new Date(sekarang - 3600000).toISOString(), revoked_at: null,
    },
  ],
  notifications: contohPemberitahuan(sekarang),
  aal: 'aal1',
  faktor: [],
})

// Jawaban seperti saat jaringan putus (supabase-js tidak melempar, tetapi
// mengembalikan galat).
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const putus = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, count: null }
const putusFungsi = { data: null, error: Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }) }

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
  const saya = () => SEMUA.find((a) => a.id === k.anggotaId) ?? ANGGOTA
  const sesiSaatIni = () => (k.idSesi ? { access_token: token(k.idSesi, saya().auth_user_id), user: { id: saya().auth_user_id } } : null)
  const adminUtama = () => saya().is_owner && k.aal === 'aal2'
  const pengurus = () => saya().permissions.includes('akses_sementara') || adminUtama()
  const tiketBaru = (isi) => { const t = `tiket-${acak(8)}`; k.tiket[t] = isi; return t }
  const perangkatIni = () => k.devices.find((d) => d.session_id === k.idSesi)
  const tunggu = (data) => new Promise((r) => setTimeout(() => r(data), jeda))

  const silsilah = bangunKeluargaFiktif()
  // Seperti RLS: pohon keluarga asal hanya untuk admin utama.
  const bolehLihat = (r) => (r.tree_id ?? null) === null || saya().is_owner
  const tabel = (nama) => {
    // Pemberitahuan contoh hanya untuk pengurus (seperti admin sungguhan).
    const sumber = () => ({
      members: SEMUA,
      devices: k.devices,
      notifications: pengurus() || saya().is_owner ? k.notifications : [],
      settings: [{ temp_access_max_minutes: 1440, root_union_id: silsilah.root_union_id, generation_terms: null }],
      people: silsilah.people.filter(bolehLihat),
      unions: silsilah.unions.filter(bolehLihat),
      children: silsilah.children.filter(bolehLihat),
      birth_ranks: silsilah.birth_ranks.filter(bolehLihat),
      origin_trees: saya().is_owner ? silsilah.origin_trees : [],
    })[nama] ?? []
    const saringan = []
    let pembaruan = null
    let dari = 0
    let batas = Infinity
    let hitung = false
    const b = {
      select: (_kolom, o) => { hitung = o?.count === 'exact'; return b },
      update: (isi) => { pembaruan = isi; return b },
      eq: (kol, nilai) => { saringan.push((r) => r[kol] === nilai); return b },
      is: (kol, nilai) => { saringan.push((r) => (r[kol] ?? null) === nilai); return b },
      order: () => b,
      limit: (n) => { batas = n; return b },
      range: (a, z) => { dari = a; batas = z - a + 1; return b },
      then: (selesai, gagal) => {
        if (offline()) return tunggu(putus).then(selesai, gagal)
        const cocok = sumber().filter((r) => saringan.every((f) => f(r)))
        if (pembaruan) {
          cocok.forEach((r) => Object.assign(r, pembaruan))
          simpan()
          return tunggu(ok(null)).then(selesai, gagal)
        }
        const hasil = { ...ok(structuredClone(cocok.slice(dari, dari + batas))), count: hitung ? cocok.length : null }
        return tunggu(hasil).then(selesai, gagal)
      },
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
      const tiket = tiketBaru({ via: 'undangan', anggotaId: ANGGOTA.id })
      return ok({ ok: true, token_hash: 'contoh', tiket, nama: ANGGOTA.display_name, via: 'undangan', menit: null })
    },
    async 'pakai-kode'({ kode }) {
      const bersih = rapikanKode(kode)
      if (!BENTUK_KODE.test(bersih)) return ok({ ok: false, alasan: 'format_salah' })
      let via = null
      let menit = null
      let anggota = ANGGOTA
      if (bersih === 'ABCD2345') via = 'kode'
      else if (bersih === 'PENGURUS') { via = 'kode'; anggota = PENGURUS }
      else if (bersih === 'UTAMA234') { via = 'kode'; anggota = PEMILIK }
      else if (bersih === 'AKSES234') { via = 'sementara'; menit = 30 }
      else if (k.kodeSementara && k.kodeSementara.teks === bersih) {
        if (Date.parse(k.kodeSementara.berakhir) <= sekarang()) return ok({ ok: false, alasan: 'kedaluwarsa' })
        via = 'sementara'
        menit = k.kodeSementara.menit
        anggota = SEMUA.find((a) => a.id === k.kodeSementara.anggotaId) ?? ANGGOTA
        k.kodeSementara = null
      } else if (k.kode && k.kode.teks === bersih) {
        if (Date.parse(k.kode.berakhir) <= sekarang()) return ok({ ok: false, alasan: 'kedaluwarsa' })
        via = 'kode'
        k.kode = null
      }
      if (!via) return ok({ ok: false, alasan: 'salah' })
      const tiket = tiketBaru({ via, menit, anggotaId: anggota.id })
      return ok({ ok: true, token_hash: 'contoh', tiket, nama: anggota.display_name, via, menit })
    },
  }

  const rpc = {
    async db_version() { return ok('999') },
    async claim_device({ p_ticket, p_timezone }) {
      const t = k.tiket[p_ticket]
      if (!t || !k.idSesi) return galat('AK019', 'Pendaftaran perangkat ini tidak berlaku lagi. Mintalah link atau kode baru.')
      delete k.tiket[p_ticket]
      k.anggotaId = t.anggotaId
      const d = {
        id: `perangkat-${acak(6)}`, member_id: t.anggotaId, session_id: k.idSesi,
        label: 'Perangkat contoh · Browser', device_type: 'Perangkat contoh', via: t.via,
        expires_at: t.menit ? new Date(sekarang() + t.menit * 60000).toISOString() : null,
        approx_city: 'Kota Contoh', approx_country: 'ID', approx_country_name: 'Indonesia',
        created_at: new Date(sekarang()).toISOString(), last_seen_at: new Date(sekarang()).toISOString(), revoked_at: null,
        timezone: p_timezone ?? null,
      }
      k.devices.push(d)
      return ok({ device_id: d.id, member_id: d.member_id, via: d.via, expires_at: d.expires_at })
    },
    async create_device_code() {
      const d = perangkatIni()
      if (d?.via === 'sementara') return galat('AK014', 'Perangkat dengan akses sementara tidak bisa menambah perangkat lain.')
      k.kode = { teks: acak(8), berakhir: new Date(sekarang() + 600000).toISOString() }
      return ok({ code_id: 'kode-contoh', code: `${k.kode.teks.slice(0, 4)}-${k.kode.teks.slice(4)}`, expires_at: k.kode.berakhir })
    },
    async revoke_device({ p_device }) {
      const d = k.devices.find((x) => x.id === p_device)
      if (!d || (d.member_id !== saya().id && !pengurus())) return galat('AK024', 'Perangkat ini tidak ditemukan, atau bukan milik Anda.')
      d.revoked_at ??= new Date(sekarang()).toISOString()
      return ok(null)
    },
    async sign_out_devices({ p_all }) {
      const sekarangIso = new Date(sekarang()).toISOString()
      const sasaran = k.devices.filter((d) => !d.revoked_at && (p_all || d.session_id === k.idSesi))
      sasaran.forEach((d) => { d.revoked_at = sekarangIso })
      return ok(sasaran.length)
    },
    async member_names() {
      return ok(SEMUA.map((a) => ({ id: a.id, display_name: a.display_name, person_id: `orang-${a.id}` })))
    },
    async create_temp_access_code({ p_member, p_minutes }) {
      if (!pengurus()) return galat('AK016', 'Anda tidak punya izin memberi akses sementara.')
      if (p_minutes < 30) return galat('AK022', 'Durasi akses sementara minimal 30 menit.')
      if (p_minutes > 1440) return galat('AK009', 'Durasi akses sementara melebihi batas yang diatur admin.')
      if ((p_member === PENGURUS.id || p_member === PEMILIK.id) && !adminUtama()) return galat('AK017', 'Link dan kode untuk admin utama atau asisten hanya bisa dibuat oleh admin utama.')
      const teks = acak(8)
      k.kodeSementara = { teks, anggotaId: p_member, menit: p_minutes, berakhir: new Date(sekarang() + 600000).toISOString() }
      return ok({ code_id: 'kode-sementara', code: `${teks.slice(0, 4)}-${teks.slice(4)}`, expires_at: k.kodeSementara.berakhir, access_minutes: p_minutes })
    },
    async list_temp_access() {
      if (!pengurus()) return galat('AK016', 'Anda tidak punya izin memberi akses sementara.')
      const nama = (id) => SEMUA.find((a) => a.id === id)?.display_name ?? ''
      const aktif = k.devices
        .filter((d) => d.via === 'sementara' && !d.revoked_at && Date.parse(d.expires_at) > sekarang())
        .map((d) => ({ kind: 'aktif', id: d.id, member_id: d.member_id, display_name: nama(d.member_id), label: d.label, approx_city: d.approx_city, approx_country: d.approx_country, approx_country_name: d.approx_country_name, created_at: d.created_at, expires_at: d.expires_at, access_minutes: null }))
      const menunggu = k.kodeSementara && Date.parse(k.kodeSementara.berakhir) > sekarang()
        ? [{ kind: 'menunggu', id: 'kode-sementara', member_id: k.kodeSementara.anggotaId, display_name: nama(k.kodeSementara.anggotaId), label: null, created_at: new Date(sekarang()).toISOString(), expires_at: k.kodeSementara.berakhir, access_minutes: k.kodeSementara.menit }]
        : []
      return ok([...menunggu, ...aktif])
    },
    async revoke_temp_access({ p_device }) {
      if (!pengurus()) return galat('AK016', 'Anda tidak punya izin memberi akses sementara.')
      const d = k.devices.find((x) => x.id === p_device)
      if (!d || d.via !== 'sementara' || d.revoked_at) return galat('AK026', 'Akses sementara ini sudah berakhir atau tidak ditemukan.')
      d.revoked_at = new Date(sekarang()).toISOString()
      return ok(null)
    },
    async record_second_factor() {
      if (!saya().is_owner) return galat('AK002', 'Hanya admin utama yang boleh melakukan ini.')
      return ok({ aal: k.aal, perubahan: 0 })
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
        k.aal = 'aal1'
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
      // Verifikasi dua langkah tiruan (kode yang diterima: 123456).
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          const ada = (k.faktor ?? []).some((f) => f.status === 'verified')
          return tunggu(ok({ currentLevel: k.aal ?? 'aal1', nextLevel: ada ? 'aal2' : (k.aal ?? 'aal1'), currentAuthenticationMethods: [] }))
        },
        async listFactors() {
          const all = structuredClone(k.faktor ?? [])
          return tunggu(ok({ all, totp: all.filter((f) => f.status === 'verified'), phone: [], webauthn: [] }))
        },
        async enroll({ friendlyName, issuer }) {
          const id = `faktor-${acak(6)}`
          k.faktor = [...(k.faktor ?? []), { id, friendly_name: friendlyName, factor_type: 'totp', status: 'unverified', created_at: new Date(sekarang()).toISOString() }]
          simpan()
          const label = encodeURIComponent(`${issuer}:${saya().display_name}`)
          return tunggu(ok({ id, type: 'totp', friendly_name: friendlyName, totp: { secret: KUNCI_TOTP_CONTOH, uri: `otpauth://totp/${label}?secret=${KUNCI_TOTP_CONTOH}&issuer=${encodeURIComponent(issuer)}` } }))
        },
        async challengeAndVerify({ factorId, code }) {
          const f = (k.faktor ?? []).find((x) => x.id === factorId)
          if (!f) return tunggu(galat('mfa_factor_not_found', 'Factor not found', 404))
          if (code !== KODE_DUA_LANGKAH_CONTOH) return tunggu(galat('mfa_verification_failed', 'Invalid TOTP code entered', 422))
          f.status = 'verified'
          k.aal = 'aal2'
          simpan()
          return tunggu(ok({}))
        },
        async unenroll({ factorId }) {
          const f = (k.faktor ?? []).find((x) => x.id === factorId)
          if (!f) return tunggu(galat('mfa_factor_not_found', 'Factor not found', 404))
          if (f.status === 'verified' && k.aal !== 'aal2') return tunggu(galat('insufficient_aal', 'AAL2 required', 403))
          k.faktor = k.faktor.filter((x) => x.id !== factorId)
          simpan()
          return tunggu(ok({ id: factorId }))
        },
      },
      onAuthStateChange(f) {
        pendengar.add(f)
        return { data: { subscription: { unsubscribe: () => pendengar.delete(f) } } }
      },
    },
    functions: {
      async invoke(nama, { body } = {}) {
        if (offline()) return tunggu(putusFungsi)
        const h = await tunggu(await fungsi[nama](body ?? {}))
        simpan()
        return h
      },
    },
    async rpc(nama, args) {
      if (offline()) return tunggu(putus)
      const h = await tunggu(await (rpc[nama] ?? (async () => galat('PGRST202', 'tidak ada')))(args ?? {}))
      simpan()
      return h
    },
    from: tabel,
    // Realtime tiruan: tersambung, tetapi data contoh tidak pernah berubah sendiri.
    channel(nama) {
      const s = { nama }
      s.on = () => s
      s.subscribe = (fn) => { setTimeout(() => fn?.('SUBSCRIBED'), jeda); return s }
      return s
    },
    async removeChannel() { return 'ok' },
  }
  return klien
}
