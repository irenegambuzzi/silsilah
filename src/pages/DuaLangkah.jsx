import { useState } from 'react'
import { KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { KodeQr } from '../components/KodeQr.jsx'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Kartu } from '../components/ui/Kartu.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { hapusAuthenticator, mulaiDaftarTotp, verifikasiTotp } from '../lib/api.js'
import { petakanGalat } from '../lib/galat.js'
import { useSesi } from '../lib/konteksSesi.js'
import { formatTanggalJam } from '../lib/waktu.js'
import { isiTeks, teks } from '../teks/id.js'
import { Keadaan } from './Keadaan.jsx'

const T = teks.duaLangkah
const galatDari = (e) => petakanGalat(e, { online: navigator.onLine })

// Nama untuk authenticator berikutnya: "Utama", lalu "Cadangan", "Cadangan 2", …
function namaBaru(faktor) {
  if (faktor.length === 0) return T.namaUtama
  const dipakai = new Set(faktor.map((f) => f.nama))
  for (let i = 1; ; i++) {
    const nama = i === 1 ? T.namaCadangan : `${T.namaCadangan} ${i}`
    if (!dipakai.has(nama)) return nama
  }
}

// Isian kode 6 angka + tombol Verifikasi.
function FormKode({ faktor, onBerhasil, onBatal }) {
  const { klien } = useSesi()
  const [kode, setKode] = useState('')
  const [pilihan, setPilihan] = useState(faktor[0]?.id ?? '')
  const [sedang, setSedang] = useState(false)
  const [galat, setGalat] = useState(null)
  const kirim = async (e) => {
    e.preventDefault()
    if (kode.length !== 6) return
    setSedang(true)
    setGalat(null)
    try {
      await verifikasiTotp(klien, pilihan, kode)
      await onBerhasil()
    } catch (er) {
      setGalat(galatDari(er))
      setKode('')
    }
    setSedang(false)
  }
  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-3 rounded-2xl border-2 border-garis bg-kertas p-5">
      {faktor.length > 1 && (
        <>
          <label htmlFor="authenticator" className="text-lg font-semibold">{T.pilihAuthenticator}</label>
          <select
            id="authenticator"
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value)}
            className="min-h-14 rounded-xl border-2 border-garis bg-kertas px-3 text-lg"
          >
            {faktor.map((f) => <option key={f.id} value={f.id}>{f.nama}</option>)}
          </select>
        </>
      )}
      <label htmlFor="kode-dua-langkah" className="text-lg font-semibold">{T.kodeLabel}</label>
      <input
        id="kode-dua-langkah"
        name="kode-dua-langkah"
        value={kode}
        onChange={(e) => setKode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-describedby="bantuan-kode-dua-langkah"
        aria-invalid={galat ? true : undefined}
        className="min-h-14 rounded-xl border-2 border-garis bg-kertas px-4 text-center font-mono text-2xl tracking-widest"
      />
      <p id="bantuan-kode-dua-langkah" className="text-base text-redup">{T.kodeBantuan}</p>
      {galat && <Pesan jenis="galat">{galat.pesan}</Pesan>}
      <Tombol type="submit" ikon={ShieldCheck} disabled={sedang || kode.length !== 6}>
        {sedang ? T.memeriksa : T.verifikasi}
      </Tombol>
      {onBatal && <Tombol varian="sekunder" disabled={sedang} onClick={onBatal}>{T.batal}</Tombol>}
    </form>
  )
}

// Pendaftaran authenticator: kode QR + kunci (hanya di layar ini, tidak
// disimpan di mana pun), lalu kode pertama untuk memastikan sudah benar.
function PanelPendaftaran({ pendaftaran, onBerhasil, onBatal }) {
  return (
    <Kartu className="flex flex-col gap-3">
      <Subjudul>{T.mulai}</Subjudul>
      <p className="text-lg">{T.langkah1}</p>
      <p className="text-lg">{T.langkah2}</p>
      <KodeQr nilai={pendaftaran.uri} label={T.qrLabel} />
      <p className="text-lg font-semibold">{T.kunciLabel}</p>
      <p className="break-all text-center font-mono text-xl tracking-wider">
        {pendaftaran.rahasia.match(/.{1,4}/g).join(' ')}
      </p>
      <Pesan jenis="peringatan">{T.kunciCatatan}</Pesan>
      <p className="text-lg">{T.langkah3}</p>
      <FormKode faktor={[{ id: pendaftaran.id, nama: pendaftaran.nama }]} onBerhasil={onBerhasil} onBatal={onBatal} />
    </Kartu>
  )
}

// Layar verifikasi dua langkah admin utama. `dariGerbang`: ditampilkan di
// tempat layar admin yang belum boleh dibuka (components/KhususAdmin.jsx).
export function PanelDuaLangkah({ dariGerbang = false }) {
  const { klien, anggota, duaLangkah, perbaruiDuaLangkah } = useSesi()
  const [pendaftaran, setPendaftaran] = useState(null)
  const [sedang, setSedang] = useState(false)
  const [galat, setGalat] = useState(null)
  const [info, setInfo] = useState(null)
  const [konfirmasi, setKonfirmasi] = useState(null)

  const judul = <Judul>{dariGerbang ? T.judulGerbang : T.judul}</Judul>
  if (!anggota?.pemilik) {
    return <>{judul}<Pesan jenis="galat">{T.hanyaAdmin}</Pesan></>
  }
  if (!duaLangkah?.faktor) {
    return <Keadaan jenis="galat" pesan={T.statusGagal} bisaCobaLagi onCobaLagi={perbaruiDuaLangkah} />
  }

  const { level, faktor } = duaLangkah
  const aktif = level === 'aal2'

  const mulai = async () => {
    setSedang(true)
    setGalat(null)
    setInfo(null)
    try {
      const nama = namaBaru(faktor)
      setPendaftaran({ ...(await mulaiDaftarTotp(klien, nama, teks.aplikasi.nama)), nama })
    } catch (e) {
      setGalat(galatDari(e))
    }
    setSedang(false)
  }
  const selesaiDaftar = async () => {
    setPendaftaran(null)
    setInfo(T.berhasilDaftar)
    await perbaruiDuaLangkah()
  }
  const selesaiKode = async () => {
    setInfo(T.berhasilMasuk)
    await perbaruiDuaLangkah()
  }
  const hapus = async (id) => {
    setSedang(true)
    setGalat(null)
    try {
      await hapusAuthenticator(klien, id)
      setKonfirmasi(null)
      setInfo(T.dihapus)
      await perbaruiDuaLangkah()
    } catch (e) {
      setGalat(galatDari(e))
    }
    setSedang(false)
  }

  return (
    <>
      {judul}
      <p className="text-xl">{dariGerbang ? T.isiGerbang : T.penjelasan}</p>
      {info && <Pesan jenis="sukses">{info}</Pesan>}
      {galat && <Pesan jenis="galat">{galat.pesan}</Pesan>}

      {pendaftaran ? (
        <PanelPendaftaran pendaftaran={pendaftaran} onBerhasil={selesaiDaftar} onBatal={() => setPendaftaran(null)} />
      ) : aktif ? (
        <>
          <Pesan jenis="sukses">{T.aktif}</Pesan>
          <Subjudul>{T.terdaftarJudul}</Subjudul>
          <ul className="flex flex-col gap-4">
            {faktor.map((f) => (
              <li key={f.id}>
                <Kartu className="flex flex-col gap-2">
                  <p className="text-xl font-bold">{f.nama}</p>
                  {f.dibuat && <p className="text-lg">{isiTeks(T.didaftarkan, { waktu: formatTanggalJam(f.dibuat, teks.silsilah.bulan) })}</p>}
                  {konfirmasi === f.id ? (
                    <div className="flex flex-col gap-3 border-t-2 border-garis pt-3">
                      <p className="text-lg font-semibold">{isiTeks(T.hapusJudul, { nama: f.nama })}</p>
                      <p className="text-lg">{faktor.length === 1 ? T.hapusTerakhir : T.hapusIsi}</p>
                      <Tombol varian="bahaya" ikon={Trash2} disabled={sedang} onClick={() => hapus(f.id)}>{T.hapusYa}</Tombol>
                      <Tombol varian="sekunder" disabled={sedang} onClick={() => setKonfirmasi(null)}>{T.batal}</Tombol>
                    </div>
                  ) : (
                    <Tombol varian="sekunder" ikon={Trash2} onClick={() => setKonfirmasi(f.id)}>{T.hapus}</Tombol>
                  )}
                </Kartu>
              </li>
            ))}
          </ul>
          {faktor.length < 2 && <Pesan jenis="info">{T.saranCadangan}</Pesan>}
          <Tombol varian="sekunder" ikon={Plus} disabled={sedang} onClick={mulai}>
            {sedang ? T.menyiapkan : T.mulaiCadangan}
          </Tombol>
        </>
      ) : faktor.length > 0 ? (
        <FormKode faktor={faktor} onBerhasil={selesaiKode} />
      ) : (
        <>
          <Pesan jenis="peringatan">{T.belumAda}</Pesan>
          <Tombol ikon={KeyRound} disabled={sedang} onClick={mulai}>{sedang ? T.menyiapkan : T.mulai}</Tombol>
        </>
      )}

      {!dariGerbang && (
        <Kartu className="flex flex-col gap-2">
          <Subjudul>{T.hilangJudul}</Subjudul>
          <p className="text-lg">{T.hilangIsi}</p>
        </Kartu>
      )}
    </>
  )
}

export default function DuaLangkah() {
  return <PanelDuaLangkah />
}
