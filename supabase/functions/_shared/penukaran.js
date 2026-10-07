// Logika Edge Function pakai-undangan dan pakai-kode, tanpa apa pun yang
// khusus Deno, supaya bisa dites di Node bersama database tes.
//
// Urutan (PLAN.md bagian 6.1):
//   1. edge_check_redemption: link/kode masih berlaku? Tidak mengubah apa pun.
//   2. Siapkan akun login: pakai yang sudah tertaut, atau buat akun baru
//      (email sintetis, tidak ada email terkirim) lalu tautkan.
//   3. Buat tautan masuk sekali pakai (magic link) → token_hash.
//   4. edge_complete_redemption: tandai link/kode SUDAH DIPAKAI (terkunci,
//      jadi hanya satu yang berhasil) dan dapatkan tiket klaim perangkat.
// Kalau langkah 2–3 gagal (gangguan server), link/kode BELUM terpakai dan
// bisa dicoba lagi. token_hash hanya dikembalikan kalau langkah 4 berhasil.
//
// `layanan`: { rpc(nama, args) → { data, error }, auth } dengan `auth`
// berbentuk supabase.auth.admin (getUserById, createUser, generateLink).

import { BENTUK_KODE, BENTUK_TOKEN, rapikanKode, sha256Hex } from './rahasia.js'
import { kenaliPerangkat } from './perangkat.js'

// Semua alasan penolakan yang bisa dikembalikan ke aplikasi. Setiap alasan
// punya pesan di src/teks/id.js (teks.masuk), kecuali 'server'.
export const ALASAN = {
  undangan: ['tidak_dikenal', 'sudah_dipakai', 'kedaluwarsa', 'dicabut', 'terlalu_sering', 'server'],
  kode: ['format_salah', 'salah', 'sudah_dipakai', 'kedaluwarsa', 'dicabut', 'dimatikan', 'terlalu_sering', 'server'],
}

export const DOMAIN_EMAIL_BAWAAN = 'silsilah.invalid'
export const emailSintetis = (memberId, domain = DOMAIN_EMAIL_BAWAAN) => `anggota-${memberId}@${domain}`

// Galat dari layanan (database atau Auth). Hanya kodenya yang disimpan;
// pesan server, token, dan kode tidak pernah ikut.
export class GalatLayanan extends Error {
  constructor(langkah, galat) {
    super(langkah)
    this.name = 'GalatLayanan'
    this.kode = galat?.code ?? galat?.status ?? null
  }
}

async function panggil(layanan, nama, args) {
  const { data, error } = await layanan.rpc(nama, args)
  if (error || data == null) throw new GalatLayanan(nama, error)
  return data
}

const tolak = (alasan) => ({ ok: false, alasan })

async function siapkanAkun(cek, konteks, layanan) {
  const { auth } = layanan
  let userId = cek.user_id ?? null
  let email
  if (userId) {
    const { data, error } = await auth.getUserById(userId)
    if (error || !data?.user?.email) throw new GalatLayanan('getUserById', error)
    email = data.user.email
  } else {
    email = emailSintetis(cek.member_id, konteks.domainEmail || DOMAIN_EMAIL_BAWAAN)
    const { data, error } = await auth.createUser({
      email,
      email_confirm: true,
      app_metadata: { member_id: cek.member_id },
    })
    // Akun sudah ada (percobaan sebelumnya terputus sebelum ditautkan):
    // idnya diambil dari hasil generateLink di bawah.
    if (error && !['email_exists', 'user_already_exists'].includes(error.code)) {
      throw new GalatLayanan('createUser', error)
    }
    userId = data?.user?.id ?? null
  }

  const { data: tautan, error } = await auth.generateLink({ type: 'magiclink', email })
  const tokenHash = tautan?.properties?.hashed_token
  if (error || !tokenHash) throw new GalatLayanan('generateLink', error)

  if (!cek.user_id) {
    userId ??= tautan.user?.id ?? null
    const r = await panggil(layanan, 'edge_attach_auth_user', { p_member: cek.member_id, p_user: userId })
    if (r.status !== 'ok') throw new GalatLayanan('edge_attach_auth_user', { code: r.status })
  }
  return tokenHash
}

// jenis: 'undangan' | 'kode'. rahasia: token dari link, atau kode ketikan.
// konteks: { ip, userAgent, domainEmail, lokasi? } (lokasi: langkah 1.16).
// Hasil: { ok: true, token_hash, tiket, nama, via, menit } atau
//        { ok: false, alasan }. Gangguan layanan → melempar GalatLayanan.
export async function tukar(jenis, rahasia, konteks, layanan) {
  if (jenis !== 'undangan' && jenis !== 'kode') throw new Error('jenis tidak dikenal')
  const bersih = jenis === 'kode' ? rapikanKode(rahasia) : String(rahasia ?? '')
  if (!(jenis === 'kode' ? BENTUK_KODE : BENTUK_TOKEN).test(bersih)) {
    return tolak(jenis === 'kode' ? 'format_salah' : 'tidak_dikenal')
  }

  const args = { p_kind: jenis, p_hash: await sha256Hex(bersih), p_ip: konteks.ip ?? null }
  const cek = await panggil(layanan, 'edge_check_redemption', args)
  if (cek.status !== 'ok') return tolak(cek.status)

  const tokenHash = await siapkanAkun(cek, konteks, layanan)

  const info = { ...kenaliPerangkat(konteks.userAgent), ...(konteks.lokasi ?? {}) }
  const hasil = await panggil(layanan, 'edge_complete_redemption', { ...args, p_info: info })
  if (hasil.status !== 'ok') return tolak(hasil.status)

  return {
    ok: true,
    token_hash: tokenHash,
    tiket: hasil.ticket,
    nama: hasil.display_name,
    via: hasil.via,
    menit: hasil.access_minutes ?? null,
  }
}
