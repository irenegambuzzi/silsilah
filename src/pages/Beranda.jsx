import { List, Network } from 'lucide-react'
import { GerbangData } from '../components/GerbangData.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { useDataSilsilah } from '../lib/data/konteksData.js'
import { useSesi } from '../lib/konteksSesi.js'
import { isiTeks, teks } from '../teks/id.js'

// Ringkasan: bahwa data silsilah sudah termuat, dan jumlah orangnya.
function RingkasanSilsilah() {
  const { data } = useDataSilsilah()
  const orang = data.people.filter((p) => (p.tree_id ?? null) === null).length
  return <p className="text-xl">{isiTeks(teks.beranda.ringkasan, { n: orang })}</p>
}

export default function Beranda() {
  const { anggota } = useSesi()
  return (
    <>
      <Judul>{teks.beranda.judul}</Judul>
      <p className="text-2xl font-semibold">{isiTeks(teks.beranda.sapa, { nama: anggota?.nama ?? '' })}</p>
      <GerbangData bagian>
        <RingkasanSilsilah />
      </GerbangData>
      <p className="text-xl">{teks.beranda.isi}</p>
      <TautanTombol to="/bagan" varian="utama" ikon={Network}>
        {teks.beranda.lihatBagan}
      </TautanTombol>
      <TautanTombol to="/daftar" varian="sekunder" ikon={List}>
        {teks.beranda.lihatDaftar}
      </TautanTombol>
    </>
  )
}
