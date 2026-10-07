// Memuat file data lokasi SEKALI per Edge Function yang menyala, lalu
// menyimpannya di memori. Sumbernya Storage privat project ini sendiri
// (bukan layanan luar). Kalau data belum ada atau gagal dimuat, login tetap
// jalan tanpa perkiraan lokasi; percobaan memuat diulang setelah jeda.

import { uraiIp } from './ip.js'
import { bacaDataLokasi, cariLokasi } from './lokasi.js'

// Nama negara bahasa Indonesia ("Arab Saudi") dari data Unicode bawaan
// runtime, tanpa jaringan.
const NAMA_NEGARA = new Intl.DisplayNames(['id'], { type: 'region', fallback: 'none' })
export const namaNegara = (kode) => {
  try {
    return NAMA_NEGARA.of(kode) ?? null
  } catch {
    return null
  }
}

export const BUCKET_LOKASI = 'lokasi-ip'
export const BERKAS_LOKASI = 'lokasi-ip.bin.gz'

async function bukaGzip(u8) {
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8
  const aliran = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(aliran).arrayBuffer())
}

// unduh(): Promise<Uint8Array> isi berkas (boleh gzip).
// Hasil: async (ipTeks) → { approx_country, approx_country_name, approx_city } atau {}.
export function buatPencariLokasi(unduh, { batasWaktuMs = 4000, jedaUlangMs = 10 * 60 * 1000, sekarang = () => Date.now() } = {}) {
  let data = null
  let sedangMemuat = null
  let gagalTerakhir = -Infinity

  const muat = () => {
    if (data || sedangMemuat || sekarang() - gagalTerakhir < jedaUlangMs) return sedangMemuat
    sedangMemuat = (async () => {
      try {
        data = bacaDataLokasi(await bukaGzip(await unduh()))
      } catch {
        gagalTerakhir = sekarang()
      }
    })().finally(() => {
      sedangMemuat = null
    })
    return sedangMemuat
  }

  return async (ipTeks) => {
    const ip = uraiIp(ipTeks)
    if (!ip) return {}
    if (!data) {
      const proses = muat()
      // Jangan menahan login terlalu lama: kalau data belum siap, lanjut tanpa lokasi.
      if (proses) {
        let pewaktu
        await Promise.race([proses, new Promise((r) => { pewaktu = setTimeout(r, batasWaktuMs) })])
        clearTimeout(pewaktu)
      }
    }
    const lokasi = cariLokasi(data, ip)
    return lokasi ? { ...lokasi, approx_country_name: namaNegara(lokasi.approx_country) } : {}
  }
}
