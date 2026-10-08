import { ArrowLeft, Network } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { TautanTombol } from '../components/ui/Tombol.jsx'
import { labelDetail } from '../lib/silsilah/kartu.js'
import { labelGen } from '../lib/silsilah/generasi.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { isiTeks, teks } from '../teks/id.js'

const T = teks.detail
const ke = (id) => `/orang/${encodeURIComponent(id)}`

const Tautan = ({ id, children }) => (
  <Link to={ke(id)} className="font-semibold underline">
    {children}
  </Link>
)

function Baris({ nama, children }) {
  if (!children) return null
  return (
    <div>
      <dt className="text-base text-redup">{nama}</dt>
      <dd className="text-xl">{children}</dd>
    </div>
  )
}

// Orang tua: kalau kedua-duanya keturunan pangkal (pernikahan antarsepupu),
// KEDUA jalur ditampilkan, yang terdekat ke pangkal lebih dulu.
function OrangTua({ d }) {
  if (d.jalur.length === 0 && d.orangTuaLain.length === 0) return null
  const dua = d.jalur.length > 1
  const gen0 = d.jalur[0]?.gen
  return (
    <Kartu className="flex flex-col gap-3">
      <Subjudul>{T.orangTua}</Subjudul>
      {dua && <p className="text-lg">{T.duaJalur}</p>}
      <ul className="flex flex-col gap-3">
        {d.jalur.map((j) => (
          <li key={j.orangTuaId} className="flex flex-col gap-1 rounded-xl border-2 border-garis p-3">
            {dua && (
              <span className="text-base font-semibold text-redup">
                {j.terdekat ? T.jalurTerdekat : j.gen === gen0 ? T.jalurSamaDekat : T.jalurLain}
              </span>
            )}
            <span className="text-xl">
              <Tautan id={j.orangTuaId}>{j.orangTua}</Tautan>
            </span>
            {j.keterangan && <span className="text-lg">{j.keterangan}</span>}
            {dua && <span className="text-base">{isiTeks(T.lewatJalurIni, { gen: labelGen(j.gen) })}</span>}
            {j.jenis && <span className="text-base">{j.jenis}</span>}
          </li>
        ))}
      </ul>
      {d.orangTuaLain.length > 0 && (
        <div>
          <p className="text-base text-redup">{T.orangTuaLain}</p>
          <ul className="text-xl">
            {d.orangTuaLain.map((o) => (
              <li key={o.id}>
                <Tautan id={o.id}>{o.nama}</Tautan>
                {o.jenis ? ` · ${o.jenis}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Kartu>
  )
}

function Pernikahan({ d }) {
  if (d.pernikahan.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <Subjudul>{T.pernikahan}</Subjudul>
      {d.pernikahan.map((p) => (
        <Kartu key={p.unionId} className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold">{isiTeks(T.pernikahanKe, { n: p.ke })}</h3>
          <p className="text-xl">
            {p.pasanganId ? (
              <>
                {T.dengan}{' '}
                <Tautan id={p.pasanganId}>{p.pasangan}</Tautan>
              </>
            ) : (
              T.pasanganTidakDiketahui
            )}
            {p.pasanganKe ? ` (${p.pasanganKe})` : ''}
          </p>
          <p className="text-lg">
            {[p.status, p.menikah && `${T.menikah} ${p.menikah}`, p.berakhir && `${T.berakhir} ${p.berakhir}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-base text-redup">{T.anak}</p>
          {p.anak.length === 0 ? (
            <p className="text-lg">{T.belumAdaAnak}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xl">
              {p.anak.map((a) => (
                <li key={a.id}>
                  <Tautan id={a.id}>{a.nama}</Tautan>
                  {[a.anakKe != null && isiTeks(T.anakKe, { n: a.anakKe }), a.jenis]
                    .filter(Boolean)
                    .map((x) => ` · ${x}`)
                    .join('')}
                </li>
              ))}
            </ul>
          )}
        </Kartu>
      ))}
    </section>
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
      <Judul>{d.nama}</Judul>
      <Kartu>
        <dl className="flex flex-col gap-3">
          <Baris nama={T.panggilan}>{d.panggilan}</Baris>
          <Baris nama={T.generasi}>{d.generasi}</Baris>
          <Baris nama={T.nomor}>{d.nomor}</Baris>
          <Baris nama={T.keterangan}>{d.keteranganPasangan}</Baris>
          <Baris nama={T.lahir}>{d.lahir}</Baris>
          <Baris nama={T.wafat}>{d.wafat}</Baris>
          <Baris nama={T.pekerjaan}>{d.pekerjaan}</Baris>
          <Baris nama={T.catatan}>{d.catatan}</Baris>
        </dl>
      </Kartu>
      <OrangTua d={d} />
      <Pernikahan d={d} />
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
