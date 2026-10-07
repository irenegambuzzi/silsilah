// Semua panggilan aplikasi ke server untuk masuk, perangkat, dan kotak
// masuk. `klien` diberikan pemanggil (supaya mudah dites). Galat dilempar
// apa adanya; layar mengubahnya jadi pesan Indonesia dengan petakanGalat().
// Token, kode, dan tiket hanya lewat di sini: tidak pernah disimpan atau dicatat.
import { rapikanKode } from './kode.js'

async function rpc(klien, nama, args) {
  const { data, error } = await klien.rpc(nama, args)
  if (error) throw error
  return data
}

async function fungsi(klien, nama, body = {}) {
  const { data, error } = await klien.functions.invoke(nama, { body })
  if (error) throw error
  return data
}

export const zonaWaktu = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

// Tautan masuk dari Edge Function dicoba dengan tipe "magiclink", lalu
// "email" (dokumentasi Supabase menyebut keduanya; kepastiannya diuji di
// cloud pada langkah 1.29).
export async function verifikasiTautanMasuk(klien, tokenHash) {
  let hasil = await klien.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (hasil.error || !hasil.data?.session) {
    hasil = await klien.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  }
  if (hasil.error) throw hasil.error
  if (!hasil.data?.session) throw new Error('sesi tidak terbentuk')
}

// Menukar link undangan (jenis 'undangan') atau kode (jenis 'kode') menjadi
// sesi login yang sudah terdaftar sebagai perangkat.
// Hasil: { ok: true, nama, via, berakhir } atau { ok: false, alasan }.
// Gangguan server/jaringan → melempar galat.
export async function jalankanMasuk(klien, jenis, rahasia) {
  const hasil = jenis === 'undangan'
    ? await fungsi(klien, 'pakai-undangan', { token: rahasia })
    : await fungsi(klien, 'pakai-kode', { kode: rapikanKode(rahasia) })
  if (!hasil?.ok) return { ok: false, alasan: hasil?.alasan ?? 'server' }
  await verifikasiTautanMasuk(klien, hasil.token_hash)
  const perangkat = await rpc(klien, 'claim_device', { p_ticket: hasil.tiket, p_timezone: zonaWaktu() })
  return { ok: true, nama: hasil.nama, via: perangkat.via, berakhir: perangkat.expires_at ?? null }
}

// Status perangkat ini (Edge Function cek-perangkat).
// Hasil: { ok: true, status: 'ok' | 'dicabut' | 'kedaluwarsa' | 'tidak_terdaftar', berakhir }
export const cekPerangkat = (klien) => fungsi(klien, 'cek-perangkat')

// Anggota yang sedang masuk. Disaring menurut akun login, karena yang punya
// izin "lihat anggota" bisa membaca baris semua anggota.
export async function bacaAnggotaSaya(klien) {
  const { data: sesi } = await klien.auth.getSession()
  const akun = sesi?.session?.user?.id
  if (!akun) throw new Error('belum masuk')
  const { data, error } = await klien
    .from('members')
    .select('id, display_name, role, is_owner, permissions')
    .eq('auth_user_id', akun)
  if (error) throw error
  const saya = (data ?? []).length === 1 ? data[0] : null
  if (!saya) throw new Error('anggota tidak ditemukan')
  return {
    id: saya.id,
    nama: saya.display_name,
    peran: saya.role,
    pemilik: saya.is_owner,
    izin: saya.permissions ?? [],
  }
}

export const bacaVersiDatabase = (klien) => klien.rpc('db_version')

// Nomor sesi login perangkat ini (klaim "session_id" di token), untuk
// menandai "Perangkat ini". Isi token tidak disimpan atau dicatat.
export async function bacaSessionId(klien) {
  const { data } = await klien.auth.getSession()
  const token = data?.session?.access_token
  if (!token) return null
  try {
    const isi = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(isi)).session_id ?? null
  } catch {
    return null
  }
}

export const laporBukanSaya = (klien) => rpc(klien, 'report_not_me')
export const keluarDariPerangkat = (klien, semua = false) => rpc(klien, 'sign_out_devices', { p_all: semua })
export const buatKodePerangkat = (klien) => rpc(klien, 'create_device_code')
export const cabutPerangkat = (klien, id) => rpc(klien, 'revoke_device', { p_device: id })

export async function daftarPerangkatSaya(klien, memberId) {
  const { data, error } = await klien
    .from('devices')
    .select('id, label, device_type, via, expires_at, approx_city, approx_country, approx_country_name, created_at, last_seen_at, revoked_at, session_id')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function daftarKotakMasuk(klien) {
  const { data, error } = await klien
    .from('notifications')
    .select('id, kind, title, body, link, priority, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function tandaiDibaca(klien, id) {
  const { error } = await klien.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
