import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy, LogIn } from 'lucide-react'
import { Judul } from '../components/ui/Judul.jsx'
import { Pesan } from '../components/ui/Pesan.jsx'
import { Tombol, TautanTombol } from '../components/ui/Tombol.jsx'
import { deteksiBrowserDalamAplikasi } from '../lib/browserDalamAplikasi.js'
import { BENTUK_TOKEN } from '../../supabase/functions/_shared/rahasia.js'
import { kodeSahBentuk } from '../lib/kode.js'
import { useSesi } from '../lib/konteksSesi.js'
import { usePenukaran } from '../lib/usePenukaran.js'
import { isiTeks, teks } from '../teks/id.js'
import { Keadaan } from './Keadaan.jsx'

// Layar membuka link undangan (#/u/…) dan kode dari QR (#/kode/…) (layar 2).
// Link/kode BARU dipakai setelah tombol "Masuk" ditekan, bukan saat halaman
// dibuka, supaya pratinjau link di WhatsApp tidak menghabiskannya. Sebelum
// ditekan, tidak ada nama atau data apa pun di layar.
export default function Penukaran({ jenis }) {
  const params = useParams()
  const rahasia = jenis === 'undangan' ? params.token : params.kode
  const { status } = useSesi()
  const { sedang, hasil, jalankan } = usePenukaran(jenis)
  const dalamAplikasi = useMemo(() => deteksiBrowserDalamAplikasi(globalThis.navigator?.userAgent), [])
  const [tetapLanjut, setTetapLanjut] = useState(false)
  const [salinan, setSalinan] = useState(null) // 'berhasil' | 'gagal'
  const T = teks.penukaran

  if (status === 'belumDisiapkan') return <Keadaan jenis="belumDisiapkan" />

  const lengkap = jenis === 'undangan' ? BENTUK_TOKEN.test(rahasia ?? '') : kodeSahBentuk(rahasia)
  if (!lengkap) {
    return (
      <>
        <Judul>{T[jenis].judul}</Judul>
        <Pesan jenis="galat">{jenis === 'undangan' ? T.linkRusak : T.kodeRusak}</Pesan>
        <TautanTombol to="/masuk" replace>{T.keHalamanMasuk}</TautanTombol>
      </>
    )
  }

  // Browser di dalam aplikasi lain: minta dibuka di Chrome/Safari DULU.
  if (dalamAplikasi && !tetapLanjut) {
    const B = teks.browserDalamAplikasi
    const salin = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setSalinan('berhasil')
      } catch {
        setSalinan('gagal')
      }
    }
    return (
      <>
        <Judul>{B.judul}</Judul>
        <p className="text-xl">{isiTeks(B.isi, { nama: dalamAplikasi })}</p>
        <p className="text-lg">{B.langkah}</p>
        {salinan === 'berhasil' && <Pesan jenis="sukses">{B.disalin}</Pesan>}
        {salinan === 'gagal' && <Pesan jenis="peringatan">{B.gagalSalin}</Pesan>}
        <Tombol ikon={Copy} onClick={salin}>{B.salin}</Tombol>
        <Tombol varian="tautan" onClick={() => setTetapLanjut(true)}>{B.tetapLanjut}</Tombol>
      </>
    )
  }

  return (
    <>
      <Judul>{T[jenis].judul}</Judul>
      <p className="text-xl">{T[jenis].isi}</p>
      <p className="text-lg">{T[jenis].catatan}</p>
      {hasil && <Pesan jenis="galat">{hasil.pesan}</Pesan>}
      {hasil?.tetap ? (
        <TautanTombol to="/masuk" replace>{T.keHalamanMasuk}</TautanTombol>
      ) : (
        <Tombol ikon={LogIn} disabled={sedang} onClick={() => jalankan(rahasia)}>
          {sedang ? T.sedangMasuk : hasil ? T.cobaLagi : T.masuk}
        </Tombol>
      )}
      <Link to="/privasi" className="inline-flex min-h-12 items-center text-lg underline">
        {teks.navigasi.privasi}
      </Link>
    </>
  )
}
