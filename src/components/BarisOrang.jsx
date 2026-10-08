import { Link } from 'react-router-dom'
import { isiTeks, teks } from '../teks/id.js'

// Satu baris di Daftar: seluruh baris adalah tautan ke Detail orang itu.
export function BarisOrang({ orang }) {
  const bagian = [orang.labelGen, orang.istilahGen, orang.tahun].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={`/orang/${encodeURIComponent(orang.id)}`}
        className="flex min-h-14 flex-col gap-1 rounded-xl border-2 border-garis bg-kertas px-4 py-3"
      >
        <span className="text-xl font-semibold">{orang.nama}</span>
        {orang.panggilan && <span className="text-base text-redup">“{orang.panggilan}”</span>}
        {bagian && <span className="text-base">{bagian}</span>}
        {orang.keterangan && <span className="text-base text-redup">{orang.keterangan}</span>}
        {orang.nomor && (
          <span className="text-base text-redup">{isiTeks(teks.daftar.nomor, { nomor: orang.nomor })}</span>
        )}
      </Link>
    </li>
  )
}
