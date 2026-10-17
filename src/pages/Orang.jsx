import { useEffect, useRef } from 'react'
import { ArrowLeft, Network } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { GerbangData } from '../components/GerbangData.jsx'
import { PitaFokus } from '../components/bagan/PitaFokus.jsx'
import { KeteranganOrang } from '../components/orang/KeteranganOrang.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { labelDetail } from '../lib/silsilah/kartu.js'
import { alamatBagan } from '../lib/fokus/konteksFokus.js'
import { useTampilanFokus } from '../lib/fokus/useTampilanFokus.js'
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

// Saat fokus cabang (lib/fokus): pita fokus yang sama, label menurut cara
// hitung bagan saat itu, nama orang di luar cabang hanya teks biasa, dan
// "Lihat di bagan" tetap di cabang itu.
function IsiOrang() {
  const { id } = useParams()
  const { silsilah, fokus, cabang, sTampil, keluar, kembaliKeUtama } = useTampilanFokus()
  const orang = silsilah.graf.orang.get(id)
  const d = orang && (orang.tree_id ?? null) === null ? labelDetail(sTampil, id) : null
  const pita = fokus && (
    <PitaFokus
      nama={cabang.nama}
      hitungCabang={fokus.hitung}
      saatKembali={kembaliKeUtama}
      saatKeluar={keluar}
      className="rounded-xl border border-tepi"
    />
  )
  if (!d) {
    return (
      <>
        {pita}
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
      {pita}
      <Kartu>
        <KeteranganOrang
          d={d}
          tingkat={2}
          bisaDipilih={cabang ? (x) => cabang.anggota.has(x) : null}
          judul={<NamaJudul nama={d.nama} id={d.id} />}
        />
      </Kartu>
      <TautanTombol to={alamatBagan(fokus, { pilih: id })} varian="utama" ikon={Network}>
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
