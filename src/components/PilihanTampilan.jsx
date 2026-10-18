import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { alamatBagan, useFokusCabang } from '../lib/fokus/konteksFokus.js'
import { teks } from '../teks/id.js'

// Pilihan "Bagan | Daftar" (putaran 8a, PLAN.md bagian 14): dua tombol
// berdampingan, masing-masing minimal 48 px tinggi. Yang aktif ditandai
// aria-current, tanda ✓, garis tebal, dan latar, jadi tidak hanya warna.
// Fokus cabang ikut terbawa ke dua arah: ke Bagan lewat alamatBagan, ke
// Daftar lewat konteks fokus (lib/fokus).
export function PilihanTampilan({ aktif, className = '' }) {
  const { fokus } = useFokusCabang()
  const pilihan = [
    { kunci: 'bagan', ke: alamatBagan(fokus), nama: teks.navigasi.bagan },
    { kunci: 'daftar', ke: '/daftar', nama: teks.navigasi.daftar },
  ]
  return (
    <div role="group" aria-label={teks.navigasi.pilihanTampilan} data-pilihan-tampilan className={`flex gap-2 ${className}`}>
      {pilihan.map(({ kunci, ke, nama }) => {
        const ini = kunci === aktif
        return (
          <Link
            key={kunci}
            to={ke}
            aria-current={ini ? 'page' : undefined}
            className={`inline-flex min-h-12 min-w-12 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-lg font-semibold ${
              ini ? 'border-4 border-emas-teks bg-emas/15 text-teks underline decoration-2 underline-offset-4' : 'border-2 border-garis bg-latar text-teks hover:border-emas hover:bg-kertas'
            }`}
          >
            {ini && <Check aria-hidden="true" className="size-5 shrink-0" />}
            {nama}
          </Link>
        )
      })}
    </div>
  )
}
