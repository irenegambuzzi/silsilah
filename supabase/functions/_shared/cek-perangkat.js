// Logika Edge Function cek-perangkat: dipanggil aplikasi setiap kali dibuka
// (dengan token login perangkat itu). Mencatat "terakhir aktif", dan kalau
// perangkat atau anggotanya sudah DICABUT tetapi masih dibuka, admin utama
// langsung diberi tahu (paling banyak sekali sehari per perangkat).
// Perkiraan lokasi hanya dicari untuk laporan itu, jadi pembukaan biasa
// tidak memuat data lokasi.
//
// Hasil: { ok: true, status: 'ok' | 'dicabut' | 'kedaluwarsa' | 'tidak_terdaftar', berakhir }
//        atau { ok: false, alasan: 'sesi_habis' } (token tidak sah)

import { GalatLayanan } from './penukaran.js'
import { kenaliPerangkat } from './perangkat.js'

async function panggil(layanan, nama, args) {
  const { data, error } = await layanan.rpc(nama, args)
  if (error || data == null) throw new GalatLayanan(nama, error)
  return data
}

export async function cekPerangkat(token, konteks, layanan) {
  const klaim = token ? await layanan.verifikasiToken(token) : null
  if (!klaim?.userId || !klaim?.sessionId) return { ok: false, alasan: 'sesi_habis' }

  const r = await panggil(layanan, 'edge_device_check', { p_user: klaim.userId, p_session: klaim.sessionId })
  if (r.status === 'dicabut' && r.lapor) {
    let lokasi = {}
    try {
      lokasi = (await layanan.cariLokasi?.(konteks.ip)) ?? {}
    } catch {
      lokasi = {}
    }
    await panggil(layanan, 'edge_report_revoked_device', {
      p_device: r.device_id,
      p_ip: konteks.ip ?? null,
      p_info: { ...kenaliPerangkat(konteks.userAgent), ...lokasi },
    })
  }
  return { ok: true, status: r.status, berakhir: r.expires_at ?? null }
}
