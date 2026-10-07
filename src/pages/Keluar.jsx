import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Judul } from '../components/ui/Judul.jsx'
import { Tombol, TautanTombol } from '../components/ui/Tombol.jsx'
import { useSesi } from '../lib/konteksSesi.js'
import { teks } from '../teks/id.js'

// Keluar dari perangkat ini atau dari semua perangkat. Data di perangkat
// ini dihapus; setelah itu aplikasi kembali ke layar Masuk.
export default function Keluar() {
  const { keluar } = useSesi()
  const [sedang, setSedang] = useState(false)
  const T = teks.keluar
  const jalankan = async (semua) => {
    setSedang(true)
    await keluar({ semua })
  }
  return (
    <>
      <Judul>{T.judul}</Judul>
      <p className="text-xl">{T.isi}</p>
      <Tombol ikon={LogOut} disabled={sedang} onClick={() => jalankan(false)}>
        {sedang ? T.sedang : T.iniSaja}
      </Tombol>
      <p className="text-lg">{T.semuaIsi}</p>
      <Tombol varian="bahaya" ikon={LogOut} disabled={sedang} onClick={() => jalankan(true)}>
        {T.semua}
      </Tombol>
      <TautanTombol to="/saya" varian="tautan">{T.batal}</TautanTombol>
    </>
  )
}
