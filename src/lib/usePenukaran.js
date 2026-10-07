// Memakai link undangan atau kode: dipakai layar Masuk (kode diketik) dan
// layar membuka link/kode. Menampilkan hasilnya dalam bahasa Indonesia.
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { petakanGalat } from './galat.js'
import { pesanPenukaran } from './masuk.js'
import { useSesi } from './konteksSesi.js'

// Alasan yang tidak akan berubah kalau dicoba lagi dengan link/kode yang sama.
const TETAP = new Set(['tidak_dikenal', 'sudah_dipakai', 'kedaluwarsa', 'dicabut', 'dimatikan'])

export function usePenukaran(jenis) {
  const sesi = useSesi()
  const navigasi = useNavigate()
  const [sedang, setSedang] = useState(false)
  const [hasil, setHasil] = useState(null) // { pesan, tetap }

  const jalankan = useCallback(
    async (rahasia) => {
      setSedang(true)
      setHasil(null)
      try {
        const h = await sesi.masuk(jenis, rahasia)
        if (h.ok) {
          // Link undangan pertama kali: sapaan "Apakah ini Anda?". Kode: langsung masuk.
          // replace: token/kode hilang dari kolom alamat dan riwayat.
          navigasi(h.via === 'undangan' ? '/selamat-datang' : '/', { replace: true })
          return
        }
        setHasil({ pesan: pesanPenukaran(jenis, h.alasan), tetap: TETAP.has(h.alasan) })
      } catch (e) {
        const g = petakanGalat(e, { online: navigator.onLine })
        setHasil({ pesan: g.pesan, tetap: false })
      }
      setSedang(false)
    },
    [jenis, navigasi, sesi]
  )

  return { sedang, hasil, jalankan }
}
