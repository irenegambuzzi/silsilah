import { useEffect, useState } from 'react'

// Sisa milidetik sampai `berakhir` (ISO atau angka), diperbarui tiap detik.
// null kalau tidak ada batas. `sekarang` dapat diganti dalam tes.
export function useSisaWaktu(berakhir, { sekarang = Date.now, jeda = 1000 } = {}) {
  const tujuan = berakhir == null ? null : new Date(berakhir).getTime()
  const [, gambarUlang] = useState(0)
  useEffect(() => {
    if (tujuan == null) return undefined
    const id = setInterval(() => gambarUlang((n) => n + 1), jeda)
    return () => clearInterval(id)
  }, [tujuan, jeda])
  return tujuan == null ? null : Math.max(0, tujuan - sekarang())
}
