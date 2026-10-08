import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Laptop, Smartphone, Trash2 } from 'lucide-react'
import { Judul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { bacaSessionId, cabutPerangkat, daftarPerangkatSaya } from '../lib/api.js'
import { petakanGalat } from '../lib/galat.js'
import { useSesi } from '../lib/konteksSesi.js'
import { formatJam, formatTanggalJam } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'
import { Keadaan, KeadaanMemuat } from './Keadaan.jsx'

const lokasiPerangkat = (p) => {
  const T = teks.perangkatSaya
  if (!p.approx_country) return T.lokasiTakDiketahui
  const negara = p.approx_country_name ?? p.approx_country
  return `${teks.lokasi.sekitar} ${p.approx_city ? `${p.approx_city}, ${negara}` : negara}`
}

// Layar Perangkat saya: daftar perangkat yang sedang masuk, dan tombol cabut.
export default function PerangkatSaya() {
  const { klien, anggota, akhiri } = useSesi()
  const navigasi = useNavigate()
  const [daftar, setDaftar] = useState(null)
  const [sesiIni, setSesiIni] = useState(null)
  const [galat, setGalat] = useState(null)
  const [konfirmasi, setKonfirmasi] = useState(null) // id perangkat
  const [sedang, setSedang] = useState(false)
  const [info, setInfo] = useState(null)
  const T = teks.perangkatSaya

  const muat = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([daftarPerangkatSaya(klien, anggota.id), bacaSessionId(klien)])
      setDaftar(d)
      setSesiIni(s)
      setGalat(null)
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }))
    }
  }, [klien, anggota.id])

  useEffect(() => {
    // Memuat daftar saat layar dibuka; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    muat()
  }, [muat])

  const cabut = async (perangkat) => {
    setSedang(true)
    try {
      await cabutPerangkat(klien, perangkat.id)
      if (perangkat.session_id === sesiIni) {
        await akhiri('keluar')
        navigasi('/masuk', { replace: true })
        return
      }
      setKonfirmasi(null)
      setInfo(T.sudahDicabut)
      await muat()
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }))
    }
    setSedang(false)
  }

  if (galat && !daftar) return <Keadaan jenis="galat" pesan={galat.pesan} bisaCobaLagi={galat.bisaCobaLagi} onCobaLagi={muat} />
  if (!daftar) return <KeadaanMemuat />

  return (
    <>
      <Judul>{T.judul}</Judul>
      <p className="text-xl">{T.isi}</p>
      {info && <Pesan jenis="sukses">{info}</Pesan>}
      {galat && <Pesan jenis="galat">{galat.pesan}</Pesan>}
      {daftar.length === 0 && <p className="text-lg">{T.kosong}</p>}
      <ul className="flex flex-col gap-4">
        {daftar.map((p) => {
          const ini = p.session_id === sesiIni
          const Ikon = /iPhone|Android|iPad|Tablet/.test(p.device_type ?? '') ? Smartphone : Laptop
          return (
            <li key={p.id}>
              <Kartu className="flex flex-col gap-2">
                <p className="flex items-center gap-2 text-xl font-bold">
                  <Ikon aria-hidden="true" className="size-7 shrink-0" />
                  {p.label ?? p.device_type ?? T.tanpaNama}
                </p>
                {ini && <p className="text-lg font-semibold">{T.iniPerangkat}</p>}
                <p className="text-lg">
                  {T.perkiraan}: {lokasiPerangkat(p)}
                </p>
                <p className="text-base text-redup">
                  {isiTeks(T.masukPada, { waktu: formatTanggalJam(p.created_at, teks.silsilah.bulan) })} {T.lewat[p.via]}
                </p>
                {p.last_seen_at && (
                  <p className="text-base text-redup">
                    {isiTeks(T.terakhirAktif, { waktu: formatTanggalJam(p.last_seen_at, teks.silsilah.bulan) })}
                  </p>
                )}
                {p.expires_at && (
                  <p className="text-base font-semibold">{isiTeks(T.berakhirPukul, { jam: formatJam(p.expires_at) })}</p>
                )}
                {konfirmasi === p.id ? (
                  <div className="flex flex-col gap-3 border-t border-tepi pt-3">
                    <p className="text-lg font-semibold">{T.cabutJudul}</p>
                    <p className="text-lg">{ini ? T.cabutIsiIni : T.cabutIsiLain}</p>
                    <Tombol varian="bahaya" ikon={Trash2} disabled={sedang} onClick={() => cabut(p)}>{T.cabutYa}</Tombol>
                    <Tombol varian="sekunder" disabled={sedang} onClick={() => setKonfirmasi(null)}>{T.batal}</Tombol>
                  </div>
                ) : (
                  <Tombol varian="sekunder" ikon={Trash2} onClick={() => { setInfo(null); setKonfirmasi(p.id) }}>
                    {T.cabut}
                  </Tombol>
                )}
              </Kartu>
            </li>
          )
        })}
      </ul>
    </>
  )
}
