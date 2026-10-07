import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { KodeQr } from '../components/KodeQr.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { buatKodePerangkat } from '../lib/api.js'
import { petakanGalat } from '../lib/galat.js'
import { alamatKode, rapikanKode } from '../lib/kode.js'
import { useSesi } from '../lib/konteksSesi.js'
import { useSisaWaktu } from '../lib/useSisaWaktu.js'
import { sisaMenitDetik } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'

// Layar Tambah perangkat: kode dibuat begitu layar dibuka. Kode hanya ada di
// layar ini (tidak disimpan), berlaku 10 menit, dan sekali pakai.
export default function TambahPerangkat() {
  const { klien } = useSesi()
  const [kode, setKode] = useState(null) // { teks, berakhir }
  const [sedang, setSedang] = useState(false)
  const [galat, setGalat] = useState(null)
  const sudahMulai = useRef(false)
  const sisa = useSisaWaktu(kode?.berakhir)
  const T = teks.tambahPerangkat

  const buat = useCallback(async () => {
    setSedang(true)
    setGalat(null)
    try {
      const h = await buatKodePerangkat(klien)
      setKode({ teks: h.code, berakhir: h.expires_at })
    } catch (e) {
      setKode(null)
      setGalat(petakanGalat(e, { online: navigator.onLine }).pesan)
    }
    setSedang(false)
  }, [klien])

  useEffect(() => {
    if (sudahMulai.current) return
    sudahMulai.current = true
    buat()
  }, [buat])

  const habis = kode && sisa === 0
  return (
    <>
      <Judul>{T.judul}</Judul>
      <p className="text-xl">{T.isi}</p>
      {galat && <Pesan jenis="galat">{galat}</Pesan>}
      {sedang && !kode && <p role="status" className="text-lg">{T.membuat}</p>}
      {kode && !habis && (
        <>
          <KodeQr nilai={alamatKode(kode.teks)} label={T.qrLabel} />
          <div className="text-center">
            <p className="text-base text-redup">{T.kodeLabel}</p>
            <p
              aria-label={`${T.kodeLabel}: ${rapikanKode(kode.teks).split('').join(' ')}`}
              className="font-mono text-4xl font-bold tracking-widest"
            >
              {kode.teks}
            </p>
            <p className="text-lg" role="timer">
              {isiTeks(T.berlaku, { waktu: sisaMenitDetik(sisa ?? 0) })}
            </p>
          </div>
          <p className="text-lg">{T.hanyaSekali}</p>
          <p className="text-base text-redup">{T.iphone}</p>
        </>
      )}
      {habis && <Pesan jenis="peringatan">{T.habis}</Pesan>}
      {(habis || galat) && (
        <Tombol ikon={RefreshCw} disabled={sedang} onClick={buat}>
          {kode || !galat ? T.buatBaru : teks.umum.cobaLagi}
        </Tombol>
      )}
    </>
  )
}
