import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Judul, Subjudul } from '../components/ui/Judul.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol } from '../components/ui/Tombol.jsx'
import { kodeSahBentuk, tampilkanKode } from '../lib/kode.js'
import { useSesi } from '../lib/konteksSesi.js'
import { usePenukaran } from '../lib/usePenukaran.js'
import { teks } from '../teks/id.js'
import { Keadaan } from './Keadaan.jsx'

// Layar Masuk (layar 1). Tanpa data apa pun. Tidak pernah meminta izin lokasi.
export default function Masuk() {
  const { status, alasanKeluar } = useSesi()
  const { sedang, hasil, jalankan } = usePenukaran('kode')
  const [kode, setKode] = useState('')
  const [bentukSalah, setBentukSalah] = useState(false)
  const T = teks.halamanMasuk

  if (status === 'belumDisiapkan') return <Keadaan jenis="belumDisiapkan" />

  const kirim = (e) => {
    e.preventDefault()
    if (!kodeSahBentuk(kode)) {
      setBentukSalah(true)
      return
    }
    setBentukSalah(false)
    jalankan(kode)
  }
  const pesanKeluar = alasanKeluar && teks.keluar.alasan[alasanKeluar]

  return (
    <>
      <Judul>{T.judul}</Judul>
      {pesanKeluar && <Pesan jenis={alasanKeluar === 'keluar' ? 'info' : 'peringatan'}>{pesanKeluar}</Pesan>}
      <p className="text-xl">{T.sapaan}</p>
      <p className="text-lg">{T.punyaLink}</p>

      <form onSubmit={kirim} noValidate className="flex flex-col gap-3 rounded-xl border border-t-[3px] border-tepi border-t-emas bg-kertas p-5 shadow-lembut">
        <Subjudul>{T.judulKode}</Subjudul>
        <label htmlFor="kode" className="text-lg font-semibold">
          {T.labelKode}
        </label>
        <input
          id="kode"
          name="kode"
          value={kode}
          onChange={(e) => setKode(tampilkanKode(e.target.value))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          aria-describedby="bantuan-kode"
          aria-invalid={bentukSalah || undefined}
          className="isian min-h-14 px-4 text-center font-mono text-2xl tracking-widest"
        />
        <p id="bantuan-kode" className="text-base text-redup">
          {T.bantuanKode}
        </p>
        {bentukSalah && <Pesan jenis="galat">{teks.masuk.kode.format_salah}</Pesan>}
        {hasil && <Pesan jenis="galat">{hasil.pesan}</Pesan>}
        <Tombol type="submit" ikon={KeyRound} disabled={sedang}>
          {sedang ? teks.penukaran.sedangMasuk : T.tombolKode}
        </Tombol>
      </form>

      <p className="text-lg">{T.belumPunya}</p>
      <Link to="/privasi" className="inline-flex min-h-12 items-center gap-2 text-lg underline">
        <ShieldCheck aria-hidden="true" className="size-6" />
        {T.bacaPrivasi}
      </Link>
    </>
  )
}
