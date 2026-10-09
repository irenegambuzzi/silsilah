// Hitungan tampilan Bagan: geser dan zoom. Pandang = { x, y, k }: isi bagan
// digeser (x, y) piksel lalu diperbesar k kali, dari sudut kiri atas.
export const SKALA_MIN = 0.05
export const SKALA_MAX = 2.5
export const TEPI = 16
// Layar sempit (HP): tampilan awal tidak memperkecil seluruh pohon.
export const LEBAR_HP = 640
// Skala terkecil yang masih terbaca di HP (kartu ±150 px).
export const SKALA_TERBACA_HP = 0.8
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

// Daerah bingkai yang tidak tertutup bilah atas dan legenda (keduanya
// melayang di atas bagan). `halangan`: { atas: tinggi bilah atas (px),
// legenda: { lebar, tinggi } di kiri bawah }. Ada dua pilihan: di atas
// legenda (selebar bingkai), atau di kanan legenda (setinggi bingkai).
function daerahBebas(bingkai, halangan = {}) {
  const atas = Math.max(0, halangan.atas ?? 0)
  const leg = halangan.legenda
  const daerah = [{ x: 0, y: atas, lebar: bingkai.lebar, tinggi: bingkai.tinggi - atas - (leg?.tinggi ?? 0) }]
  if (leg) daerah.push({ x: leg.lebar, y: atas, lebar: bingkai.lebar - leg.lebar, tinggi: bingkai.tinggi - atas })
  return daerah.filter((d) => d.lebar > 4 * TEPI && d.tinggi > 4 * TEPI)
}

// Seluruh bagan muat di daerah yang tidak tertutup bilah atas dan legenda
// (kalau tidak ada daerah yang cukup: di seluruh bingkai).
export function pasDiDaerah(isi, bingkai, halangan = {}, { maks = SKALA_MAX } = {}) {
  const daerah = daerahBebas(bingkai, halangan)
  if (daerah.length === 0) return pasDiLayar(isi, bingkai)
  const skala = (d) => Math.min((d.lebar - 2 * TEPI) / isi.lebar, (d.tinggi - 2 * TEPI) / isi.tinggi)
  const d = daerah.reduce((a, b) => (skala(b) > skala(a) ? b : a))
  const k = batasiSkala(Math.min(maks, skala(d)))
  const tinggi = isi.tinggi * k
  return {
    k,
    x: d.x + (d.lebar - isi.lebar * k) / 2,
    y: d.y + (k >= maks ? TEPI : Math.max(TEPI, (d.tinggi - tinggi) / 2)),
  }
}

// Tampilan pertama di layar lebar, seperti aplikasi lama: seluruh bagan
// terlihat (diperkecil secukupnya, tidak pernah diperbesar melebihi ukuran
// asli) dan TIDAK tertutup legenda atau bilah atas. Sesudah itu bisa
// diperbesar.
export function pandangAwal(isi, bingkai, halangan = {}) {
  return pasDiDaerah(isi, bingkai, halangan, { maks: 1 })
}

// Tampilan pertama di HP: TIDAK memperkecil seluruh pohon sampai kartu tak
// terbaca. Mulai dari ukuran yang terbaca, dengan pasangan pangkal (`kotak`:
// letak kedua kartunya di dalam isi, sebelum zoom) di tengah, tepat di bawah
// bilah atas. Seluruh bagan bisa dilihat dengan tombol "Lihat seluruh bagan".
export function pandangHp(kotak, bingkai, halangan = {}) {
  const atas = Math.max(0, halangan.atas ?? 0)
  const k = Math.min(1, Math.max(SKALA_TERBACA_HP, (bingkai.lebar - 2 * TEPI) / kotak.lebar))
  return {
    k,
    x: bingkai.lebar / 2 - (kotak.x + kotak.lebar / 2) * k,
    y: atas + TEPI - kotak.y * k,
  }
}

// Menggeser supaya titik `pusat` (koordinat isi, sebelum zoom) berada di tengah bingkai.
export const pusatkan = (p, pusat, bingkai) => ({
  k: p.k,
  x: bingkai.lebar / 2 - pusat.x * p.k,
  y: bingkai.tinggi / 2 - pusat.y * p.k,
})
