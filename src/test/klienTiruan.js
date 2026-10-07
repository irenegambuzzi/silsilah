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
export function buatKlienTiruan(opsi = {}) {
  const panggilan = []
  const catat = (jenis, nama, isi) => panggilan.push({ jenis, nama, isi })
  const keadaan = { sesi: opsi.sesi ?? null, pendengar: new Set() }
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
    rpc: { db_version: async () => OK('999') },
    ...tambahan,
    tabel: { members: [anggotaContoh], devices: [], notifications: [], ...(tambahan.tabel ?? {}) },
  })
}
