// Pengaturan Edge Function dari variabel lingkungan (Supabase → Edge
// Functions → Secrets). Isi kunci TIDAK PERNAH ditulis di repo.
//
//   SUPABASE_URL           otomatis ada di setiap Edge Function
//   KUNCI_SERVER           secret key project (sb_secret_…), diisi pemilik.
//                          Cadangan: kunci pertama di SUPABASE_SECRET_KEYS
//                          kalau Supabase menyediakannya.
//   ASAL_APLIKASI          alamat situs yang boleh memanggil, dipisah koma,
//                          misalnya https://<akun>.github.io (kosong = semua)
//   DOMAIN_EMAIL_SINTETIS  domain email akun login (bawaan silsilah.invalid;
//                          tidak ada email yang dikirim)
//
// Semua permintaan jaringan di sini hanya ke project Supabase ini sendiri
// (database, Auth, Storage). Alamat IP anggota tidak dikirim ke mana pun.

import { BERKAS_LOKASI, BUCKET_LOKASI, buatPencariLokasi } from './sumber-lokasi.js'

export function ambilKunciServer(env) {
  const kunci = env.get('KUNCI_SERVER')
  if (kunci) return kunci
  try {
    const semua = JSON.parse(env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    return Object.values(semua).find((k) => typeof k === 'string' && k) ?? null
  } catch {
    return null
  }
}

// Layanan dari klien supabase-js (dipisah supaya bisa dites dengan tiruan).
export function layananDariKlien(supabase) {
  return {
    rpc: (nama, args) => supabase.rpc(nama, args),
    auth: supabase.auth.admin,
    // File data lokasi dari Storage privat project ini, dimuat sekali.
    cariLokasi: buatPencariLokasi(async () => {
      const { data, error } = await supabase.storage.from(BUCKET_LOKASI).download(BERKAS_LOKASI)
      if (error || !data) throw new Error('data lokasi tidak ada')
      return new Uint8Array(await data.arrayBuffer())
    }),
    // Token login yang sah → { userId, sessionId }, atau null.
    async verifikasiToken(token) {
      const { data, error } = await supabase.auth.getClaims(token)
      const k = data?.claims
      if (error || typeof k?.sub !== 'string' || typeof k?.session_id !== 'string') return null
      return { userId: k.sub, sessionId: k.session_id }
    },
  }
}

// createClient dari @supabase/supabase-js (diberikan oleh index.js).
export function buatAmbilLayanan(createClient, env) {
  let layanan = null
  return () => {
    if (layanan) return layanan
    const url = env.get('SUPABASE_URL')
    const kunci = ambilKunciServer(env)
    if (!url || !kunci) throw new Error('pengaturan')
    layanan = layananDariKlien(createClient(url, kunci, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }))
    return layanan
  }
}

export function opsiDariEnv(env) {
  return {
    asal: (env.get('ASAL_APLIKASI') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    domainEmail: env.get('DOMAIN_EMAIL_SINTETIS') || undefined,
    catat: (info) => console.error(JSON.stringify(info)),
  }
}
