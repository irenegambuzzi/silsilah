// Klien Supabase tiruan untuk tes layar. Hanya meniru bagian yang dipakai
// aplikasi: auth (sesi, verifyOtp, signOut), functions.invoke, rpc, dan
// from(tabel).select/update dengan filter sederhana. Semua panggilan dicatat
// di `panggilan` supaya tes bisa memeriksa APA yang dikirim ke server.
// Semua data di sini FIKTIF.
import { vi } from 'vitest'

// Token mirip JWT berisi session_id (tanpa tanda tangan; hanya untuk tes).
export const tokenTiruan = (sessionId) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'none' })}.${b64({ session_id: sessionId, sub: 'akun-contoh' })}.tanda`
}

export const OK = (data) => ({ data, error: null })
export const GALAT = (kode, pesan = 'galat', status) => ({ data: null, error: { code: kode, message: pesan, status } })

// opsi:
//   sesi        sesi awal (null = belum masuk), mis. { access_token }
//   fungsi      { 'cek-perangkat': async (body) => ({ data, error }) , … }
//   rpc         { claim_device: async (args) => ({ data, error }), … }
//   tabel       { members: [...], devices: [...], notifications: [...] }
//   verifyOtp   async ({ token_hash, type }) => ({ data, error }); bawaan: membuat sesi
//   mfa         verifikasi dua langkah: { level: 'aal1' | 'aal2', faktor: [{ id, friendly_name,
//               status }], kodeBenar: '123456', gagal: { namaMetode: galat } }
export function buatKlienTiruan(opsi = {}) {
  const panggilan = []
  const catat = (jenis, nama, isi) => panggilan.push({ jenis, nama, isi })
  const keadaan = {
    sesi: opsi.sesi ?? null,
    pendengar: new Set(),
    mfa: {
      level: opsi.mfa?.level ?? 'aal1',
      faktor: structuredClone(opsi.mfa?.faktor ?? []).map((f) => ({ factor_type: 'totp', status: 'verified', created_at: '2026-10-07T07:00:00Z', ...f })),
      kodeBenar: opsi.mfa?.kodeBenar ?? '123456',
      gagal: opsi.mfa?.gagal ?? {},
    },
  }
  const tabel = structuredClone(opsi.tabel ?? {})

  const beritahu = (peristiwa) => keadaan.pendengar.forEach((f) => f(peristiwa, keadaan.sesi))

  const dariTabel = (nama) => {
    const saringan = []
    let pembaruan = null
    let batas = Infinity
    const pembangun = {
      select: () => pembangun,
      update: (isi) => { pembaruan = isi; return pembangun },
      eq: (kolom, nilai) => { saringan.push((b) => b[kolom] === nilai); return pembangun },
      is: (kolom, nilai) => { saringan.push((b) => (b[kolom] ?? null) === nilai); return pembangun },
      order: () => pembangun,
      limit: (n) => { batas = n; return pembangun },
      then: (selesai, gagal) => {
        catat('tabel', nama, { pembaruan, saringan: saringan.length })
        const sumber = tabel[nama] ?? []
        if (pembaruan) {
          sumber.filter((b) => saringan.every((f) => f(b))).forEach((b) => Object.assign(b, pembaruan))
          return Promise.resolve(OK(null)).then(selesai, gagal)
        }
        const baris = sumber.filter((b) => saringan.every((f) => f(b))).slice(0, batas)
        return Promise.resolve(OK(structuredClone(baris))).then(selesai, gagal)
      },
    }
    return pembangun
  }

  const klien = {
    panggilan,
    keadaan,
    tabel,
    auth: {
      getSession: vi.fn(async () => OK({ session: keadaan.sesi })),
      verifyOtp: vi.fn(async (args) => {
        catat('auth', 'verifyOtp', args)
        if (opsi.verifyOtp) {
          const h = await opsi.verifyOtp(args)
          if (!h.error) { keadaan.sesi = h.data?.session ?? null; beritahu('SIGNED_IN') }
          return h
        }
        keadaan.sesi = { access_token: tokenTiruan('sesi-baru'), user: { id: 'akun-contoh' } }
        beritahu('SIGNED_IN')
        return OK({ session: keadaan.sesi })
      }),
      signOut: vi.fn(async (args) => {
        catat('auth', 'signOut', args)
        keadaan.sesi = null
        beritahu('SIGNED_OUT')
        return { error: null }
      }),
      // Verifikasi dua langkah (TOTP), seperti supabase.auth.mfa.
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => {
          if (keadaan.mfa.gagal.getAuthenticatorAssuranceLevel) return { data: null, error: keadaan.mfa.gagal.getAuthenticatorAssuranceLevel }
          const ada = keadaan.mfa.faktor.some((f) => f.status === 'verified')
          return OK({ currentLevel: keadaan.mfa.level, nextLevel: ada ? 'aal2' : keadaan.mfa.level, currentAuthenticationMethods: [] })
        }),
        listFactors: vi.fn(async () => {
          const all = structuredClone(keadaan.mfa.faktor)
          return OK({ all, totp: all.filter((f) => f.status === 'verified'), phone: [], webauthn: [] })
        }),
        enroll: vi.fn(async (args) => {
          catat('mfa', 'enroll', args)
          if (keadaan.mfa.gagal.enroll) return { data: null, error: keadaan.mfa.gagal.enroll }
          const id = `faktor-${keadaan.mfa.faktor.length + 1}`
          keadaan.mfa.faktor.push({ id, friendly_name: args.friendlyName, factor_type: 'totp', status: 'unverified', created_at: '2026-10-07T07:00:00Z' })
          return OK({
            id, type: 'totp', friendly_name: args.friendlyName,
            totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'KUNCITIRUANRAHASIA234567', uri: `otpauth://totp/${args.issuer}?secret=KUNCITIRUANRAHASIA234567` },
          })
        }),
        challengeAndVerify: vi.fn(async (args) => {
          catat('mfa', 'challengeAndVerify', args)
          const f = keadaan.mfa.faktor.find((x) => x.id === args.factorId)
          if (!f) return GALAT('mfa_factor_not_found', 'Factor not found', 404)
          if (args.code !== keadaan.mfa.kodeBenar) return GALAT('mfa_verification_failed', 'Invalid TOTP code entered', 422)
          f.status = 'verified'
          keadaan.mfa.level = 'aal2'
          beritahu('MFA_CHALLENGE_VERIFIED')
          return OK({ access_token: 'token-aal2' })
        }),
        unenroll: vi.fn(async (args) => {
          catat('mfa', 'unenroll', args)
          const f = keadaan.mfa.faktor.find((x) => x.id === args.factorId)
          if (!f) return GALAT('mfa_factor_not_found', 'Factor not found', 404)
          if (f.status === 'verified' && keadaan.mfa.level !== 'aal2') return GALAT('insufficient_aal', 'AAL2 required', 403)
          keadaan.mfa.faktor = keadaan.mfa.faktor.filter((x) => x.id !== args.factorId)
          return OK({ id: args.factorId })
        }),
      },
      onAuthStateChange: vi.fn((f) => {
        keadaan.pendengar.add(f)
        return { data: { subscription: { unsubscribe: () => keadaan.pendengar.delete(f) } } }
      }),
    },
    functions: {
      invoke: vi.fn(async (nama, { body } = {}) => {
        catat('fungsi', nama, body)
        const f = opsi.fungsi?.[nama]
        if (!f) throw new Error(`fungsi tiruan belum diatur: ${nama}`)
        return f(body)
      }),
    },
    rpc: vi.fn(async (nama, args) => {
      catat('rpc', nama, args)
      const f = opsi.rpc?.[nama]
      if (!f) throw new Error(`rpc tiruan belum diatur: ${nama}`)
      return f(args)
    }),
    from: vi.fn((nama) => dariTabel(nama)),
  }
  klien.panggilanKe = (jenis, nama) => panggilan.filter((p) => p.jenis === jenis && p.nama === nama)
  return klien
}

// Keadaan awal "sudah masuk dan perangkat sah" untuk tes yang bukan tentang masuk.
export const anggotaContoh = {
  id: 'anggota-1', auth_user_id: 'akun-contoh', display_name: 'Bu Contoh', role: 'anggota', is_owner: false, permissions: [],
}

export function klienSudahMasuk(tambahan = {}) {
  return buatKlienTiruan({
    sesi: { access_token: tokenTiruan('sesi-ini'), user: { id: 'akun-contoh' } },
    fungsi: { 'cek-perangkat': async () => OK({ ok: true, status: 'ok', berakhir: null }) },
    rpc: { db_version: async () => OK('999'), record_second_factor: async () => OK({ aal: 'aal2', perubahan: 0 }) },
    ...tambahan,
    tabel: { members: [anggotaContoh], devices: [], notifications: [], ...(tambahan.tabel ?? {}) },
  })
}
