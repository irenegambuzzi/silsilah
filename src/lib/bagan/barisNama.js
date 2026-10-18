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
// ATURAN TETAP (putaran 7c-2): nama TIDAK PERNAH melebihi lebar kartu.
// Nama yang muat dengan aturan di atas tidak berubah sama sekali. Hanya kalau
// tidak muat di tingkat mana pun, berurutan:
//   1. gelar dikecilkan (0,7 lalu 0,6 kali ukuran nama; 0,6 batas bawah yang
//      masih terbaca), nama tetap di ukuran sebesar mungkin;
//   2. gelar belakang boleh pindah ke baris sendiri dan dipotong di antara
//      gelar (setiap gelar utuh, misalnya "S.Kom.,"); tetap paling banyak 3
//      baris;
//   3. baru setelah itu ukuran nama turun (besar → sedang → kecil → terkecil);
//   4. pilihan terakhir: ukuran yang dihitung supaya muat (gelar 0,6),
//      tinggi kartu tetap, potongan tetap seimbang, tanpa "…".
// Lebar dihitung dari tabel lebar huruf yang dibuat dari file huruf yang
// dibundel (lebarHuruf.js): hasilnya sama di semua perangkat dan di tes, dan
// tidak bergantung pada apakah huruf sudah selesai dimuat.
import { GELAR, NAMA } from './lebarHuruf.js'

// Ukuran huruf nama dalam rem (pilihan A di /contoh/ukuran).
export const UKURAN_NAMA = { besar: 0.85, sedang: 0.75, kecil: 0.66, terkecil: 0.58 }
export const TINGKAT_NAMA = ['besar', 'sedang', 'kecil', 'terkecil']
// Jarak antarbaris per tingkat (index.css, .kartu-nama[data-ukuran]).
export const JARAK_BARIS = { besar: 1.2, sedang: 1.15, kecil: 1.12, terkecil: 1.12 }
// Gelar: Plus Jakarta Sans, 0.8 kali ukuran nama (index.css, .kartu-gelar,
// lewat --skala-gelar). Dikecilkan hanya untuk nama yang tidak muat.
export const SKALA_GELAR = 0.8
export const SKALA_GELAR_KECIL = [0.7, 0.6]
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

// Gelar belakang yang boleh pindah baris (langkah 2): kata terakhir membawa
// koma, lalu setiap gelar menjadi bagian sendiri ("S.Kom.,", "M.Pd.,",
// "S.Ag."). Gelar depan tetap menempel pada kata pertama.
export function bagianNamaPindah(n) {
  const gelar = String(n.belakang ?? '').split(',').map((g) => g.trim()).filter(Boolean)
  const kata = bagianNama({ ...n, belakang: null })
  if (gelar.length === 0) return kata
  kata[kata.length - 1] = { ...kata.at(-1), koma: true }
  return [...kata, ...gelar.map((g, i) => ({ gelar: i < gelar.length - 1 ? `${g},` : g }))]
}

// Lebar satu baris (rem) pada ukuran `rem`, dengan gelar `skala` kali ukuran nama.
export function lebarBaris(bagian, rem, skala = SKALA_GELAR) {
  let lebar = em(NAMA, ' ') * Math.max(0, bagian.length - 1)
  for (const b of bagian) {
    if (b.gelar) {
      lebar += em(GELAR, b.gelar) * skala
      continue
    }
    lebar += em(NAMA, b.kata)
    if (b.depan) lebar += em(GELAR, `${b.depan} `) * skala
    if (b.belakang) lebar += em(GELAR, `, ${b.belakang}`) * skala
    if (b.koma) lebar += em(GELAR, ',') * skala
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
function seimbang(bagian, n, rem, skala = SKALA_GELAR) {
  let terbaik = null
  for (const baris of potongan(bagian, n)) {
    const lebar = baris.map((b) => lebarBaris(b, rem, skala))
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
function susunPada(bagian, rem, batas, skala = SKALA_GELAR) {
  const satu = lebarBaris(bagian, rem, skala)
  if (satu <= LEBAR_DALAM * BATAS_SATU_BARIS || (bagian.length === 1 && satu <= LEBAR_DALAM)) return { baris: [bagian], terlebar: satu }
  for (let n = 2; n <= Math.min(batas, bagian.length); n++) {
    const s = seimbang(bagian, n, rem, skala)
    if (s.terlebar <= LEBAR_DALAM) return s
  }
  return null
}

const batasBaris = (n) => (n.depan || n.belakang ? BARIS_BERGELAR : BARIS_TANPA_GELAR)

const muatTinggi = (s, rem, ukuran) => s.baris.length * rem * JARAK_BARIS[ukuran] <= TINGGI_NAMA + 1e-9
const hasilSusun = (s, ukuran, rem, skala, pindah, dihitung = false) => ({
  baris: s.baris,
  ukuran,
  rem,
  skalaGelar: skala,
  // Ada baris yang diawali gelar belakang (gelar pindah baris).
  gelarPindah: pindah && s.baris.some((b) => Boolean(b[0].gelar)),
  dihitung,
})

// Susunan nama `n` pada satu tingkat ukuran dengan aturan biasa (gelar 0,8,
// menempel), atau null kalau tidak muat (lebar atau tinggi).
export function cobaUkuran(n, ukuran, ukuranNama = UKURAN_NAMA) {
  const rem = ukuranNama[ukuran]
  const s = susunPada(bagianNama(n), rem, batasBaris(n))
  if (!s || !muatTinggi(s, rem, ukuran)) return null
  return hasilSusun(s, ukuran, rem, SKALA_GELAR, false)
}

// Langkah 1 dan 2 pada satu tingkat, untuk nama yang tidak muat dengan
// aturan biasa: gelar dikecilkan, lalu gelar belakang boleh pindah baris.
export function cobaUkuranDarurat(n, ukuran, ukuranNama = UKURAN_NAMA) {
  if (!n.depan && !n.belakang) return null
  const rem = ukuranNama[ukuran]
  const batas = batasBaris(n)
  for (const skala of SKALA_GELAR_KECIL) {
    const s = susunPada(bagianNama(n), rem, batas, skala)
    if (s && muatTinggi(s, rem, ukuran)) return hasilSusun(s, ukuran, rem, skala, false)
  }
  if (!n.belakang) return null
  for (const skala of [SKALA_GELAR, ...SKALA_GELAR_KECIL]) {
    const s = susunPada(bagianNamaPindah(n), rem, batas, skala)
    if (s && muatTinggi(s, rem, ukuran)) return hasilSusun(s, ukuran, rem, skala, true)
  }
  return null
}

// Langkah 4: ukuran terbesar (di bawah tingkat terkecil) yang membuat nama
// muat, dihitung; gelar 0,6 dan boleh pindah baris.
function ukuranDihitung(n, ukuranNama) {
  const skala = SKALA_GELAR_KECIL.at(-1)
  const batas = batasBaris(n)
  const susun = (rem) => {
    for (const [bagian, pindah] of [[bagianNama(n), false], ...(n.belakang ? [[bagianNamaPindah(n), true]] : [])]) {
      const s = susunPada(bagian, rem, batas, skala)
      if (s && muatTinggi(s, rem, 'terkecil')) return { s, pindah }
    }
    return null
  }
  let bawah = 0
  let atas = ukuranNama.terkecil
  for (let i = 0; i < 40; i++) {
    const tengah = (bawah + atas) / 2
    if (susun(tengah)) bawah = tengah
    else atas = tengah
  }
  const rem = Math.floor(bawah * 1000) / 1000
  const { s, pindah } = susun(rem)
  return hasilSusun(s, 'terkecil', rem, skala, pindah, true)
}

// n: hasil namaKartu. ukuranNama: { besar, sedang, kecil, terkecil } (rem).
// Hasil: { baris: [[{ kata, depan, belakang, koma } | { gelar }]], ukuran
// (tingkat yang dipakai), rem, skalaGelar, gelarPindah, dihitung }.
export function barisNamaKartu(n, ukuranNama = UKURAN_NAMA) {
  // Aturan biasa dulu: nama yang muat tidak pernah berubah.
  for (const ukuran of TINGKAT_NAMA) {
    const hasil = cobaUkuran(n, ukuran, ukuranNama)
    if (hasil) return hasil
  }
  for (const ukuran of TINGKAT_NAMA) {
    const hasil = cobaUkuranDarurat(n, ukuran, ukuranNama)
    if (hasil) return hasil
  }
  return ukuranDihitung(n, ukuranNama)
}
