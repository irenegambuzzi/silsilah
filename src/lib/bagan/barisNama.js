// Nama di kartu Bagan (putaran ketujuh, bagian 5): satu atau dua baris
// menurut LEBAR nama yang diukur, tidak dari jumlah kata.
// - Ukuran dasar tetap dari jumlah kata nama asli (namaKartu di
//   lib/silsilah/nama.js): besar, sedang, kecil. Gelar tidak dihitung.
// - Satu baris kalau seluruh nama (dengan gelar) muat dalam 85% lebar dalam
//   kartu. Kalau tidak: dua baris, dipotong di antara kata, sepanjang mungkin
//   seimbang. Gelar menempel pada kata di sebelahnya.
// - Paling banyak dua baris. Kalau ada baris yang tetap lebih lebar dari
//   lebar dalam kartu, ukuran turun SATU tingkat untuk kartu itu saja (lalu
//   disusun ulang dengan ukuran itu). Tidak pernah "…".
// Lebar dihitung dari tabel lebar huruf yang dibuat dari file huruf yang
// dibundel (lebarHuruf.js): hasilnya sama di semua perangkat dan di tes, dan
// tidak bergantung pada apakah huruf sudah selesai dimuat.
import { GELAR, NAMA } from './lebarHuruf.js'

// Ukuran huruf nama dalam rem (pilihan A di /contoh/ukuran). "terkecil" hanya
// untuk nama 4 kata atau lebih yang tetap tidak muat dalam dua baris.
export const UKURAN_NAMA = { besar: 0.85, sedang: 0.75, kecil: 0.66, terkecil: 0.58 }
export const TINGKAT_NAMA = ['besar', 'sedang', 'kecil', 'terkecil']
// Gelar: Plus Jakarta Sans, 0.8 kali ukuran nama (index.css, .kartu-gelar).
export const SKALA_GELAR = 0.8
// Lebar dalam kartu: 10rem dikurangi padding kiri-kanan 0.5rem (index.css).
export const LEBAR_DALAM = 9
export const BATAS_SATU_BARIS = 0.85

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

function susun(bagian, rem) {
  const batas = LEBAR_DALAM * BATAS_SATU_BARIS
  if (bagian.length <= 1 || lebarBaris(bagian, rem) <= batas) {
    return { baris: [bagian], muat: lebarBaris(bagian, rem) <= LEBAR_DALAM }
  }
  // Dua baris, sepanjang mungkin seimbang (baris terlebar sesempit mungkin;
  // kalau sama, baris pertama yang lebih panjang).
  let terbaik = null
  for (let k = 1; k < bagian.length; k++) {
    const atas = bagian.slice(0, k)
    const bawah = bagian.slice(k)
    const lebar = Math.max(lebarBaris(atas, rem), lebarBaris(bawah, rem))
    if (!terbaik || lebar < terbaik.lebar - 1e-9) terbaik = { baris: [atas, bawah], lebar }
  }
  return { baris: terbaik.baris, muat: terbaik.lebar <= LEBAR_DALAM }
}

// n: hasil namaKartu. ukuranNama: { besar, sedang, kecil, terkecil } (rem).
// Hasil: { baris: [[{ kata, depan, belakang }]], ukuran (tingkat yang
// dipakai), rem, turun (true kalau ukuran diturunkan satu tingkat) }.
export function barisNamaKartu(n, ukuranNama = UKURAN_NAMA) {
  const bagian = bagianNama(n)
  const dasar = n.ukuran
  let hasil = susun(bagian, ukuranNama[dasar])
  let ukuran = dasar
  if (!hasil.muat) {
    const lebihKecil = TINGKAT_NAMA[TINGKAT_NAMA.indexOf(dasar) + 1]
    if (lebihKecil) {
      ukuran = lebihKecil
      hasil = susun(bagian, ukuranNama[lebihKecil])
    }
  }
  return { baris: hasil.baris, ukuran, rem: ukuranNama[ukuran], turun: ukuran !== dasar }
}
