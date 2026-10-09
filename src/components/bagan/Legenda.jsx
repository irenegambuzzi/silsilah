import { useState } from 'react'
import { Info, Sprout, X } from 'lucide-react'
import { WARNA_LEGENDA } from '../../lib/bagan/warna.js'
import { teks } from '../../teks/id.js'
import { IkonHati } from './IkonHati.jsx'

const T = teks.bagan.legenda

// Contoh kecil kartu: latar dan strip warna seperti kartu sungguhan.
function Contoh({ warna }) {
  return <span aria-hidden="true" className="legenda-contoh" data-warna={warna} />
}

// Di layar sempit (HP) legenda mulai tertutup supaya bagan tidak terhalang.
const layarLebar = () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia('(min-width: 640px)').matches)

// Keterangan warna di kiri bawah, seperti aplikasi lama. Bisa ditutup;
// saat ditutup tersisa tombol bulat kecil di pojok kiri bawah.
// `ada`: { tanpaJenisKelamin, belumDewasa } — baris "Jenis kelamin tidak
// diketahui" dan "Belum dewasa" hanya tampil SELAMA ada kartu seperti itu,
// dan hilang sendiri setelah datanya lengkap.
export function Legenda({ bingkai, tombolBulat, ada = {}, ref }) {
  const [buka, setBuka] = useState(layarLebar)
  if (!buka) {
    return (
      <button ref={ref} type="button" onClick={() => setBuka(true)} aria-label={T.tampilkan} className={`${tombolBulat} bottom-3 left-3`}>
        <Info aria-hidden="true" className="size-6" />
      </button>
    )
  }
  return (
    <section ref={ref} aria-label={T.judul} className={`absolute bottom-3 left-3 z-20 max-w-[min(17rem,calc(100%-1.5rem))] p-4 pr-12 text-sm ${bingkai}`}>
      <button
        type="button"
        onClick={() => setBuka(false)}
        aria-label={T.sembunyikan}
        className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-lg text-redup hover:text-emas-teks"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      <ul className="flex flex-col gap-1.5">
        {WARNA_LEGENDA.filter((w) => w !== 'x' || ada.tanpaJenisKelamin).map((warna) => (
          <li key={warna} className="flex items-center gap-2.5">
            <Contoh warna={warna} />
            {T.warna[warna]}
          </li>
        ))}
        <li className="flex items-center gap-2.5">
          <span aria-hidden="true" className="legenda-garis legenda-berpisah">
            <IkonHati patah className="legenda-hati" />
          </span>
          {T.berpisah}
        </li>
        <li className="flex items-center gap-2.5">
          <span aria-hidden="true" className="legenda-ikon">
            <span className="legenda-urut">1</span>
          </span>
          {T.urut}
        </li>
        {ada.belumDewasa && (
          <li className="flex items-center gap-2.5">
            <span aria-hidden="true" className="legenda-ikon text-sukses">
              <Sprout className="size-4" />
            </span>
            {T.belumDewasa}
          </li>
        )}
      </ul>
      <p className="mt-2 text-redup">{T.petunjuk}</p>
    </section>
  )
}
