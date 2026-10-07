import { useCallback, useEffect, useState } from 'react'
import { Check, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Judul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { TautanTombol, Tombol } from '../components/ui/Tombol.jsx'
import { cabutPerangkat, daftarKotakMasuk, tandaiDibaca } from '../lib/api.js'
import { petakanGalat } from '../lib/galat.js'
import { useSesi } from '../lib/konteksSesi.js'
import { formatTanggalJam } from '../lib/waktu.js'
import { teks } from '../teks/id.js'
import { Keadaan, KeadaanMemuat } from './Keadaan.jsx'

// Tombol "Cabut perangkat ini" hanya untuk tautan dari sistem berbentuk
// persis ini. Tautan lain tidak pernah dijadikan tautan di layar.
const POLA_CABUT = /^#\/admin\/perangkat\?cabut=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

// Kotak masuk (layar 19): pemberitahuan untuk anggota. Admin utama menerima
// login baru, login mencurigakan, dan "Bukan saya" di sini.
export default function KotakMasuk() {
  const { klien, anggota, duaLangkah } = useSesi()
  // Mencabut perangkat orang lain adalah fungsi admin: admin utama perlu
  // verifikasi dua langkah dulu di perangkat ini.
  const perluDuaLangkah = Boolean(anggota?.pemilik && duaLangkah?.level !== 'aal2')
  const [daftar, setDaftar] = useState(null)
  const [galat, setGalat] = useState(null)
  const [info, setInfo] = useState(null)
  const [sedang, setSedang] = useState(null) // id yang sedang diproses
  const T = teks.kotakMasuk

  const muat = useCallback(async () => {
    try {
      setDaftar(await daftarKotakMasuk(klien))
      setGalat(null)
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }))
    }
  }, [klien])

  useEffect(() => {
    // Memuat saat layar dibuka; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    muat()
  }, [muat])

  const proses = async (id, kerja, pesanBerhasil) => {
    setSedang(id)
    setInfo(null)
    try {
      await kerja()
      if (pesanBerhasil) setInfo(pesanBerhasil)
      await muat()
    } catch (e) {
      setGalat(petakanGalat(e, { online: navigator.onLine }))
    }
    setSedang(null)
  }

  if (galat && !daftar) return <Keadaan jenis="galat" pesan={galat.pesan} bisaCobaLagi={galat.bisaCobaLagi} onCobaLagi={muat} />
  if (!daftar) return <KeadaanMemuat />

  return (
    <>
      <Judul>{T.judul}</Judul>
      {info && <Pesan jenis="sukses">{info}</Pesan>}
      {galat && <Pesan jenis="galat">{galat.pesan}</Pesan>}
      {daftar.length === 0 && <p className="text-xl">{T.kosong}</p>}
      <ul className="flex flex-col gap-4">
        {daftar.map((n) => {
          const belumDibaca = !n.read_at
          const perangkat = POLA_CABUT.exec(n.link ?? '')?.[1]
          return (
            <li key={n.id}>
              <Kartu className="flex flex-col gap-2">
                {(belumDibaca || n.priority === 'penting') && (
                  <p className="flex flex-wrap gap-2 text-base font-bold">
                    {n.priority === 'penting' && (
                      <span className="inline-flex items-center gap-1">
                        <ShieldAlert aria-hidden="true" className="size-5" />
                        {T.penting}
                      </span>
                    )}
                    {belumDibaca && <span>{T.belumDibaca}</span>}
                  </p>
                )}
                <h2 className={`text-xl ${belumDibaca ? 'font-bold' : 'font-semibold'}`}>{n.title}</h2>
                {n.body && <p className="whitespace-pre-line text-lg">{n.body}</p>}
                <p className="text-base text-redup">{formatTanggalJam(n.created_at, teks.silsilah.bulan)}</p>
                {perangkat && perluDuaLangkah && (
                  <TautanTombol to="/saya/dua-langkah" ikon={LockKeyhole}>{T.cabutPerluDuaLangkah}</TautanTombol>
                )}
                {perangkat && !perluDuaLangkah && (
                  <Tombol
                    varian="bahaya"
                    disabled={sedang === n.id}
                    onClick={() => proses(n.id, async () => { await cabutPerangkat(klien, perangkat); await tandaiDibaca(klien, n.id) }, T.perangkatDicabut)}
                  >
                    {T.cabutPerangkat}
                  </Tombol>
                )}
                {belumDibaca && (
                  <Tombol varian="sekunder" ikon={Check} disabled={sedang === n.id} onClick={() => proses(n.id, () => tandaiDibaca(klien, n.id))}>
                    {T.tandai}
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
