// Halaman perbandingan huruf nama kartu (SEMENTARA, hanya mode contoh;
// putaran keenam, bagian E). Deretan kartu yang sama tiga kali, semuanya
// dengan aturan nama yang baru (namaKartu di lib/silsilah/nama.js):
// (a) Cinzel kapital seperti sekarang, (b) Marcellus dan (c) Lora tebal
// sedang, keduanya huruf besar-kecil. Bagan sendiri TIDAK diubah hurufnya.
// Dimuat hanya lewat App.jsx di mode contoh (dibuang dari build produksi).
import { Link } from 'react-router-dom'
import { KartuOrang } from '../components/bagan/KartuOrang.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { labelKartu } from '../lib/silsilah/kartu.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import './perbandinganHuruf.css'

// Teks halaman ini sengaja DI SINI, bukan di teks/id.js: halamannya hanya ada
// di mode contoh, jadi teksnya juga tidak boleh ikut ke build produksi
// (seperti spanduk "MODE CONTOH" di App.jsx).
const T = {
  judul: 'Perbandingan huruf nama kartu',
  isi: 'Halaman sementara, hanya di mode contoh. Kartu yang sama ditampilkan tiga kali dengan aturan nama yang baru (ukuran dari jumlah kata, gelar dengan huruf biasa yang lebih kecil, nama tidak pernah dipotong). Huruf di Bagan belum diganti.',
  pilihan: {
    cinzel: '(a) Cinzel, huruf kapital (seperti sekarang)',
    marcellus: '(b) Marcellus, huruf besar-kecil',
    lora: '(c) Lora tebal sedang, huruf besar-kecil',
  },
  kembali: 'Kembali ke Bagan',
}

// Nama 1, 2, 3, dan 4 kata, dengan dan tanpa gelar; kartu wafat yang gelap
// (Alm. Tirwan, Alm. H. Bagaskara …) dan pasangan wafat (Alm. H. Halvin).
export const KARTU_PERBANDINGAN = [
  'mega', 'tirwan', 'dorvi', 'halvin',
  'ratrisa-k', 'sadevan-a', 'ayundra',
  'sadevan-b', 'selvarani',
  'ratrisa-a', 'bagaskara',
]
const HURUF = ['cinzel', 'marcellus', 'lora']

function Deretan({ s }) {
  const kartu = KARTU_PERBANDINGAN.map((id) => labelKartu(s, id)).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-4">
      {kartu.map((k) => (
        <div key={k.id} className="relative h-[6.75rem] w-40 shrink-0">
          <KartuOrang kartu={k} letak={{ x: 0, y: 0 }} saatKetuk={() => {}} />
        </div>
      ))}
    </div>
  )
}

function Isi() {
  const s = useSilsilah()
  if (!s) return null
  return (
    <div className="flex flex-col gap-8">
      {HURUF.map((huruf) => (
        <section key={huruf} data-huruf={huruf} aria-label={T.pilihan[huruf]} className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{T.pilihan[huruf]}</h2>
          <Deretan s={s} />
        </section>
      ))}
    </div>
  )
}

export default function PerbandinganHuruf() {
  return (
    <div className="flex flex-col gap-4">
      <Judul>{T.judul}</Judul>
      <p className="text-lg">{T.isi}</p>
      <Link to="/bagan" className="inline-flex min-h-12 items-center text-lg font-semibold underline">
        {T.kembali}
      </Link>
      <GerbangData bagian>
        <Isi />
      </GerbangData>
    </div>
  )
}
