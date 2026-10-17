// Pilihan ukuran nama untuk halaman /contoh/ukuran (SEMENTARA, mode contoh).
import { UKURAN_NAMA } from '../lib/bagan/barisNama.js'

export const KARTU_UKURAN = ['mega', 'ratrisa-k', 'sadevan-b', 'selvarani', 'bagaskara', 'ratrisa-a']
const PX_PER_REM = 18 // ukuran tulisan Normal (index.css)

// Pilihan A–E: { huruf, tambah (px untuk tingkat besar), ukuran (rem per tingkat) }.
export const PILIHAN_UKURAN = [0, 1, 2, 3, 4].map((tambah, i) => {
  const kali = (UKURAN_NAMA.besar * PX_PER_REM + tambah) / (UKURAN_NAMA.besar * PX_PER_REM)
  const ukuran = Object.fromEntries(Object.entries(UKURAN_NAMA).map(([t, rem]) => [t, rem * kali]))
  return { huruf: 'ABCDE'[i], tambah, ukuran }
})
const px = (rem) => (Math.round(rem * PX_PER_REM * 10) / 10).toLocaleString('id-ID')
export const teksPilihan = (p) =>
  `${p.huruf}${p.tambah ? ` (+${p.tambah} px)` : ' (sekarang)'}: besar ${px(p.ukuran.besar)} px, sedang ${px(p.ukuran.sedang)} px, kecil ${px(p.ukuran.kecil)} px`
