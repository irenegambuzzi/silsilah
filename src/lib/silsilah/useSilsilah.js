import { useMemo } from 'react'
import { useDataSilsilah } from '../data/konteksData.js'
import { susunSilsilah } from './silsilah.js'

// Turunan silsilah utama (graf, GEN, jalur, nomor) dari data yang sedang
// dimuat; dihitung ulang hanya kalau datanya berubah. null kalau belum ada data.
export function useSilsilah() {
  const { data } = useDataSilsilah()
  return useMemo(
    () => (data ? susunSilsilah(data, data.generation_terms ? { daftarGenerasi: data.generation_terms } : {}) : null),
    [data],
  )
}
