import { createContext, useContext } from 'react'
import { UKURAN_NAMA } from '../../lib/bagan/barisNama.js'

// Ukuran huruf nama di kartu (rem per tingkat). Bagan memakai UKURAN_NAMA
// (pilihan A); halaman /contoh/ukuran (mode contoh) memberi pilihan lain.
export const KonteksUkuranNama = createContext(UKURAN_NAMA)
export const useUkuranNama = () => useContext(KonteksUkuranNama)
