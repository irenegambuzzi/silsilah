// Hitungan tampilan Bagan: geser dan zoom. Pandang = { x, y, k }: isi bagan
// digeser (x, y) piksel lalu diperbesar k kali, dari sudut kiri atas.
export const SKALA_MIN = 0.05
export const SKALA_MAX = 2.5
export const TEPI = 16
const TERLIHAT_MIN = 80

export const batasiSkala = (k) => Math.min(SKALA_MAX, Math.max(SKALA_MIN, k))

export const geser = (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy })

// Memperbesar/memperkecil `faktor` kali dengan `titik` (koordinat layar di
// dalam bingkai) tetap di tempatnya, seperti memperbesar peta dengan jari.
export function zoomDi(p, faktor, titik) {
  const k = batasiSkala(p.k * faktor)
  const rasio = k / p.k
  return { k, x: titik.x - (titik.x - p.x) * rasio, y: titik.y - (titik.y - p.y) * rasio }
}

// Bagan tidak boleh tergeser sampai hilang: minimal sebagian kecil tetap terlihat.
export function jagaTerlihat(p, isi, bingkai) {
  const lebar = isi.lebar * p.k
  const tinggi = isi.tinggi * p.k
  const sisaX = Math.min(TERLIHAT_MIN, lebar)
  const sisaY = Math.min(TERLIHAT_MIN, tinggi)
  return {
    k: p.k,
    x: Math.min(bingkai.lebar - sisaX, Math.max(sisaX - lebar, p.x)),
    y: Math.min(bingkai.tinggi - sisaY, Math.max(sisaY - tinggi, p.y)),
  }
}

// Seluruh bagan muat di bingkai (dan di tengah).
export function pasDiLayar(isi, bingkai) {
  const k = batasiSkala(Math.min((bingkai.lebar - 2 * TEPI) / isi.lebar, (bingkai.tinggi - 2 * TEPI) / isi.tinggi))
  return { k, x: (bingkai.lebar - isi.lebar * k) / 2, y: Math.max(TEPI, (bingkai.tinggi - isi.tinggi * k) / 2) }
}

// Tampilan pertama, seperti aplikasi lama: seluruh bagan terlihat
// (diperkecil secukupnya, tidak pernah diperbesar melebihi ukuran asli),
// berpusat di bingkai. Sesudah itu bisa diperbesar.
export function pandangAwal(isi, bingkai) {
  const p = pasDiLayar(isi, bingkai)
  if (p.k <= 1) return p
  return { k: 1, x: (bingkai.lebar - isi.lebar) / 2, y: TEPI }
}

// Menggeser supaya titik `pusat` (koordinat isi, sebelum zoom) berada di tengah bingkai.
export const pusatkan = (p, pusat, bingkai) => ({
  k: p.k,
  x: bingkai.lebar / 2 - pusat.x * p.k,
  y: bingkai.tinggi / 2 - pusat.y * p.k,
})
