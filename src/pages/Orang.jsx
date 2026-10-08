import { useEffect, useRef } from 'react'
import { ArrowLeft, Network } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { GerbangData } from '../components/GerbangData.jsx'
import { KeteranganOrang } from '../components/orang/KeteranganOrang.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { labelDetail } from '../lib/silsilah/kartu.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { teks } from '../teks/id.js'

const T = teks.detail

// Nama sebagai judul layar (Cinzel, seperti di panel Bagan). Fokus pindah ke
// sini saat layar terbuka atau orangnya berganti.
function NamaJudul({ nama, id }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [id])
  return (
    <h1 ref={ref} tabIndex={-1} className="font-judul text-3xl font-bold uppercase leading-tight tracking-wide outline-none">
      {nama}
    </h1>
  )
}

function IsiOrang() {
  const { id } = useParams()
  const silsilah = useSilsilah()
  const orang = silsilah.graf.orang.get(id)
  const d = orang && (orang.tree_id ?? null) === null ? labelDetail(silsilah, id) : null
  if (!d) {
    return (
      <>
        <Judul>{T.judul}</Judul>
        <p className="text-xl">{T.tidakDitemukan}</p>
        <TautanTombol to="/daftar" ikon={ArrowLeft}>
          {T.kembaliKeDaftar}
        </TautanTombol>
      </>
    )
  }
  return (
    <>
      <Kartu>
        <KeteranganOrang d={d} tingkat={2} judul={<NamaJudul nama={d.nama} id={d.id} />} />
      </Kartu>
      <TautanTombol to={`/bagan?pilih=${encodeURIComponent(id)}`} varian="utama" ikon={Network}>
        {teks.bagan.lihatDiBagan}
      </TautanTombol>
      <TautanTombol to="/daftar" ikon={ArrowLeft}>
        {T.kembaliKeDaftar}
      </TautanTombol>
    </>
  )
}

export default function Orang() {
  return (
    <GerbangData>
      <IsiOrang />
    </GerbangData>
  )
}
