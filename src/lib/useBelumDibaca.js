import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { hitungBelumDibaca } from './api.js'

// Jumlah pemberitahuan yang belum dibaca, untuk penanda di navigasi.
// Dihitung ulang saat pindah layar, saat aplikasi kembali terlihat, dan tiap
// menit. Gagal menghitung (misalnya tanpa internet) tidak mengganggu apa pun.
export function useBelumDibaca(klien, aktif) {
  const [jumlah, setJumlah] = useState(0)
  const { pathname } = useLocation()
  useEffect(() => {
    if (!aktif || !klien) return undefined
    let batal = false
    const hitung = async () => {
      try {
        const n = await hitungBelumDibaca(klien)
        if (!batal) setJumlah(n)
      } catch {
        // Biarkan angka terakhir.
      }
    }
    // Menghitung saat layar berpindah; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    hitung()
    const saatTampak = () => document.visibilityState === 'visible' && hitung()
    document.addEventListener('visibilitychange', saatTampak)
    const id = setInterval(hitung, 60 * 1000)
    return () => {
      batal = true
      document.removeEventListener('visibilitychange', saatTampak)
      clearInterval(id)
    }
  }, [klien, aktif, pathname])
  return aktif ? jumlah : 0
}
