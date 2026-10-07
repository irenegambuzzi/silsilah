import { useCallback, useEffect, useState } from 'react'
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { KodeQr } from '../components/KodeQr.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import {
  akhiriAksesSementara, batasAksesSementara, bolehBeriAkses, buatKodeAksesSementara,
  daftarAksesSementara, daftarNamaAnggota,
} from '../lib/api.js'
import { petakanGalat } from '../lib/galat.js'
import { useSesi } from '../lib/konteksSesi.js'
import { alamatKode, rapikanKode } from '../lib/kode.js'
import { useSisaWaktu } from '../lib/useSisaWaktu.js'
import { durasiTeks, formatJam, sisaMenitDetik } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'
import { Keadaan, KeadaanMemuat } from './Keadaan.jsx'

const PILIHAN_MENIT = [30, 60, 120, 360, 720, 1440]

function PanelKode({ kode, onBuatLagi, sedang }) {
  const T = teks.aksesSementara
  const sisa = useSisaWaktu(kode.berakhir)
  const habis = sisa === 0
  return (
    <Kartu className="flex flex-col gap-3" aria-live="polite">
      <Subjudul>{isiTeks(T.kodeJudul, { nama: kode.nama })}</Subjudul>
      {habis ? (
        <Pesan jenis="peringatan">{T.kodeHabis}</Pesan>
      ) : (
        <>
          <p className="text-lg">
            {isiTeks(T.kodeIsi, { nama: kode.nama, waktu: sisaMenitDetik(sisa), durasi: durasiTeks(kode.menit) })}
          </p>
          <KodeQr nilai={alamatKode(kode.teks)} label={T.qrLabel} />
          <p
            aria-label={`${teks.tambahPerangkat.kodeLabel}: ${rapikanKode(kode.teks).split('').join(' ')}`}
            className="text-center font-mono text-4xl font-bold tracking-widest"
          >
            {kode.teks}
          </p>
          <p className="text-lg">{teks.tambahPerangkat.hanyaSekali}</p>
        </>
      )}
      <Tombol varian="sekunder" ikon={RefreshCw} disabled={sedang} onClick={onBuatLagi}>{T.buatLagi}</Tombol>
    </Kartu>
  )
}

// Layar pengurus: memberi akses sementara (layar 22) dan melihat yang
// sedang berjalan. Hanya admin utama dan asisten dengan izinnya.
export default function AksesSementara() {
  const { klien, anggota } = useSesi()
  const [data, setData] = useState(null) // { nama, batas, daftar }
  const [galat, setGalat] = useState(null)
  const [info, setInfo] = useState(null)
  const [anggotaId, setAnggotaId] = useState('')
  const [menit, setMenit] = useState(60)
  const [kode, setKode] = useState(null)
  const [sedang, setSedang] = useState(false)
  const [konfirmasi, setKonfirmasi] = useState(null)
  const T = teks.aksesSementara
  const berhak = bolehBeriAkses(anggota)

  const muat = useCallback(async () => {
    try {
      const [nama, batas, daftar] = await Promise.all([
        daftarNamaAnggota(klien), batasAksesSementara(klien), daftarAksesSementara(klien),
      ])
      setData({ nama, batas, daftar })
      setGalat(null)
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }))
    }
  }, [klien])

  useEffect(() => {
    // Memuat saat layar dibuka; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    if (berhak) muat()
  }, [berhak, muat])

  // Pesan galat; admin utama tanpa verifikasi dua langkah mendapat penjelasan khusus.
  const pesanGalat = (g) => (g.kode === 'AK016' && anggota.pemilik ? T.perluDuaLangkah : g.pesan)

  if (!berhak) {
    return (
      <>
        <Judul>{T.judul}</Judul>
        <Pesan jenis="galat">{T.tanpaIzin}</Pesan>
      </>
    )
  }
  if (galat && !data) {
    return <Keadaan jenis="galat" pesan={pesanGalat(galat)} bisaCobaLagi={galat.bisaCobaLagi} onCobaLagi={muat} />
  }
  if (!data) return <KeadaanMemuat />

  const pilihanMenit = PILIHAN_MENIT.filter((m) => m <= data.batas)
  const buat = async (e) => {
    e?.preventDefault()
    if (!anggotaId) return
    setSedang(true)
    setInfo(null)
    try {
      const h = await buatKodeAksesSementara(klien, anggotaId, Math.min(menit, data.batas))
      const nama = data.nama.find((n) => n.id === anggotaId)?.display_name ?? ''
      setKode({ teks: h.code, berakhir: h.expires_at, nama, menit: h.access_minutes })
      setGalat(null)
      await muat()
    } catch (er) {
      setGalat(petakanGalat(er, { online: navigator.onLine }))
    }
    setSedang(false)
  }
  const akhiri = async (id) => {
    setSedang(true)
    try {
      await akhiriAksesSementara(klien, id)
      setKonfirmasi(null)
      setInfo(T.diakhiri)
      await muat()
    } catch (er) {
      setGalat(petakanGalat(er, { online: navigator.onLine }))
    }
    setSedang(false)
  }

  return (
    <>
      <Judul>{T.judul}</Judul>
      <p className="text-xl">{T.isi}</p>
      {info && <Pesan jenis="sukses">{info}</Pesan>}
      {galat && <Pesan jenis="galat">{pesanGalat(galat)}</Pesan>}

      <form onSubmit={buat} className="flex flex-col gap-4 rounded-2xl border-2 border-garis bg-kertas p-5">
        <label htmlFor="anggota" className="text-lg font-semibold">{T.pilihAnggota}</label>
        <select
          id="anggota"
          value={anggotaId}
          onChange={(e) => setAnggotaId(e.target.value)}
          className="min-h-14 rounded-xl border-2 border-garis bg-kertas px-3 text-lg"
        >
          <option value="">{T.pilihPlaceholder}</option>
          {data.nama.map((n) => <option key={n.id} value={n.id}>{n.display_name}</option>)}
        </select>
        <label htmlFor="durasi" className="text-lg font-semibold">{T.pilihDurasi}</label>
        <select
          id="durasi"
          value={Math.min(menit, data.batas)}
          onChange={(e) => setMenit(Number(e.target.value))}
          className="min-h-14 rounded-xl border-2 border-garis bg-kertas px-3 text-lg"
        >
          {pilihanMenit.map((m) => <option key={m} value={m}>{durasiTeks(m)}</option>)}
        </select>
        <Tombol type="submit" ikon={KeyRound} disabled={sedang || !anggotaId}>
          {sedang ? T.membuat : T.buat}
        </Tombol>
      </form>

      {kode && <PanelKode key={kode.teks} kode={kode} sedang={sedang} onBuatLagi={() => { setKode(null); setAnggotaId('') }} />}

      <Subjudul>{T.aktifJudul}</Subjudul>
      {data.daftar.length === 0 && <p className="text-lg">{T.aktifKosong}</p>}
      <ul className="flex flex-col gap-4">
        {data.daftar.map((a) => (
          <li key={a.id}>
            <Kartu className="flex flex-col gap-2">
              <p className="text-xl font-bold">{a.display_name}</p>
              {a.kind === 'aktif' ? (
                <>
                  <p className="text-lg">{a.label}</p>
                  <p className="text-lg font-semibold">{isiTeks(T.berjalan, { jam: formatJam(a.expires_at) })}</p>
                  {konfirmasi === a.id ? (
                    <div className="flex flex-col gap-3 border-t-2 border-garis pt-3">
                      <p className="text-lg font-semibold">{isiTeks(T.akhiriJudul, { nama: a.display_name })}</p>
                      <p className="text-lg">{T.akhiriIsi}</p>
                      <Tombol varian="bahaya" ikon={Trash2} disabled={sedang} onClick={() => akhiri(a.id)}>{T.akhiriYa}</Tombol>
                      <Tombol varian="sekunder" disabled={sedang} onClick={() => setKonfirmasi(null)}>{T.batal}</Tombol>
                    </div>
                  ) : (
                    <Tombol varian="sekunder" ikon={Trash2} onClick={() => setKonfirmasi(a.id)}>{T.akhiri}</Tombol>
                  )}
                </>
              ) : (
                <p className="text-lg">{isiTeks(T.menunggu, { jam: formatJam(a.expires_at) })} ({durasiTeks(a.access_minutes)})</p>
              )}
            </Kartu>
          </li>
        ))}
      </ul>
    </>
  )
}
