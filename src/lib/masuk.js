// Pesan untuk hasil memakai link undangan atau kode perangkat (Edge
// Function pakai-undangan dan pakai-kode). Alasan yang tidak dikenal tidak
// pernah ditampilkan apa adanya.
import { teks } from '../teks/id.js'

// jenis: 'undangan' | 'kode'. alasan: dari { ok: false, alasan }.
export function pesanPenukaran(jenis, alasan) {
  const daftar = teks.masuk[jenis] ?? {}
  if (typeof alasan === 'string' && Object.hasOwn(daftar, alasan)) return daftar[alasan]
  if (alasan === 'server') return teks.galat.server
  return teks.galat.tidakDikenal
}
