import { RefreshCw } from 'lucide-react'
import { Judul } from '../components/ui/Judul.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { teks } from '../teks/id.js'

// Layar keadaan khusus (layar 28): memuat, galat, sedang dipulihkan,
// belum diperbarui, tanpa internet. Tidak pernah menulis data.
export function Keadaan({ jenis = 'galat', pesan, bisaCobaLagi = false, onCobaLagi }) {
  const layar = teks.layar[jenis] ?? teks.layar.galat
  return (
    <section aria-live="polite" className="flex flex-col gap-4">
      <Judul>{layar.judul}</Judul>
      <p className="text-xl">{pesan ?? layar.isi}</p>
      {bisaCobaLagi && onCobaLagi && (
        <Tombol ikon={RefreshCw} onClick={onCobaLagi}>
          {teks.umum.cobaLagi}
        </Tombol>
      )}
    </section>
  )
}

export const KeadaanMemuat = () => <Keadaan jenis="memuat" />
