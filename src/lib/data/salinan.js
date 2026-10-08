// Salinan data silsilah di perangkat, supaya tetap bisa dibaca saat offline.
//
// Isinya HANYA:
//   - data silsilah dengan kolom yang diizinkan (kolom.js): orang,
//     pernikahan, hubungan anak, urutan lahir, pohon keluarga asal yang
//     boleh dilihat, pangkal, dan istilah generasi;
//   - anggota yang masuk (nama tampilan, peran, izin) dan akun loginnya,
//     supaya salinan hanya dibuka untuk akun yang sama;
//   - waktu disimpan.
// TIDAK PERNAH berisi data kontak (alamat, nomor HP), lokasi, token, kode,
// atau isi riwayat. Perangkat dengan akses sementara tidak menyimpan salinan
// sama sekali. Salinan ikut terhapus saat keluar, saat akses sementara habis,
// dan saat perangkat dicabut (penyimpanan.js hapusDataLokal).
import { bacaSalinan, simpanSalinan } from '../penyimpanan.js'
import { saringData } from './kolom.js'

export const FORMAT_SALINAN = 1

// Galat yang berarti "server tidak terjangkau sekarang" (bukan "tidak boleh"):
// hanya untuk ini salinan dipakai sebagai pengganti.
export const GALAT_PAKAI_SALINAN = new Set(['offline', 'jaringan', 'dipulihkan', 'sibuk', 'server', 'terlaluSering'])

const rapikanAnggota = (a) => ({
  id: a?.id ?? null,
  nama: String(a?.nama ?? ''),
  peran: a?.peran ?? null,
  pemilik: a?.pemilik === true,
  izin: Array.isArray(a?.izin) ? a.izin.map(String) : [],
})

export const susunSalinan = ({ akun, anggota, data, waktu = Date.now() }) => ({
  format: FORMAT_SALINAN,
  akun,
  anggota: rapikanAnggota(anggota),
  data: saringData(data),
  disimpanPada: new Date(waktu).toISOString(),
})

// `gen`: generasiPenghapusan() saat data mulai dimuat (lihat penyimpanan.js).
export const tulisSalinan = (isi, gen) => simpanSalinan(susunSalinan(isi), gen)

// Salinan milik akun ini, atau null.
export async function bacaSalinanUntuk(akun) {
  if (!akun) return null
  const s = await bacaSalinan()
  if (!s || s.format !== FORMAT_SALINAN || s.akun !== akun || !s.anggota?.id || !s.data) return null
  return { akun, anggota: rapikanAnggota(s.anggota), data: saringData(s.data), disimpanPada: s.disimpanPada ?? null }
}
