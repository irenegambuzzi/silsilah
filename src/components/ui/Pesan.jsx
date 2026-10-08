import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

// Kotak pesan. Jenisnya terlihat dari ikon dan tulisan, bukan hanya warna.
const JENIS = {
  info: { kelas: 'border-garis bg-info text-info-teks', ikon: Info, peran: 'status', nama: 'Informasi' },
  peringatan: { kelas: 'border-garis bg-peringatan text-peringatan-teks', ikon: TriangleAlert, peran: 'status', nama: 'Perhatian' },
  galat: { kelas: 'border-bahaya bg-kertas text-teks', ikon: CircleAlert, peran: 'alert', nama: 'Masalah' },
  sukses: { kelas: 'border-sukses bg-kertas text-teks', ikon: CircleCheck, peran: 'status', nama: 'Berhasil' },
}

export function Pesan({ jenis = 'info', children, className = '' }) {
  const { kelas, ikon: Ikon, peran, nama } = JENIS[jenis]
  return (
    <div role={peran} className={`flex items-start gap-3 rounded-xl border-2 p-4 text-lg shadow-lembut ${kelas} ${className}`}>
      <Ikon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
      <p>
        <span className="sr-only">{nama}: </span>
        {children}
      </p>
    </div>
  )
}
