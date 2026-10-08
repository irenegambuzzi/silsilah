import { useMemo, useState } from 'react'
import { BarisOrang } from '../components/BarisOrang.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { cariDaftar, susunDaftar } from '../lib/silsilah/daftar.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { isiTeks, teks } from '../teks/id.js'

function IsiDaftar() {
  const silsilah = useSilsilah()
  const [kata, setKata] = useState('')
  const semua = useMemo(() => susunDaftar(silsilah), [silsilah])
  const tampil = useMemo(() => cariDaftar(semua, kata), [semua, kata])
  const jumlah = tampil.keturunan.length + tampil.pasangan.length
  const bagian = [
    [teks.daftar.keturunan, tampil.keturunan],
    [teks.daftar.pasangan, tampil.pasangan],
  ]
  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="cari-nama" className="text-lg font-semibold">
          {teks.daftar.cari}
        </label>
        <input
          id="cari-nama"
          type="search"
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          placeholder={teks.daftar.petunjukCari}
          autoComplete="off"
          className="isian text-lg"
        />
      </div>
      <p role="status" className="text-lg text-redup">
        {jumlah === 0 ? teks.daftar.tidakAda : isiTeks(teks.daftar.jumlah, { n: jumlah })}
      </p>
      {bagian.map(([judul, daftar]) =>
        daftar.length === 0 ? null : (
          <section key={judul} className="flex flex-col gap-3">
            <Subjudul>{judul}</Subjudul>
            <ul className="flex flex-col gap-3">
              {daftar.map((o) => (
                <BarisOrang key={o.id} orang={o} />
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  )
}

export default function Daftar() {
  return (
    <>
      <Judul>{teks.daftar.judul}</Judul>
      <GerbangData bagian>
        <IsiDaftar />
      </GerbangData>
    </>
  )
}
