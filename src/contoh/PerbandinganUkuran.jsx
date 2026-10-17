// Halaman perbandingan ukuran nama kartu (SEMENTARA, hanya mode contoh;
// putaran ketujuh, bagian 5). Kartu yang sama dengan lima pilihan ukuran:
// A = ukuran sekarang (Bagan), B/C/D/E = tingkat besar +1/+2/+3/+4 px (pada
// ukuran tulisan Normal, 1rem = 18px); tingkat sedang, kecil, dan terkecil
// naik dengan perbandingan yang sama. Setiap kartu memilih ukurannya dengan
// aturan Bagan (barisNama.js, putaran 7b bagian B) dari ukuran pilihan itu. Setiap pilihan tampil dalam bingkai
// selebar HP (390 px) dan selebar biasa. Bagan tetap memakai pilihan A.
// Dimuat hanya lewat App.jsx di mode contoh (dibuang dari build produksi).
import { Link } from 'react-router-dom'
import { KartuOrang } from '../components/bagan/KartuOrang.jsx'
import { KonteksUkuranNama } from '../components/bagan/ukuranNama.js'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { labelKartu } from '../lib/silsilah/kartu.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { KARTU_UKURAN, PILIHAN_UKURAN, teksPilihan } from './pilihanUkuran.js'

// Teks halaman ini sengaja DI SINI, bukan di teks/id.js: halamannya hanya ada
// di mode contoh, jadi teksnya juga tidak boleh ikut ke build produksi.
const T = {
  judul: 'Perbandingan ukuran nama kartu',
  isi: 'Halaman sementara, hanya di mode contoh. Kartu yang sama dengan lima pilihan ukuran nama. A adalah ukuran yang dipakai Bagan sekarang; B sampai E menaikkan ukuran besar sebesar 1 sampai 4 px, dan ukuran sedang, kecil, dan terkecil naik dengan perbandingan yang sama. Setiap nama memakai ukuran terbesar yang muat (dua baris, tiga untuk nama bergelar). Bagan tetap memakai A sampai ada keputusan.',
  bingkaiHp: 'Selebar HP (390 px)',
  bingkaiBiasa: 'Selebar biasa',
  kembali: 'Kembali ke Bagan',
}

function Deretan({ s }) {
  const kartu = KARTU_UKURAN.map((id) => labelKartu(s, id)).filter(Boolean)
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
    <div className="flex flex-col gap-10">
      {PILIHAN_UKURAN.map((p) => (
        <section key={p.huruf} data-pilihan={p.huruf} aria-label={teksPilihan(p)} className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{teksPilihan(p)}</h2>
          <KonteksUkuranNama.Provider value={p.ukuran}>
            <h3 className="text-lg font-semibold">{T.bingkaiHp}</h3>
            <div className="overflow-x-auto">
              <div data-bingkai="hp" className="bagan-latar w-[390px] rounded-xl border border-tepi p-3">
                <Deretan s={s} />
              </div>
            </div>
            <h3 className="text-lg font-semibold">{T.bingkaiBiasa}</h3>
            <div data-bingkai="biasa" className="bagan-latar rounded-xl border border-tepi p-3">
              <Deretan s={s} />
            </div>
          </KonteksUkuranNama.Provider>
        </section>
      ))}
    </div>
  )
}

export default function PerbandinganUkuran() {
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
