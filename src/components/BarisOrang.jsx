import { Link } from 'react-router-dom'
import { isiTeks, teks } from '../teks/id.js'

// Satu baris di Daftar: seluruh baris adalah tautan ke Detail orang itu.
export function BarisOrang({ orang }) {
  const bagian = [orang.labelGen, orang.istilahGen, orang.tahun].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={`/orang/${encodeURIComponent(orang.id)}`}
        className="flex min-h-14 flex-col gap-1 rounded-xl border border-tepi bg-kertas px-4 py-3 shadow-lembut transition-colors hover:border-emas"
      >
        <span className="font-judul text-xl font-bold uppercase tracking-wide">{orang.nama}</span>
        {orang.panggilan && (
          <span data-panggilan={orang.lewat === 'panggilan' ? 'cocok' : undefined} className={orang.lewat === 'panggilan' ? 'text-base font-semibold text-emas-teks' : 'text-base text-redup'}>
            {orang.lewat === 'panggilan' ? isiTeks(teks.daftar.cariPanggilan, { panggilan: orang.panggilan }) : `“${orang.panggilan}”`}
          </span>
        )}
        {bagian && <span className="text-base">{bagian}</span>}
        {orang.keterangan && <span className="text-base text-redup">{orang.keterangan}</span>}
      </Link>
    </li>
  )
}
