import { createContext, useContext } from 'react'
import { UKURAN_NAMA_BAGAN } from '../../lib/bagan/barisNama.js'

// Ukuran huruf nama di kartu (rem per tingkat). Bagan memakai
// UKURAN_NAMA_BAGAN (sementara pilihan D, putaran 8a; keputusan akhir D atau
// E di HP sungguhan, putaran 8d); halaman /contoh/ukuran (mode contoh) dan
// halaman uji nama asli memberi pilihan A–E lewat Provider.
export const KonteksUkuranNama = createContext(UKURAN_NAMA_BAGAN)
export const useUkuranNama = () => useContext(KonteksUkuranNama)
