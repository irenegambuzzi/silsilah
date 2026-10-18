import { useEffect, useMemo, useRef, useState } from 'react'
import { Expand, LogOut, Menu, Minus, Network, Plus, Search, X } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { GambarBagan } from '../components/bagan/GambarBagan.jsx'
import { Legenda } from '../components/bagan/Legenda.jsx'
import { PitaFokus } from '../components/bagan/PitaFokus.jsx'
import { GerbangData } from '../components/GerbangData.jsx'
import { PilihanTampilan } from '../components/PilihanTampilan.jsx'
import { Judul } from '../components/ui/Judul.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { KeteranganOrang } from '../components/orang/KeteranganOrang.jsx'
import { useDataSilsilah } from '../lib/data/konteksData.js'
import { kartuDiBagan, susunBagan } from '../lib/bagan/susun.js'
import { tampilanCabang } from '../lib/bagan/cabang.js'
import { useFokusCabang } from '../lib/fokus/konteksFokus.js'
import { tataBagan } from '../lib/bagan/tata.js'
import { useGeserZoom } from '../lib/bagan/useGeserZoom.js'
import { cocokOrang, siapkanPencarian } from '../lib/silsilah/cari.js'
import { keteranganCari, labelDetail } from '../lib/silsilah/kartu.js'
import { useSilsilah } from '../lib/silsilah/useSilsilah.js'
import { formatJam } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'

const T = teks.bagan
const BINGKAI = 'rounded-[14px] border border-t-[3px] border-tepi border-t-emas bg-kertas shadow-lembut'
const TOMBOL_KECIL =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-lg border-2 border-garis bg-latar px-3 text-lg font-semibold hover:border-emas hover:bg-kertas hover:text-emas-teks'
const TOMBOL_BULAT =
  'absolute z-20 flex size-12 items-center justify-center rounded-full border border-tepi bg-kertas text-emas-teks shadow-lembut hover:border-emas'

// Bagian bingkai yang tertutup panel keterangan saat panel terbuka: di
// layar lebar panel di kanan (lebarnya diukur dari `pengukur`, 26rem), di HP
// lembar dari bawah (± separuh tinggi layar).
function bagianTertutupPanel(pengukur) {
  if (typeof window === 'undefined' || !window.matchMedia) return {}
  return window.matchMedia('(min-width: 768px)').matches
    ? { kanan: pengukur?.offsetWidth ?? 0 }
    : { bawah: window.innerHeight * 0.45 }
}

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

// Pencarian di bilah atas (PLAN.md 15.2; pencocokan di cari.js). Daftar hasil
// langsung muncul saat mengetik dan memuat SEMUA yang cocok, masing-masing
// dengan keterangan pembeda (kartu.js, keteranganCari), termasuk nama
// panggilannya kalau ada ("putri Harvel (suami Kirana) · panggilan: Ovi").
// Saat fokus cabang (`namaCabang`), `kartu` hanya kartu di cabang itu: tidak
// ada hasil dari luar cabang (putaran ketujuh); kalau tidak ada yang cocok,
// pesannya menyebut cabang itu dan cara mencari di seluruh silsilah.
// Memilih hasil (ketuk, atau panah lalu Enter) memindahkan Bagan ke kartunya
// dan menyorotnya. Enter atau tombol cari berulang: hasil berikutnya
// ("2 dari 5"), sesudah yang terakhir kembali ke yang pertama. Esc menutup
// daftar; Esc sekali lagi mengosongkan kolom. Kolom kosong: daftar dan
// sorotan hilang. Semuanya dari data di perangkat (tanpa jaringan, tanpa
// data kontak).
function Pencarian({ kartu, namaCabang, keterangan, saatKetemu, saatKosong }) {
  const [kata, setKata] = useState('')
  // Hasil yang sedang disorot, menurut id: tetap benar walaupun daftarnya
  // berubah (misalnya sesudah keluar dari fokus cabang).
  const [pilihanId, setPilihanId] = useState(null)
  const [aktifMentah, setAktif] = useState(null) // pilihan dengan panah di daftar
  const [buka, setBuka] = useState(false)
  const kolom = useRef(null)
  const daftar = useRef(null)
  const cocok = useMemo(() => {
    const pencarian = siapkanPencarian(kata)
    if (!pencarian) return null
    return kartu.flatMap((k) => {
      const c = cocokOrang(pencarian, k)
      return c ? [{ ...k, lewat: c.lewat, keterangan: keterangan(k.id) }] : []
    })
  }, [kata, kartu, keterangan])
  const nPilihan = cocok?.length ?? 0
  const ada = nPilihan > 0
  const terbuka = buka && ada
  const indeks = cocok ? cocok.findIndex((h) => h.id === pilihanId) : -1
  const ke = indeks < 0 ? null : indeks
  const aktif = aktifMentah !== null && aktifMentah < nPilihan ? aktifMentah : null

  useEffect(() => {
    if (aktif === null) return
    daftar.current?.querySelector(`#cari-hasil-${aktif}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [aktif])

  const tulis = (nilai) => {
    setKata(nilai)
    setPilihanId(null)
    setAktif(null)
    setBuka(true)
    if (!siapkanPencarian(nilai)) saatKosong()
  }
  const pilih = (i) => {
    setPilihanId(cocok[i].id)
    setAktif(i)
    setBuka(false)
    saatKetemu(cocok[i].id)
  }
  // Enter / tombol cari: pilihan dengan panah kalau ada, selain itu hasil berikutnya.
  const berikutnya = () => {
    if (!ada) return
    pilih(aktif !== null && aktif !== ke ? aktif : ke === null ? 0 : (ke + 1) % cocok.length)
  }
  const tombol = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!ada) return
      e.preventDefault()
      if (!terbuka) {
        setBuka(true)
        setAktif(ke ?? 0)
        return
      }
      const n = nPilihan
      const dari = aktif ?? ke ?? (e.key === 'ArrowDown' ? -1 : 0)
      setAktif((dari + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (terbuka) setBuka(false)
      else if (kata) tulis('')
    }
  }
  const status =
    cocok === null
      ? ''
      : cocok.length === 0
        ? namaCabang
          ? isiTeks(T.cariTidakAdaCabang, { nama: namaCabang })
          : T.cariTidakAda
        : ke !== null && cocok[ke]
          ? isiTeks(T.cariHasil, { ke: ke + 1, n: cocok.length, nama: cocok[ke].nama }) +
            (cocok[ke].keterangan ? ` · ${cocok[ke].keterangan}` : '')
          : isiTeks(T.cariJumlah, { n: cocok.length })
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        berikutnya()
      }}
      className="relative flex flex-col gap-1"
    >
      <div className="flex gap-2">
        <label htmlFor="cari-bagan" className="sr-only">
          {T.cari}
        </label>
        <input
          ref={kolom}
          id="cari-bagan"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={terbuka}
          aria-controls="cari-hasil"
          aria-activedescendant={terbuka && aktif !== null ? `cari-hasil-${aktif}` : undefined}
          aria-describedby="cari-status"
          value={kata}
          onChange={(e) => tulis(e.target.value)}
          onKeyDown={tombol}
          onFocus={() => setBuka(true)}
          onBlur={() => setBuka(false)}
          placeholder={T.petunjukCari}
          autoComplete="off"
          enterKeyHint="search"
          className="isian w-full min-w-0 sm:w-56"
        />
        <button type="submit" className={TOMBOL_KECIL} aria-label={T.cari}>
          <Search aria-hidden="true" className="size-5" />
        </button>
      </div>
      {terbuka && (
        <ul
          ref={daftar}
          id="cari-hasil"
          role="listbox"
          aria-label={T.cariDaftar}
          className="absolute left-0 top-14 z-30 flex max-h-[min(24rem,50dvh)] w-[min(26rem,calc(100vw-3.5rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-tepi bg-kertas py-1 shadow-lembut"
        >
          {cocok.map((h, i) => (
            <li
              key={h.id}
              id={`cari-hasil-${i}`}
              role="option"
              aria-selected={i === aktif}
              data-hasil={h.id}
              // Tetap di kolom cari (mouse); di HP papan ketik ditutup supaya bagan terlihat.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                pilih(i)
                if (window.matchMedia?.('(pointer: coarse)').matches) kolom.current?.blur()
              }}
              className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 ${i === aktif ? 'bg-latar outline-2 -outline-offset-2 outline-emas' : 'hover:bg-latar'}`}
            >
              <span className="font-semibold">{h.nama}</span>
              <span className="text-sm text-redup">
                {h.keterangan}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* Saat daftar terbuka, jumlahnya hanya untuk pembaca layar (daftarnya sudah terlihat). */}
      <p id="cari-status" role="status" className={terbuka ? 'sr-only' : 'text-sm text-redup'}>
        {status}
      </p>
    </form>
  )
}

// Bilah atas yang melayang di kiri atas, seperti aplikasi lama (di bawah
// pita fokus kalau ada).
function BilahAtas({ kartu, namaCabang, keterangan, aksi, saatKetemu, saatKosong, fokus, saatTutup, ref }) {
  return (
    <div ref={ref} className={`pointer-events-auto relative mx-3 mt-3 flex flex-col gap-3 p-4 pr-14 sm:mr-auto sm:pr-16 sm:max-w-[calc(100%-1.5rem)] ${BINGKAI}`}>
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
          <Pencarian kartu={kartu} namaCabang={namaCabang} keterangan={keterangan} saatKetemu={saatKetemu} saatKosong={saatKosong} />
          {/* "Bagan | Daftar" (putaran 8a): di HP baris sendiri di bawah
              pencarian, supaya kolom cari tidak menyempit; di layar lebar
              di sebelahnya. */}
          <PilihanTampilan aktif="bagan" className="w-full sm:w-auto" />
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
          {/* Di HP tampilan awal tidak memperkecil seluruh pohon; tombol ini menampilkannya. */}
          <button type="button" className={`${TOMBOL_KECIL} sm:hidden`} onClick={aksi.seluruh}>
            <Expand aria-hidden="true" className="size-5" />
            {T.lihatSeluruh}
          </button>
        </div>
      </div>
      {fokus}
    </div>
  )
}

// Panel keterangan di sisi kanan (di HP: lembar dari bawah), berisi
// keterangan lengkap dalam format aplikasi lama. "Fokus pada cabang ini"
// menawarkan dua pilihan: generasi dihitung dari pangkal utama, atau dari
// orang yang difokuskan (`namaCabang`).
function PanelOrang({ d, bisaFokus, namaCabang, saatFokus, saatPilih, bisaDipilih, saatTutup }) {
  const judul = useRef(null)
  const [pilihHitung, setPilihHitung] = useState(false)
  useEffect(() => {
    judul.current?.focus({ preventScroll: true })
    setPilihHitung(false)
  }, [d.id])
  return (
    <section
      aria-label={T.panel}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[80%] overflow-y-auto rounded-t-2xl border border-tepi bg-kertas p-6 pt-8 shadow-lembut md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0"
    >
      <button
        type="button"
        onClick={saatTutup}
        aria-label={T.tutup}
        className="absolute right-2 top-2 flex size-12 items-center justify-center rounded-lg text-redup hover:text-emas-teks"
      >
        <X aria-hidden="true" className="size-7" />
      </button>
      <KeteranganOrang
        d={d}
        saatPilih={saatPilih}
        bisaDipilih={bisaDipilih}
        judul={
          <h2 ref={judul} tabIndex={-1} className="font-judul text-2xl font-bold uppercase leading-tight outline-none">
            {d.nama}
          </h2>
        }
        aksi={
          bisaFokus &&
          (pilihHitung ? (
            <div role="group" aria-label={T.fokusCabang} className="flex w-full flex-col gap-2">
              <p className="font-semibold">{T.hitungJudul}</p>
              <Tombol varian="sekunder" ikon={Network} onClick={() => saatFokus(false)}>
                {T.hitungUtama}
              </Tombol>
              <Tombol varian="sekunder" ikon={Network} onClick={() => saatFokus(true)}>
                {isiTeks(T.hitungDari, { nama: namaCabang })}
              </Tombol>
            </div>
          ) : (
            <Tombol varian="sekunder" ikon={Network} onClick={() => setPilihHitung(true)}>
              {T.fokusCabang}
            </Tombol>
          ))
        }
      />
    </section>
  )
}

function IsiBagan() {
  const silsilah = useSilsilah()
  const bagan = useMemo(() => susunBagan(silsilah), [silsilah])
  const [params, setParams] = useSearchParams()
  const lokasi = useLocation()
  const navigasi = useNavigate()
  // Masuk ke mode fokus selalu menambah satu langkah di riwayat browser, jadi
  // tombol Kembali di browser keluar dari fokus (state.masukFokus menandai
  // langkah itu). Perpindahan di dalam mode fokus menggantikan langkah itu.
  const [terpilih, setTerpilih] = useState(params.get('pilih'))
  const [bilah, setBilah] = useState(true)
  const pengukur = useRef(null)
  const atasRef = useRef(null)
  const legendaRef = useRef(null)

  const fokusId = bagan && bagan.simpul.has(params.get('fokus')) ? params.get('fokus') : null
  // "Hitung dari [nama]": GEN dan istilah Jawa dihitung ulang dari orang itu.
  const hitungCabang = Boolean(fokusId) && params.get('hitung') === 'cabang'
  // Mode fokus (bagan/cabang.js): bagan dimulai dari orang itu dengan SEMUA
  // keturunannya, dan aplikasi berperilaku seolah hanya cabang itu yang ada.
  const cabangTampil = useMemo(
    () => (fokusId ? tampilanCabang(silsilah, fokusId, hitungCabang) : null),
    [silsilah, fokusId, hitungCabang]
  )
  const sTampil = cabangTampil?.sTampil ?? silsilah
  const akar = (cabangTampil?.bagan ?? bagan)?.akar ?? null
  // Fokus ini juga berlaku di Daftar dan halaman orang (lib/fokus).
  const { setFokus } = useFokusCabang()
  useEffect(() => {
    setFokus(fokusId ? { id: fokusId, hitung: hitungCabang } : null)
  }, [fokusId, hitungCabang, setFokus])
  const tata = useMemo(() => (akar ? tataBagan(akar) : null), [akar])
  const pusat = fokusId ? null : params.get('pilih')
  // Bagian bingkai yang tertutup bilah atas dan legenda (tampilan awal).
  const halangan = (kotak) => {
    const hasil = {}
    const a = atasRef.current?.getBoundingClientRect()
    if (a?.height) hasil.atas = a.bottom - kotak.top
    const l = legendaRef.current?.getBoundingClientRect()
    if (l?.height) hasil.legenda = { lebar: l.right - kotak.left, tinggi: kotak.bottom - l.top }
    return hasil
  }
  const pangkal = akar ? [akar.id, akar.pasangan[0]?.id].filter(Boolean) : []
  const { pandang, props, isi, aksi } = useGeserZoom({ kunci: `${fokusId ?? ''}|${hitungCabang}`, pusat, pangkal, halangan })
  // Kartu utama yang tampil (pencarian dan panel). Saat fokus: hanya cabang
  // itu; pencarian tidak pernah mencari di luarnya. Kartu "Dari cabang lain"
  // (`rujukan`) di luar cabang hanya bisa dibuka panelnya.
  const kartu = useMemo(() => cabangTampil?.kartu ?? (akar ? kartuDiBagan(akar).utama : []), [cabangTampil, akar])
  const rujukan = cabangTampil?.rujukan ?? []
  const anggota = cabangTampil?.anggota ?? null
  // Istilah generasi di hasil pencarian sama dengan di kartu (cara hitung saat itu).
  const keterangan = useMemo(() => (id) => keteranganCari(silsilah, id, { tampil: sTampil }), [silsilah, sTampil])
  // Kartu yang disorot pencarian (tanpa membuka panel, supaya di HP kartu dan
  // "2 dari 5" tetap terlihat; mengetuk kartunya membuka panel).
  const [sorot, setSorot] = useState(null)
  const langkahFokus = Boolean(lokasi.state?.masukFokus)
  // Masuk ke alamat yang sudah berisi fokus (tautan dari Daftar atau halaman
  // orang; saat aplikasi dibuka baru fokus sudah dibuang, main.jsx): sisipkan
  // bagan lengkap di riwayat, supaya Kembali juga keluar dari fokus.
  useEffect(() => {
    if (!fokusId || langkahFokus) return
    const tanpa = new URLSearchParams(params)
    tanpa.delete('fokus')
    tanpa.delete('hitung')
    navigasi({ search: tanpa.toString() ? `?${tanpa}` : '' }, { replace: true })
    navigasi({ search: `?${params}` }, { state: { masukFokus: true } })
  }, [fokusId, langkahFokus, params, navigasi])
  const ada = useMemo(
    () => ({ tanpaJenisKelamin: kartu.some((k) => !k.sex), belumDewasa: kartu.some((k) => k.belumDewasa) }),
    [kartu]
  )

  if (!bagan) {
    return (
      <div className="p-5">
        <Judul>{teks.aplikasi.nama}</Judul>
        <p className="text-xl">{T.tanpaPangkal}</p>
      </div>
    )
  }

  const kartuTerpilih = terpilih ? (kartu.find((k) => k.id === terpilih) ?? rujukan.find((k) => k.id === terpilih) ?? null) : null
  // Cabang yang bisa difokuskan: keturunan itu sendiri, atau (untuk pasangan
  // yang bukan keturunan) cabang pasangannya.
  const cabang = kartuTerpilih ? (bagan.simpul.has(kartuTerpilih.id) ? kartuTerpilih.id : bagan.tempat.get(kartuTerpilih.id)) : null

  // Mengubah parameter alamat (fokus, hitung). Tanpa fokus, tidak ada
  // hitungan cabang. Masuk ke fokus: langkah baru di riwayat; di dalam mode
  // fokus: menggantikan langkah itu.
  const ubah = (ganti) => {
    const baru = new URLSearchParams(params)
    for (const [kunci, nilai] of Object.entries(ganti)) {
      if (nilai) baru.set(kunci, nilai)
      else baru.delete(kunci)
    }
    if (!baru.get('fokus')) baru.delete('hitung')
    baru.delete('pilih')
    if (!fokusId && baru.get('fokus')) setParams(baru, { state: { masukFokus: true } })
    else setParams(baru, { replace: true, state: baru.get('fokus') ? lokasi.state : null })
  }
  // "Keluar dari fokus": kembali ke bagan lengkap dengan hitungan pangkal
  // utama, sama dengan tombol Kembali di browser.
  const keluarFokus = () => {
    setTerpilih(null)
    if (langkahFokus) navigasi(-1)
    else ubah({ fokus: null })
  }
  // Ke kartu utama seseorang. Saat fokus hanya kartu di cabang itu (nama di
  // luar cabang tidak bisa diketuk); tanpa fokus, kartu yang tidak tampil
  // (data baru) membuat seluruh bagan ditampilkan lagi.
  const lompat = (id) => {
    if (kartu.some((x) => x.id === id)) {
      setTerpilih(id)
      aksi.pusatkanKe(id, bagianTertutupPanel(pengukur.current))
    } else if (!fokusId) {
      setTerpilih(id)
      setParams(new URLSearchParams({ pilih: id }), { replace: true })
    }
  }
  // Kartu "Dari cabang lain" saat fokus: kalau orangnya di cabang ini, ke
  // kartu utamanya; kalau tidak, hanya panelnya yang dibuka (tetap di cabang).
  const saatRujukan = (id) => {
    if (!anggota || anggota.has(id)) lompat(id)
    else setTerpilih((x) => (x === id ? null : id))
  }

  // Catatan "Anak mereka ada di cabang …" (di bagan lengkap dan saat fokus;
  // saat fokus tujuannya selalu di cabang ini, susun.js): seperti memilih
  // hasil pencarian. SEMUA anak pasangan itu disorot dan bagan bergeser ke
  // anak pertama; tidak ada kartu yang dipilih dan panel tidak dibuka
  // (putaran 7b, bagian A).
  const saatCatatan = (anakDi) => {
    const anak = anakDi.anak.filter((id) => kartu.some((x) => x.id === id))
    if (anak.length === 0) return
    setSorot(anak)
    setTerpilih(null)
    aksi.pusatkanKe(anak[0], { bilah: true })
  }

  // Hasil pencarian: sorot kartunya dan pindahkan Bagan ke sana. Panel orang
  // lain yang sedang terbuka ditutup supaya tidak tertukar.
  const sorotKe = (id) => {
    setSorot(id)
    setTerpilih((x) => (x === id ? x : null))
    if (kartu.some((x) => x.id === id)) {
      aksi.pusatkanKe(id, { ...(terpilih === id ? bagianTertutupPanel(pengukur.current) : {}), bilah: true })
    } else if (!fokusId) {
      setParams(new URLSearchParams({ pilih: id }), { replace: true })
    }
  }

  // Saat fokus, jalan keluarnya hanya "Keluar dari fokus" (di sini dan di
  // pita) atau "Kembali ke leluhur utama" (pita); tidak ada "Naik ke …".
  const fokus = fokusId && (
    <div className="flex flex-col gap-2 border-t border-tepi pt-3">
      <div className="flex flex-wrap gap-2">
        <Tombol varian="sekunder" ikon={LogOut} onClick={keluarFokus}>
          {T.keluarFokus}
        </Tombol>
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
          <GambarBagan
            akar={akar}
            tata={tata}
            terpilih={terpilih}
            sorot={sorot}
            saatKetuk={(id) => setTerpilih((x) => (x === id ? null : id))}
            saatLompat={lompat}
            saatRujukan={saatRujukan}
            saatCatatan={saatCatatan}
            cabang={anggota}
          />
        </div>
      </div>
      {/* Pita fokus dan bilah atas bertumpuk di atas bagan (pita tidak pernah menutupi bilah). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col">
        {fokusId && (
          <PitaFokus
            nama={akar.kartu.nama}
            hitungCabang={hitungCabang}
            saatKembali={() => ubah({ hitung: null })}
            saatKeluar={keluarFokus}
            sisiKanan={Boolean(kartuTerpilih)}
          />
        )}
        {bilah ? (
          <BilahAtas
            ref={atasRef}
            kartu={kartu}
            namaCabang={fokusId ? akar.kartu.nama : null}
            keterangan={keterangan}
            aksi={aksi}
            saatKetemu={sorotKe}
            saatKosong={() => setSorot(null)}
            fokus={fokus}
            saatTutup={() => setBilah(false)}
          />
        ) : (
          <>
            <h1 className="sr-only">{teks.aplikasi.nama}</h1>
            <button ref={atasRef} type="button" onClick={() => setBilah(true)} aria-label={T.tampilkanMenu} className={`${TOMBOL_BULAT.replace('absolute ', '')} pointer-events-auto relative ml-3 mt-3`}>
              <Menu aria-hidden="true" className="size-6" />
            </button>
          </>
        )}
      </div>
      <div ref={pengukur} aria-hidden="true" className="pointer-events-none invisible absolute h-0 w-[26rem]" />
      <Legenda ref={legendaRef} bingkai={BINGKAI} tombolBulat={TOMBOL_BULAT} ada={ada} />
      {kartuTerpilih && (
        <PanelOrang
          d={labelDetail(sTampil, kartuTerpilih.id)}
          saatPilih={lompat}
          // Saat fokus: nama di luar cabang hanya teks biasa, dan cabang di
          // luar cabang ini tidak bisa difokuskan.
          bisaDipilih={anggota ? (id) => anggota.has(id) : null}
          bisaFokus={Boolean(cabang) && cabang !== fokusId && (!anggota || anggota.has(cabang))}
          namaCabang={cabang ? bagan.simpul.get(cabang).kartu.nama : ''}
          saatFokus={(dariCabang) => {
            setTerpilih(null)
            ubah({ fokus: cabang, hitung: dariCabang ? 'cabang' : null })
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
