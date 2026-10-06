// Mode contoh hanya menyala kalau SEMUA syarat ini terpenuhi:
//   1. build pengembangan (import.meta.env.DEV), dan
//   2. VITE_MODE_CONTOH=1.
// Di build produksi kondisi pertama selalu salah, sehingga bundler
// membuang seluruh cabang ini dan data contoh tidak pernah ikut terkirim.
// Aplikasi asli tidak pernah menulis atau menampilkan data bawaan.
export const modeContohAktif = import.meta.env.DEV && import.meta.env.VITE_MODE_CONTOH === '1'

export async function muatKeluargaContoh() {
  if (import.meta.env.DEV && modeContohAktif) {
    const { keluargaContoh } = await import('../contoh/keluargaContoh.js')
    return keluargaContoh
  }
  throw new Error('Mode contoh tidak tersedia.')
}
