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

// createClient dari @supabase/supabase-js (diberikan oleh index.js).
export function buatAmbilLayanan(createClient, env) {
  let layanan = null
  return () => {
    if (layanan) return layanan
    const url = env.get('SUPABASE_URL')
    const kunci = ambilKunciServer(env)
    if (!url || !kunci) throw new Error('pengaturan')
    const supabase = createClient(url, kunci, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    layanan = { rpc: (nama, args) => supabase.rpc(nama, args), auth: supabase.auth.admin }
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
