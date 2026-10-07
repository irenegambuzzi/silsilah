// Pemetaan galat: apa pun yang dikembalikan Supabase (PostgREST, Auth,
// Edge Functions, atau jaringan) diubah menjadi pesan bahasa Indonesia.
//
// Aturan utama: teks dari server TIDAK PERNAH ditampilkan begitu saja,
// kecuali untuk kode galat buatan kita sendiri (AK001, SL003, dst. dari
// file SQL), itu pun hanya kalau tampak berbahasa Indonesia. Galat yang
// tidak dikenal menjadi pesan umum; kodenya disimpan di `kode` untuk admin.
//
// Hasilnya selalu berbentuk:
//   { jenis, judul, pesan, bisaCobaLagi, kode }
// `jenis` menentukan layar: 'dipulihkan', 'belumDiperbarui', 'offline',
// 'jaringan', 'sesiHabis', 'tanpaIzin', 'bentrok', 'sibuk', 'terlaluSering',
// 'server', 'aturan' (kode buatan kita), 'duaLangkah' (verifikasi dua
// langkah), 'dataDitolak', 'tidakDitemukan', atau 'tidakDikenal'.
import { teks } from '../teks/id.js'

const KODE_KITA = /^(AK|RP|SL|TR|UN)\d{3}$/
const NAMA_BATASAN = /constraint "([^"]+)"/

// Galat PostgREST/Postgres yang artinya "database belum punya tabel, fungsi,
// atau kolom yang dibutuhkan aplikasi" (file SQL belum dijalankan semua).
const BELUM_DIPERBARUI = new Set(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42883', '42703'])
// Basis data tidak bisa dihubungi sama sekali (dijeda atau sedang dinyalakan).
const TIDAK_TERJANGKAU = new Set(['PGRST000', 'PGRST001', 'PGRST002'])
const SESI_HABIS = new Set([
  'PGRST301', 'PGRST303', 'bad_jwt', 'session_expired', 'session_not_found',
  'refresh_token_not_found', 'refresh_token_already_used', 'invalid_jwt', 'no_authorization',
])
const SEDANG_BENTROK = new Set(['40001', '40P01', 'PGRST116'])
// Galat verifikasi dua langkah dari Supabase Auth (kode salah, dst.).
const DUA_LANGKAH = new Set([
  'mfa_verification_failed', 'mfa_verification_rejected', 'mfa_challenge_expired', 'insufficient_aal',
  'mfa_factor_name_conflict', 'mfa_factor_not_found', 'too_many_enrolled_mfa_factors',
  'mfa_totp_enroll_not_enabled', 'mfa_totp_verify_not_enabled', 'mfa_ip_address_mismatch',
])
const TERLALU_SERING = new Set(['over_request_rate_limit', 'over_email_send_rate_limit', 'too_many_requests'])

// Kata yang hampir pasti bahasa Inggris. Dipakai untuk menolak pesan server
// yang bukan Indonesia, dan oleh tes untuk memeriksa semua teks.
const KATA_INGGRIS = new Set([
  'the', 'and', 'you', 'your', 'not', 'cannot', 'must', 'only', 'was', 'were', 'has', 'have',
  'with', 'from', 'this', 'that', 'error', 'failed', 'invalid', 'permission', 'denied',
  'violates', 'constraint', 'row', 'level', 'security', 'policy', 'relation', 'exist',
  'exists', 'does', 'null', 'value', 'duplicate', 'unique', 'key', 'paused', 'token',
  'expired', 'request', 'found', 'could', 'should', 'would', 'please', 'unable', 'missing',
  'unauthorized', 'forbidden',
])

export function tampaknyaInggris(teksBebas) {
  const kata = String(teksBebas ?? '').toLowerCase().match(/[a-z']+/g) ?? []
  return kata.some((k) => KATA_INGGRIS.has(k))
}

const bentuk = (jenis, pesan, bisaCobaLagi, kode = null) => ({
  jenis,
  judul: teks.layar[jenis]?.judul ?? teks.layar.galat.judul,
  pesan,
  bisaCobaLagi,
  kode,
})

function ambilStatus(galat, opsi) {
  const s = opsi.status ?? galat.status ?? galat.statusCode ?? galat.context?.status
  return Number.isInteger(s) ? s : null
}

// Hanya TypeError yang pesannya memang soal jaringan (Chrome: "Failed to fetch",
// Safari: "Load failed", Firefox: "NetworkError …"); TypeError lain adalah bug
// kode dan tidak boleh disamarkan sebagai masalah internet.
const galatJaringan = (galat) =>
  ['AuthRetryableFetchError', 'FunctionsFetchError', 'FunctionsRelayError'].includes(galat.name) ||
  /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(galat.message ?? '')

// opsi: { status } (status HTTP respons kalau ada), { online } (navigator.onLine).
export function petakanGalat(galat, opsi = {}) {
  if (galat == null) return null
  if (typeof galat === 'string') galat = { message: galat }
  const kode = galat.code != null ? String(galat.code) : null
  const status = ambilStatus(galat, opsi)
  const pesanServer = String(galat.message ?? '')
  const T = teks.galat

  // 1. Project dijeda (540) atau layanan tidak tersedia (503).
  if (
    status === 540 ||
    status === 503 ||
    (kode && TIDAK_TERJANGKAU.has(kode)) ||
    /project.{0,20}paused|paused.{0,20}project/i.test(pesanServer)
  ) {
    return bentuk('dipulihkan', T.dipulihkan, true, kode)
  }

  // 2. Database belum punya objek yang dibutuhkan.
  if (kode && BELUM_DIPERBARUI.has(kode)) {
    return bentuk('belumDiperbarui', T.belumDiperbarui, false, kode)
  }

  // 3. Kode galat buatan kita di file SQL.
  if (kode && KODE_KITA.test(kode)) {
    // Pesan server hanya dipercaya untuk kode yang terdaftar; kode yang belum
    // terdaftar tidak boleh membawa teks apa pun ke layar.
    const terdaftar = Object.hasOwn(T.kode, kode)
    const dariServer = terdaftar && pesanServer && !tampaknyaInggris(pesanServer) ? pesanServer : null
    return bentuk('aturan', dariServer ?? (terdaftar ? T.kode[kode] : T.dataDitolak), false, kode)
  }

  // 3b. Verifikasi dua langkah.
  if (kode && DUA_LANGKAH.has(kode)) {
    return bentuk('duaLangkah', T.duaLangkah[kode], false, kode)
  }

  // 4. Sesi habis atau tidak login.
  if (status === 401 || (kode && SESI_HABIS.has(kode))) {
    return bentuk('sesiHabis', T.sesiHabis, false, kode)
  }

  // 5. Tanpa izin (RLS menolak, atau fungsi tidak boleh dijalankan).
  if (kode === '42501' || status === 403) {
    return bentuk('tanpaIzin', T.tanpaIzin, false, kode)
  }

  // 6. Aturan isian Postgres. Kalau nama batasannya kita kenal, pesannya spesifik.
  if (kode && /^(23|22)/.test(kode)) {
    const nama = NAMA_BATASAN.exec(`${pesanServer} ${galat.details ?? ''}`)?.[1]
    const pesan = (nama && T.batasan[nama]) || T.standar[kode] || T.dataDitolak
    return bentuk('dataDitolak', pesan, false, kode)
  }

  // 7. Data berubah bersamaan atau sudah tidak ada.
  if (kode && SEDANG_BENTROK.has(kode)) {
    return bentuk('bentrok', T.bentrok, true, kode)
  }

  // 8. Terlalu sering.
  if (status === 429 || (kode && TERLALU_SERING.has(kode))) {
    return bentuk('terlaluSering', T.terlaluSering, true, kode)
  }

  // 9. Tidak ada jaringan.
  if (galatJaringan(galat)) {
    return opsi.online === false
      ? bentuk('offline', T.offline, true, kode)
      : bentuk('jaringan', T.jaringan, true, kode)
  }

  // 10. Server bermasalah atau waktu habis.
  if (status === 408 || status === 504 || kode === '57014' || kode === 'PGRST003') {
    return bentuk('sibuk', T.sibuk, true, kode)
  }
  if (status != null && status >= 500) {
    return bentuk('server', T.server, true, kode)
  }
  if (status === 404) {
    return bentuk('tidakDitemukan', T.tidakDitemukan, false, kode)
  }

  return bentuk('tidakDikenal', T.tidakDikenal, true, kode)
}
