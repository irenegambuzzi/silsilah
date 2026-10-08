import { CloudOff, RefreshCw } from 'lucide-react'
import { useDataSilsilah } from '../lib/data/konteksData.js'
import { formatTanggalJam } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'

// Spanduk saat yang tampil BUKAN data terbaru dari server: salinan di
// perangkat (offline), atau pembaruan terakhir gagal. Dijelaskan dengan
// tulisan dan ikon, bukan hanya warna.
export function SpandukData() {
  const { status, sumber, waktu, galat, coba } = useDataSilsilah()
  if (status !== 'siap' && status !== 'kosong') return null
  if (sumber !== 'salinan' && !galat) return null
  const T = teks.data
  const kapan = waktu ? formatTanggalJam(waktu, teks.silsilah.bulan) : null
  const kalimat = sumber === 'salinan'
    ? (kapan ? isiTeks(galat?.jenis === 'offline' ? T.offline : T.salinan, { waktu: kapan }) : T.salinanTanpaWaktu)
    : T.gagalPerbarui
  return (
    <div role="status" className="border-b-2 border-emas bg-peringatan p-3 text-peringatan-teks">
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        <p className="flex items-start gap-2 text-lg font-semibold">
          <CloudOff aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
          <span>
            {kalimat}
            <span className="block font-normal">{T.hanyaMembaca}</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => coba()}
          className="inline-flex min-h-12 items-center gap-2 self-start rounded-lg border-2 border-current px-3 text-lg font-semibold"
        >
          <RefreshCw aria-hidden="true" className="size-5" />
          {teks.umum.cobaLagi}
        </button>
      </div>
    </div>
  )
}
