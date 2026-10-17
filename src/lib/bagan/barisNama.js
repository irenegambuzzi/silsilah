// Nama di kartu Bagan (putaran 7b, bagian B; menggantikan ukuran menurut
// jumlah kata): ukuran dan baris menurut LEBAR nama yang diukur.
// - Setiap nama dicoba dari ukuran terbesar (besar, sedang, kecil, lalu
//   terkecil sebagai cadangan); dipakai ukuran TERBESAR yang membuat nama
//   muat dalam batas baris.
// - Batas baris: nama tanpa gelar paling banyak 2 baris, nama bergelar
//   (Alm./Almh., gelar religius, gelar pendidikan) paling banyak 3 baris.
// - Satu baris hanya kalau seluruh nama (dengan gelar) muat dalam 85% lebar
//   dalam kartu. Kalau tidak: dipotong di antara kata, sepanjang mungkin
//   seimbang, dengan baris sesedikit mungkin. Gelar menempel pada kata di
//   sebelahnya. Tidak ada baris yang lebih lebar dari lebar dalam kartu.
// - Tinggi kartu tetap: kalau baris-barisnya tidak muat di tinggi yang
//   tersedia untuk nama, turun satu tingkat. Tidak pernah "…".
// Lebar dihitung dari tabel lebar huruf yang dibuat dari file huruf yang
// dibundel (lebarHuruf.js): hasilnya sama di semua perangkat dan di tes, dan
// tidak bergantung pada apakah huruf sudah selesai dimuat.
import { GELAR, NAMA } from './lebarHuruf.js'

// Ukuran huruf nama dalam rem (pilihan A di /contoh/ukuran).
export const UKURAN_NAMA = { besar: 0.85, sedang: 0.75, kecil: 0.66, terkecil: 0.58 }
export const TINGKAT_NAMA = ['besar', 'sedang', 'kecil', 'terkecil']
// Jarak antarbaris per tingkat (index.css, .kartu-nama[data-ukuran]).
export const JARAK_BARIS = { besar: 1.2, sedang: 1.15, kecil: 1.12, terkecil: 1.12 }
// Gelar: Plus Jakarta Sans, 0.8 kali ukuran nama (index.css, .kartu-gelar).
export const SKALA_GELAR = 0.8
// Lebar dalam kartu: 10rem dikurangi padding kiri-kanan 0.5rem (index.css).
export const LEBAR_DALAM = 9
export const BATAS_SATU_BARIS = 0.85
// Tinggi untuk nama (rem): tinggi kartu 6.75rem dikurangi padding atas 2.1rem
// dan bawah 0.55rem, dikurangi satu baris label (0.65rem × 1.5) (index.css).
export const TINGGI_NAMA = 6.75 - 2.1 - 0.55 - 0.65 * 1.5
export const BARIS_TANPA_GELAR = 2
export const BARIS_BERGELAR = 3

const em = (tabel, teks) => {
  let jumlah = 0
  for (const huruf of teks) {
    const i = huruf.codePointAt(0) - tabel.awal
    jumlah += (i >= 0 && tabel.lebar[i]) || tabel.rata
  }
  return jumlah / 1000
}

// Bagian nama yang tidak dipisah: satu kata, dengan gelar yang menempel.
export function bagianNama(n) {
  const akhir = n.kata.length - 1
  return n.kata.map((kata, i) => ({
    kata,
    depan: i === 0 ? n.depan : null,
    belakang: i === akhir ? n.belakang : null,
  }))
}

// Lebar satu baris (rem) pada ukuran `rem`.
export function lebarBaris(bagian, rem) {
  let lebar = em(NAMA, ' ') * Math.max(0, bagian.length - 1)
  for (const b of bagian) {
    lebar += em(NAMA, b.kata)
    if (b.depan) lebar += em(GELAR, `${b.depan} `) * SKALA_GELAR
    if (b.belakang) lebar += em(GELAR, `, ${b.belakang}`) * SKALA_GELAR
  }
  return lebar * rem
}

// Semua cara memotong `bagian` menjadi tepat `n` baris (tanpa baris kosong).
function* potongan(bagian, n) {
  if (n === 1) {
    yield [bagian]
    return
  }
  for (let k = 1; k <= bagian.length - n + 1; k++) {
    for (const sisa of potongan(bagian.slice(k), n - 1)) yield [bagian.slice(0, k), ...sisa]
  }
}

// Potongan menjadi `n` baris yang sepanjang mungkin seimbang: baris terlebar
// sesempit mungkin; kalau sama, baris atas yang lebih panjang.
function seimbang(bagian, n, rem) {
  let terbaik = null
  for (const baris of potongan(bagian, n)) {
    const lebar = baris.map((b) => lebarBaris(b, rem))
    const terlebar = Math.max(...lebar)
    if (!terbaik || terlebar < terbaik.terlebar - 1e-9 || (Math.abs(terlebar - terbaik.terlebar) <= 1e-9 && lebar[0] > terbaik.lebar[0] + 1e-9)) {
      terbaik = { baris, lebar, terlebar }
    }
  }
  return terbaik
}

// Susunan pada satu ukuran: baris sesedikit mungkin yang muat lebarnya
// (satu baris hanya sampai 85%), paling banyak `batas` baris; null kalau
// tidak ada. Satu kata (dengan gelarnya) yang tidak bisa dipotong boleh satu
// baris sampai lebar dalam penuh.
function susunPada(bagian, rem, batas) {
  const satu = lebarBaris(bagian, rem)
  if (satu <= LEBAR_DALAM * BATAS_SATU_BARIS || (bagian.length === 1 && satu <= LEBAR_DALAM)) return { baris: [bagian], terlebar: satu }
  for (let n = 2; n <= Math.min(batas, bagian.length); n++) {
    const s = seimbang(bagian, n, rem)
    if (s.terlebar <= LEBAR_DALAM) return s
  }
  return null
}

const batasBaris = (n) => (n.depan || n.belakang ? BARIS_BERGELAR : BARIS_TANPA_GELAR)

// Susunan nama `n` pada satu tingkat ukuran, atau null kalau tidak muat
// (lebar atau tinggi).
export function cobaUkuran(n, ukuran, ukuranNama = UKURAN_NAMA) {
  const rem = ukuranNama[ukuran]
  const s = susunPada(bagianNama(n), rem, batasBaris(n))
  if (!s || s.baris.length * rem * JARAK_BARIS[ukuran] > TINGGI_NAMA + 1e-9) return null
  return { baris: s.baris, ukuran, rem }
}

// n: hasil namaKartu. ukuranNama: { besar, sedang, kecil, terkecil } (rem).
// Hasil: { baris: [[{ kata, depan, belakang }]], ukuran (tingkat yang
// dipakai), rem }.
export function barisNamaKartu(n, ukuranNama = UKURAN_NAMA) {
  for (const ukuran of TINGKAT_NAMA) {
    const hasil = cobaUkuran(n, ukuran, ukuranNama)
    if (hasil) return hasil
  }
  // Cadangan (tidak terjadi pada nama sungguhan): terkecil, sebanyak-banyaknya
  // baris yang diizinkan, sepanjang mungkin seimbang.
  const bagian = bagianNama(n)
  const rem = ukuranNama.terkecil
  return { baris: seimbang(bagian, Math.min(batasBaris(n), bagian.length), rem).baris, ukuran: 'terkecil', rem }
}
