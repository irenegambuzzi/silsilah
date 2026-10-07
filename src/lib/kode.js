// Bentuk kode perangkat di sisi aplikasi (sama dengan Edge Function).
import { BENTUK_KODE, rapikanKode } from '../../supabase/functions/_shared/rahasia.js'

export { rapikanKode }
export const kodeSahBentuk = (masukan) => BENTUK_KODE.test(rapikanKode(masukan))
// Alamat yang dibuka kamera perangkat baru. Disusun dari alamat situs yang
// sedang dipakai (bukan alamat yang ditulis di kode), jadi ikut berpindah
// kalau situs pindah domain.
export const alamatKode = (kode, { asal = globalThis.location?.origin, dasar = import.meta.env.BASE_URL } = {}) =>
  `${asal}${dasar}#/kode/${rapikanKode(kode)}`

// "abcd2345" → "ABCD-2345" (untuk ditampilkan dan diketik).
export const tampilkanKode = (masukan) => {
  const k = rapikanKode(masukan).slice(0, 8)
  return k.length > 4 ? `${k.slice(0, 4)}-${k.slice(4)}` : k
}
