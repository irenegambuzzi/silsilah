import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { teks } from '../teks/id.js'

// Layar Privasi (layar 29): bisa dibuka sebelum dan sesudah masuk, dan
// tidak memuat data apa pun (tidak memanggil server).
export default function Privasi() {
  const T = teks.privasi
  const navigasi = useNavigate()
  const lokasi = useLocation()
  return (
    <>
      <Judul>{T.judul}</Judul>
      <p className="text-xl">{T.pembuka}</p>
      {T.bagian.map((b) => (
        <Kartu key={b.judul} className="flex flex-col gap-2">
          <Subjudul>{b.judul}</Subjudul>
          <p className="text-lg">{b.isi}</p>
        </Kartu>
      ))}
      <p className="text-base text-redup">{T.atribusi}</p>
      <a
        href="https://db-ip.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center gap-2 text-lg underline"
      >
        <ExternalLink aria-hidden="true" className="size-6" />
        {T.tautanAtribusi}
      </a>
      <Tombol varian="sekunder" ikon={ArrowLeft} onClick={() => (lokasi.key === 'default' ? navigasi('/') : navigasi(-1))}>{T.kembali}</Tombol>
    </>
  )
}
