// Klien Supabase untuk aplikasi. Alamat dan publishable key (aman untuk
// publik) datang dari variabel build; kalau belum diisi, klien = null dan
// aplikasi menampilkan "belum siap" tanpa menulis apa pun.
import { createClient } from '@supabase/supabase-js'
import { KUNCI } from './penyimpanan.js'

export function buatKlien(env = import.meta.env) {
  const url = env.VITE_SUPABASE_URL
  const kunci = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !kunci) return null
  return createClient(url, kunci, {
    auth: {
      // Kunci sendiri (diawali "silsilah"), supaya ikut terhapus saat keluar.
      storageKey: KUNCI.auth,
      persistSession: true,
      autoRefreshToken: true,
      // Alamat masuk memakai "#/…" milik router, bukan milik Supabase.
      detectSessionInUrl: false,
    },
  })
}

export const klienBawaan = buatKlien()
