import { useMemo, useState } from 'react'
import { BarisOrang } from '../components/BarisOrang.jsx'
import { PitaFokus } from '../components/bagan/PitaFokus.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { cariDaftar, susunDaftar } from '../lib/silsilah/daftar.js'
import { useTampilanFokus } from '../lib/fokus/useTampilanFokus.js'
import { isiTeks, teks } from '../teks/id.js'

// Saat fokus cabang (lib/fokus, sama dengan Bagan): hanya anggota cabang itu,
// dengan label menurut cara hitung bagan saat itu, dan pita fokus yang sama.
function IsiDaftar() {
  const { fokus, cabang, sTampil, keluar, kembaliKeUtama } = useTampilanFokus()
  const [kata, setKata] = useState('')
  const semua = useMemo(() => {
    const daftar = susunDaftar(sTampil)
    if (!cabang) return daftar
    const di = (b) => cabang.anggota.has(b.id)
    return { keturunan: daftar.keturunan.filter(di), pasangan: daftar.pasangan.filter(di) }
  }, [sTampil, cabang])
  const tampil = useMemo(() => cariDaftar(semua, kata), [semua, kata])
  const jumlah = tampil.keturunan.length + tampil.pasangan.length
  const bagian = [
    [teks.daftar.keturunan, tampil.keturunan],
    [teks.daftar.pasangan, tampil.pasangan],
  ]
  return (
    <>
      {fokus && (
        <PitaFokus
          nama={cabang.nama}
          hitungCabang={fokus.hitung}
          saatKembali={kembaliKeUtama}
          saatKeluar={keluar}
          className="rounded-xl border border-tepi"
        />
      )}
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
        {jumlah === 0
          ? fokus
            ? isiTeks(teks.bagan.cariTidakAdaCabang, { nama: cabang.nama })
            : teks.daftar.tidakAda
          : isiTeks(teks.daftar.jumlah, { n: jumlah })}
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
