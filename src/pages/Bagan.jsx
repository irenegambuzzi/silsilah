import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Maximize, Minus, Plus, Network, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { BlokKeluarga } from '../components/bagan/BlokKeluarga.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Tombol, TautanTombol } from '../components/ui/Tombol.jsx'
import { susunBagan } from '../lib/bagan/susun.js'
import { useGeserZoom } from '../lib/bagan/useGeserZoom.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { isiTeks, teks } from '../teks/id.js'

const T = teks.bagan

// Panel di atas menu bawah: orang yang diketuk, dengan pilihan membuka
// keterangan lengkap atau memfokuskan cabangnya.
function PanelOrang({ kartu, bisaFokus, saatFokus, saatTutup }) {
  const judul = useRef(null)
  useEffect(() => {
    judul.current?.focus({ preventScroll: true })
  }, [kartu.id])
  return (
    <Kartu
      aria-label={T.panel}
      className="fixed inset-x-3 bottom-20 z-10 mx-auto flex max-w-xl flex-col gap-3 shadow-lg"
    >
      <h2 ref={judul} tabIndex={-1} className="text-xl font-bold outline-none">
        {kartu.nama}
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TautanTombol to={`/orang/${encodeURIComponent(kartu.id)}`} varian="utama">
          {T.bukaKeterangan}
        </TautanTombol>
        {bisaFokus && (
          <Tombol varian="sekunder" ikon={Network} onClick={saatFokus}>
            {T.fokusCabang}
          </Tombol>
        )}
        <Tombol varian="tautan" ikon={X} onClick={saatTutup}>
          {T.tutup}
        </Tombol>
      </div>
    </Kartu>
  )
}

function IsiBagan() {
  const silsilah = useSilsilah()
  const bagan = useMemo(() => susunBagan(silsilah), [silsilah])
  const [params, setParams] = useSearchParams()
  const [terpilih, setTerpilih] = useState(params.get('pilih'))

  const fokusId = bagan && bagan.simpul.has(params.get('fokus')) ? params.get('fokus') : null
  const akar = bagan ? (fokusId ? bagan.simpul.get(fokusId) : bagan.akar) : null
  const pusat = fokusId ? null : params.get('pilih')
  const { pandang, props, isi, aksi } = useGeserZoom({ kunci: fokusId ?? '', pusat })

  if (!bagan) return <p className="text-xl">{T.tanpaPangkal}</p>

  const kartuTerpilih = terpilih
    ? [...bagan.simpul.values()]
        .flatMap((s) => [s.kartu, ...s.pasangan.map((p) => p.kartu)])
        .find((k) => k.id === terpilih)
    : null
  // Cabang yang bisa difokuskan: keturunan itu sendiri, atau (untuk pasangan
  // yang bukan keturunan) cabang pasangannya.
  const cabang = kartuTerpilih ? (bagan.simpul.has(kartuTerpilih.id) ? kartuTerpilih.id : bagan.tempat.get(kartuTerpilih.id)) : null

  const ubah = (kunci, nilai) => {
    const baru = new URLSearchParams(params)
    if (nilai) baru.set(kunci, nilai)
    else baru.delete(kunci)
    baru.delete('pilih')
    setParams(baru, { replace: true })
  }
  const indukId = fokusId ? bagan.induk.get(fokusId) : null

  return (
    <>
      <details className="text-lg">
        <summary className="flex min-h-12 cursor-pointer items-center font-semibold underline">{T.caraPakai}</summary>
        <p className="text-redup">{T.petunjuk}</p>
      </details>
      {fokusId && (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold">{isiTeks(T.fokusJudul, { nama: akar.kartu.nama })}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Tombol varian="sekunder" onClick={() => ubah('fokus', null)}>
              {T.tampilkanSemua}
            </Tombol>
            {indukId && (
              <Tombol varian="sekunder" ikon={ArrowUp} onClick={() => ubah('fokus', indukId)}>
                {isiTeks(T.naikKe, { nama: bagan.simpul.get(indukId).kartu.nama })}
              </Tombol>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          [Plus, T.perbesar, aksi.perbesar],
          [Minus, T.perkecil, aksi.perkecil],
          [Maximize, T.pas, aksi.pas],
        ].map(([Ikon, nama, saatKlik]) => (
          <button
            key={nama}
            type="button"
            onClick={saatKlik}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-garis bg-kertas px-1 py-2 text-center text-base font-semibold leading-tight"
          >
            <Ikon aria-hidden="true" className="size-6 shrink-0" />
            {nama}
          </button>
        ))}
      </div>
      <div
        {...props}
        role="group"
        aria-label={T.bingkai}
        tabIndex={0}
        className="relative h-[65vh] min-h-96 touch-none select-none overflow-hidden rounded-2xl border-2 border-garis bg-latar"
      >
        <div
          ref={isi}
          className="absolute left-0 top-0 w-max origin-top-left p-4"
          style={{ transform: `translate(${pandang.x}px, ${pandang.y}px) scale(${pandang.k})` }}
        >
          <ul>
            <BlokKeluarga simpul={akar} terpilih={terpilih} saatKetuk={(id) => setTerpilih((x) => (x === id ? null : id))} />
          </ul>
        </div>
      </div>
      {kartuTerpilih && (
        <PanelOrang
          kartu={kartuTerpilih}
          bisaFokus={Boolean(cabang) && cabang !== fokusId}
          saatFokus={() => {
            setTerpilih(null)
            ubah('fokus', cabang)
          }}
          saatTutup={() => setTerpilih(null)}
        />
      )}
    </>
  )
}

export default function Bagan() {
  return (
    <>
      <Judul>{T.judul}</Judul>
      <GerbangData bagian>
        <IsiBagan />
      </GerbangData>
    </>
  )
}
