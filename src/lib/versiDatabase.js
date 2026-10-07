// Memastikan database sudah diperbarui sampai file SQL yang dibutuhkan
// aplikasi ini. Database mencatat file yang sudah dijalankan di
// app_migrations, dan db_version() mengembalikan nomor terbesarnya
// (SQL 001). Kalau belum sampai, aplikasi menolak berjalan dengan pesan
// yang jelas dan tidak menulis apa pun.
import { teks } from '../teks/id.js'
import { petakanGalat } from './galat.js'

// Nomor file SQL terakhir yang dibutuhkan kode aplikasi ini. Naikkan setiap
// kali menambah file SQL bernomor baru; tes memeriksa kecocokannya dengan
// folder supabase/.
export const VERSI_DATABASE_DIBUTUHKAN = '009'

export function versiSudahCukup(terpasang, dibutuhkan = VERSI_DATABASE_DIBUTUHKAN) {
  return /^\d{3}$/.test(String(terpasang ?? '')) && Number(terpasang) >= Number(dibutuhkan)
}

// Menafsirkan hasil `supabase.rpc('db_version')` ({ data, error, status }).
// Hasil: { siap: true } atau { siap: false, jenis, judul, pesan, bisaCobaLagi, kode }
// dengan bentuk yang sama seperti petakanGalat.
export function tafsirkanVersiDatabase({ data = null, error = null, status } = {}, opsi = {}) {
  if (error) {
    return { siap: false, ...petakanGalat(error, { status, ...opsi }) }
  }
  if (!versiSudahCukup(data, opsi.dibutuhkan)) {
    return {
      siap: false,
      jenis: 'belumDiperbarui',
      judul: teks.layar.belumDiperbarui.judul,
      pesan: teks.galat.belumDiperbarui,
      bisaCobaLagi: false,
      kode: null,
    }
  }
  return { siap: true }
}
