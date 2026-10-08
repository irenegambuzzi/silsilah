import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Menu, Minus, Network, Plus, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { GambarBagan } from '../components/bagan/GambarBagan.jsx'
import { Legenda } from '../components/bagan/Legenda.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Tombol, TautanTombol } from '../components/ui/Tombol.jsx'
import { Avatar } from '../components/Avatar.jsx'
import { useDataSilsilah } from '../lib/data/konteksData.js'
import { susunBagan } from '../lib/bagan/susun.js'
import { tataBagan } from '../lib/bagan/tata.js'
import { useGeserZoom } from '../lib/bagan/useGeserZoom.js'
import { polos } from '../lib/silsilah/daftar.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { formatJam } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'

const T = teks.bagan
const BINGKAI = 'rounded-[14px] border border-t-[3px] border-tepi border-t-emas bg-kertas shadow-lembut'
const TOMBOL_KECIL =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-lg border-2 border-garis bg-latar px-3 text-lg font-semibold hover:border-emas hover:bg-kertas hover:text-emas-teks'
const TOMBOL_BULAT =
  'absolute z-20 flex size-12 items-center justify-center rounded-full border border-tepi bg-kertas text-emas-teks shadow-lembut hover:border-emas'

// Status kecil di bawah judul: apakah data yang tampil sudah yang terbaru.
function StatusData() {
  const { sumber, waktu, live } = useDataSilsilah()
  const [kelas, isi] =
    sumber === 'salinan'
      ? ['text-redup', T.statusSalinan]
      : live
        ? ['text-sukses', T.statusLive]
        : ['text-redup', isiTeks(T.statusDimuat, { jam: waktu ? formatJam(waktu) : '' })]
  return (
    <p className={`flex items-center gap-1.5 text-sm font-bold ${kelas}`}>
      <span aria-hidden="true">●</span>
      {isi}
    </p>
  )
}

// Semua kartu yang tampil, dalam urutan bagan (untuk pencarian).
function semuaKartu(akar) {
  const hasil = []
  const jalan = (s) => {
    hasil.push(s.kartu)
    for (const k of s.pasangan) {
      if (k.kartu && !hasil.some((x) => x.id === k.id)) hasil.push(k.kartu)
      k.anak.forEach(jalan)
    }
  }
  jalan(akar)
  return hasil
}

function Pencarian({ kartu, saatKetemu }) {
  const [kata, setKata] = useState('')
  const [hasil, setHasil] = useState(null)
  const kirim = (e) => {
    e.preventDefault()
    const cari = polos(kata.trim())
    if (!cari) return
    const cocok = kartu.filter((k) => polos(`${k.nama} ${k.panggilan ?? ''}`).includes(cari))
    if (cocok.length === 0) {
      setHasil({ teks: T.cariTidakAda })
      return
    }
    // Menekan Cari lagi dengan kata yang sama: ke hasil berikutnya.
    const ke = hasil?.kata === cari ? (hasil.ke + 1) % cocok.length : 0
    setHasil({ kata: cari, ke, teks: isiTeks(T.cariHasil, { ke: ke + 1, n: cocok.length, nama: cocok[ke].nama }) })
    saatKetemu(cocok[ke].id)
  }
  return (
    <form role="search" onSubmit={kirim} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <label htmlFor="cari-bagan" className="sr-only">
          {T.cari}
        </label>
        <input
          id="cari-bagan"
          type="search"
          value={kata}
          onChange={(e) => {
            setKata(e.target.value)
            setHasil(null)
          }}
          placeholder={T.petunjukCari}
          autoComplete="off"
          className="isian w-full min-w-0 sm:w-48"
        />
        <button type="submit" className={TOMBOL_KECIL} aria-label={T.cari}>
          <Search aria-hidden="true" className="size-5" />
        </button>
      </div>
      <p role="status" className="text-sm text-redup">
        {hasil?.teks ?? ''}
      </p>
    </form>
  )
}

// Bilah atas yang melayang di kiri atas, seperti aplikasi lama.
function BilahAtas({ kartu, aksi, saatKetemu, fokus, saatTutup }) {
  return (
    <div className={`absolute left-3 right-3 top-3 z-20 flex flex-col gap-3 p-4 pr-14 sm:right-auto sm:max-w-[calc(100%-1.5rem)] ${BINGKAI}`}>
      <button
        type="button"
        onClick={saatTutup}
        aria-label={T.sembunyikanMenu}
        className="absolute right-1 top-1 flex size-12 items-center justify-center rounded-lg text-redup hover:text-emas-teks"
      >
        <X aria-hidden="true" className="size-6" />
      </button>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <div>
          <Judul className="text-lg! uppercase tracking-wider sm:text-xl!">{teks.aplikasi.nama}</Judul>
          <p className="text-xs font-semibold uppercase tracking-widest text-redup">{teks.aplikasi.subjudul}</p>
          <StatusData />
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Pencarian kartu={kartu} saatKetemu={saatKetemu} />
          <div className="flex gap-2">
            <button type="button" className={TOMBOL_KECIL} onClick={aksi.perbesar} aria-label={T.perbesar}>
              <Plus aria-hidden="true" className="size-5" />
            </button>
            <button type="button" className={TOMBOL_KECIL} onClick={aksi.perkecil} aria-label={T.perkecil}>
              <Minus aria-hidden="true" className="size-5" />
            </button>
            <button type="button" className={TOMBOL_KECIL} onClick={aksi.pas}>
              {T.pusatkan}
            </button>
          </div>
        </div>
      </div>
      {fokus}
    </div>
  )
}

// Panel keterangan di sisi kanan (di HP: lembar dari bawah).
function PanelOrang({ kartu, bisaFokus, saatFokus, saatTutup }) {
  const judul = useRef(null)
  useEffect(() => {
    judul.current?.focus({ preventScroll: true })
  }, [kartu.id])
  return (
    <section
      aria-label={T.panel}
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[80%] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-tepi bg-kertas p-6 shadow-lembut md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0"
    >
      <button
        type="button"
        onClick={saatTutup}
        aria-label={T.tutup}
        className="absolute right-2 top-2 flex size-12 items-center justify-center rounded-lg text-redup hover:text-emas-teks"
      >
        <X aria-hidden="true" className="size-7" />
      </button>
      <Avatar sex={kartu.sex} />
      <h2 ref={judul} tabIndex={-1} className="text-center font-judul text-2xl font-bold uppercase leading-tight outline-none">
        {kartu.nama}
      </h2>
      <div className="flex flex-col gap-2">
        <TautanTombol to={`/orang/${encodeURIComponent(kartu.id)}`} varian="utama">
          {T.bukaKeterangan}
        </TautanTombol>
        {bisaFokus && (
          <Tombol varian="sekunder" ikon={Network} onClick={saatFokus}>
            {T.fokusCabang}
          </Tombol>
        )}
      </div>
    </section>
  )
}

function IsiBagan() {
  const silsilah = useSilsilah()
  const bagan = useMemo(() => susunBagan(silsilah), [silsilah])
  const [params, setParams] = useSearchParams()
  const [terpilih, setTerpilih] = useState(params.get('pilih'))
  const [bilah, setBilah] = useState(true)

  const fokusId = bagan && bagan.simpul.has(params.get('fokus')) ? params.get('fokus') : null
  const akar = useMemo(() => (bagan ? (fokusId ? bagan.simpul.get(fokusId) : bagan.akar) : null), [bagan, fokusId])
  const tata = useMemo(() => (akar ? tataBagan(akar) : null), [akar])
  const pusat = fokusId ? null : params.get('pilih')
  const { pandang, props, isi, aksi } = useGeserZoom({ kunci: fokusId ?? '', pusat })
  const kartu = useMemo(() => (akar ? semuaKartu(akar) : []), [akar])

  if (!bagan) {
    return (
      <div className="p-5">
        <Judul>{teks.aplikasi.nama}</Judul>
        <p className="text-xl">{T.tanpaPangkal}</p>
      </div>
    )
  }

  const kartuTerpilih = terpilih ? kartu.find((k) => k.id === terpilih) ?? null : null
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
  const lompat = (id) => {
    setTerpilih(id)
    aksi.pusatkanKe(id)
  }

  const fokus = fokusId && (
    <div className="flex flex-col gap-2 border-t border-tepi pt-3">
      <p className="text-lg font-semibold">{isiTeks(T.fokusJudul, { nama: akar.kartu.nama })}</p>
      <div className="flex flex-wrap gap-2">
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
  )

  return (
    <>
      <div
        {...props}
        role="group"
        aria-label={T.bingkai}
        tabIndex={0}
        className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      >
        <div
          ref={isi}
          className="absolute left-0 top-0 w-max origin-top-left p-4"
          style={{ transform: `translate(${pandang.x}px, ${pandang.y}px) scale(${pandang.k})` }}
        >
          <GambarBagan akar={akar} tata={tata} terpilih={terpilih} saatKetuk={(id) => setTerpilih((x) => (x === id ? null : id))} />
        </div>
      </div>
      {bilah ? (
        <BilahAtas kartu={kartu} aksi={aksi} saatKetemu={lompat} fokus={fokus} saatTutup={() => setBilah(false)} />
      ) : (
        <>
          <h1 className="sr-only">{teks.aplikasi.nama}</h1>
          <button type="button" onClick={() => setBilah(true)} aria-label={T.tampilkanMenu} className={`${TOMBOL_BULAT} left-3 top-3`}>
            <Menu aria-hidden="true" className="size-6" />
          </button>
        </>
      )}
      <Legenda bingkai={BINGKAI} tombolBulat={TOMBOL_BULAT} />
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
    <div className="bagan-latar relative h-full min-h-[24rem] overflow-hidden">
      <GerbangData bagian>
        <IsiBagan />
      </GerbangData>
    </div>
  )
}
