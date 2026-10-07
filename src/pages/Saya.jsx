import { KeyRound, LogOut, ShieldCheck, Smartphone, Timer } from 'lucide-react'
import { PilihanUkuranHuruf, SakelarKontras } from '../components/PengaturanTampilan.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { bolehBeriAkses } from '../lib/api.js'
import { useSesi } from '../lib/konteksSesi.js'
import { teks } from '../teks/id.js'

// Layar Saya / Pengaturan (layar 20).
export default function Saya() {
  const T = teks.saya
  const { anggota, berakhir } = useSesi()
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
        {/* Perangkat dengan akses sementara tidak bisa menambah perangkat lain. */}
        {!berakhir && <TautanTombol to="/saya/tambah-perangkat" ikon={KeyRound}>{T.tambahPerangkat}</TautanTombol>}
        <TautanTombol to="/saya/perangkat" ikon={Smartphone}>{T.perangkatSaya}</TautanTombol>
      </Kartu>
      {bolehBeriAkses(anggota) && (
        <Kartu className="flex flex-col gap-3">
          <Subjudul>{T.admin}</Subjudul>
          <TautanTombol to="/admin/akses-sementara" ikon={Timer}>{T.aksesSementara}</TautanTombol>
        </Kartu>
      )}
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
