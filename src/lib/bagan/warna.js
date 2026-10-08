// Warna kartu di Bagan (aturan Irene, Oktober 2026), supaya terbaca sekilas:
//   keturunan laki-laki biru, keturunan perempuan pink,
//   pasangan (bukan keturunan) laki-laki hijau sage, perempuan peach,
//   jenis kelamin tidak diketahui abu,
//   KEDUA kartu pasangan pangkal emas (tetap emas walau sudah wafat; tanda
//   wafatnya hanya strip dan lingkaran simbol hitam arang),
//   keturunan wafat hitam arang tua, pasangan wafat hitam arang lebih muda.
// Pasangan yang juga keturunan (antarsepupu) memakai warna keturunan.
// Nilai warnanya ada di index.css (token --c-k-…, ikut kontras tinggi).
export function warnaKartu(kartu) {
  if (kartu.jenis === 'pangkal') return 'pangkal'
  const pihak = kartu.jenis === 'pasangan' ? 'pasangan' : 'keturunan'
  if (kartu.wafat) return `${pihak}-wafat`
  if (kartu.sex === 'L') return `${pihak}-l`
  if (kartu.sex === 'P') return `${pihak}-p`
  return 'x'
}

// Baris legenda, urut seperti di legenda. "Jenis kelamin tidak diketahui"
// hanya ditampilkan kalau memang ada kartu seperti itu.
export const WARNA_LEGENDA = [
  'keturunan-l', 'keturunan-p', 'pasangan-l', 'pasangan-p', 'pangkal', 'keturunan-wafat', 'pasangan-wafat', 'x',
]
