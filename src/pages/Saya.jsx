import { KeyRound, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import { PilihanUkuranHuruf, SakelarKontras } from '../components/PengaturanTampilan.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { teks } from '../teks/id.js'

// Layar Saya / Pengaturan (layar 20).
export default function Saya() {
  const T = teks.saya
  return (
    <>
      <Judul>{T.judul}</Judul>
      <Kartu className="flex flex-col gap-4">
        <Subjudul>{T.tampilan}</Subjudul>
        <PilihanUkuranHuruf />
        <SakelarKontras />
      </Kartu>
      <Kartu className="flex flex-col gap-3">
        <Subjudul>{T.perangkat}</Subjudul>
        <TautanTombol to="/saya/tambah-perangkat" ikon={KeyRound}>{T.tambahPerangkat}</TautanTombol>
        <TautanTombol to="/saya/perangkat" ikon={Smartphone}>{T.perangkatSaya}</TautanTombol>
      </Kartu>
      <Kartu className="flex flex-col gap-3">
        <Subjudul>{T.informasi}</Subjudul>
        <TautanTombol to="/privasi" ikon={ShieldCheck}>{T.privasi}</TautanTombol>
      </Kartu>
      <Kartu className="flex flex-col gap-3">
        <Subjudul>{T.akun}</Subjudul>
        <TautanTombol to="/saya/keluar" ikon={LogOut}>{T.keluar}</TautanTombol>
      </Kartu>
    </>
  )
}
