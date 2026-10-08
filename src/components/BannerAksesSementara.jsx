import { Timer } from 'lucide-react'
import { useSisaWaktu } from '../lib/useSisaWaktu.js'
import { formatJam, sisaWaktuPanjang } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'

// Spanduk di perangkat dengan akses sementara: pukul berapa berakhir dan
// sisa waktunya. Lima menit terakhir diberi tulisan "Segera berakhir"
// (bukan hanya warna).
const LIMA_MENIT = 5 * 60 * 1000

export function BannerAksesSementara({ berakhir }) {
  const sisa = useSisaWaktu(berakhir)
  if (sisa == null) return null
  const T = teks.aksesSementara
  return (
    <div role="timer" className="border-b-2 border-emas bg-peringatan p-3 text-peringatan-teks">
      <p className="mx-auto flex max-w-xl items-start gap-2 text-lg font-semibold">
        <Timer aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
        <span>
          {isiTeks(T.banner, { jam: formatJam(berakhir), sisa: sisaWaktuPanjang(sisa) })}
          {sisa <= LIMA_MENIT && <span className="block">{T.segera}</span>}
        </span>
      </p>
    </div>
  )
}
