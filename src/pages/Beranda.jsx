import { Judul } from '../components/ui/Judul.jsx'
import { useSesi } from '../lib/konteksSesi.js'
import { isiTeks, teks } from '../teks/id.js'

// Sementara: silsilah baru ditampilkan di langkah-langkah berikutnya.
export default function Beranda() {
  const { anggota } = useSesi()
  return (
    <>
      <Judul>{teks.beranda.judul}</Judul>
      <p className="text-2xl font-semibold">{isiTeks(teks.beranda.sapa, { nama: anggota?.nama ?? '' })}</p>
      <p className="text-xl">{teks.beranda.isi}</p>
    </>
  )
}
