import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Smartphone, Type, X } from 'lucide-react'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { PilihanUkuranHuruf } from '../components/PengaturanTampilan.jsx'
import { petakanGalat } from '../lib/galat.js'
import { laporBukanSaya } from '../lib/api.js'
import { useSesi } from '../lib/konteksSesi.js'
import { isiTeks, teks } from '../teks/id.js'

// Layar Selamat datang (layar 3), setelah link undangan dipakai pertama kali:
// "Apakah ini Anda?", lalu beberapa tips. "Bukan saya" menutup akses di
// perangkat ini dan langsung memberi tahu admin.
export default function SelamatDatang() {
  const { anggota, klien, akhiri } = useSesi()
  const navigasi = useNavigate()
  const [langkah, setLangkah] = useState('tanya') // tanya | yakin | terima | tips
  const [sedang, setSedang] = useState(false)
  const [galat, setGalat] = useState(null)
  const T = teks.selamatDatang

  const laporkan = async () => {
    setSedang(true)
    setGalat(null)
    try {
      await laporBukanSaya(klien)
      setLangkah('terima')
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }).pesan)
    }
    setSedang(false)
  }
  const keHalamanMasuk = async () => {
    await akhiri(null)
    navigasi('/masuk', { replace: true })
  }

  if (langkah === 'terima') {
    return (
      <>
        <Judul>{T.terimaKasihJudul}</Judul>
        <p className="text-xl">{T.terimaKasihIsi}</p>
        <Tombol ikon={ArrowRight} onClick={keHalamanMasuk}>{teks.penukaran.keHalamanMasuk}</Tombol>
      </>
    )
  }

  if (langkah === 'yakin') {
    return (
      <>
        <Judul>{T.yakinJudul}</Judul>
        <p className="text-xl">{T.yakinIsi}</p>
        {galat && <Pesan jenis="galat">{galat}</Pesan>}
        <Tombol varian="bahaya" ikon={X} disabled={sedang} onClick={laporkan}>
          {sedang ? T.sedangMelapor : T.yakinYa}
        </Tombol>
        <Tombol varian="sekunder" disabled={sedang} onClick={() => setLangkah('tanya')}>{T.yakinBatal}</Tombol>
      </>
    )
  }

  if (langkah === 'tips') {
    return (
      <>
        <Judul>{T.tipsJudul}</Judul>
        <Kartu className="flex flex-col gap-3">
          <Subjudul className="flex items-center gap-2"><Type aria-hidden="true" className="size-7" />{T.ukuranHuruf}</Subjudul>
          <p className="text-lg">{T.ukuranIsi}</p>
          <PilihanUkuranHuruf />
        </Kartu>
        <Kartu className="flex flex-col gap-2">
          <Subjudul>{T.layarUtama}</Subjudul>
          <p className="text-lg">{T.layarUtamaIsi}</p>
        </Kartu>
        <Kartu className="flex flex-col gap-2">
          <Subjudul className="flex items-center gap-2"><Smartphone aria-hidden="true" className="size-7" />{T.perangkatBaru}</Subjudul>
          <p className="text-lg">{T.perangkatBaruIsi}</p>
        </Kartu>
        <Tombol ikon={ArrowRight} onClick={() => navigasi('/', { replace: true })}>{T.lanjut}</Tombol>
      </>
    )
  }

  return (
    <>
      <Judul>{isiTeks(T.judul, { nama: anggota?.nama ?? '' })}</Judul>
      <Kartu className="flex flex-col gap-4">
        <p className="text-2xl font-semibold">{T.tanya}</p>
        <Tombol ikon={Check} onClick={() => setLangkah('tips')}>{T.ya}</Tombol>
        <Tombol varian="sekunder" onClick={() => setLangkah('yakin')}>{T.bukan}</Tombol>
      </Kartu>
    </>
  )
}
