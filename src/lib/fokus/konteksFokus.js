import { createContext, createElement, useContext, useMemo, useState } from 'react'

// Mode fokus cabang yang sedang aktif (putaran ketujuh), BERSAMA untuk semua
// halaman: selama fokus aktif, Bagan, Daftar, dan halaman orang berperilaku
// seolah hanya cabang itu yang ada. Sumbernya alamat Bagan (?fokus=…&
// hitung=cabang): Bagan mencatatnya di sini setiap kali berubah, dan semua
// tautan ke Bagan membawanya kembali (alamatBagan). Jalan keluar hanya
// "Keluar dari fokus" (atau tombol Kembali di browser di Bagan).
//   fokus  null, atau { id, hitung } (hitung: generasi dihitung dari orang itu)
const KonteksFokus = createContext({ fokus: null, setFokus: () => {} })

export function FokusCabangProvider({ children }) {
  const [fokus, setFokusMentah] = useState(null)
  const nilai = useMemo(() => {
    // Nilai yang sama tidak membuat semua halaman digambar ulang.
    const setFokus = (baru) =>
      setFokusMentah((lama) => (lama?.id === baru?.id && Boolean(lama?.hitung) === Boolean(baru?.hitung) ? lama : baru))
    return { fokus, setFokus }
  }, [fokus])
  return createElement(KonteksFokus.Provider, { value: nilai }, children)
}

export const useFokusCabang = () => useContext(KonteksFokus)

// Alamat Bagan dengan fokus yang sedang aktif: "/bagan", atau
// "/bagan?fokus=lorvan&hitung=cabang" (`pilih`: kartu yang langsung terpilih).
export function alamatBagan(fokus, { pilih = null } = {}) {
  const p = new URLSearchParams()
  if (fokus) {
    p.set('fokus', fokus.id)
    if (fokus.hitung) p.set('hitung', 'cabang')
  }
  if (pilih) p.set('pilih', pilih)
  const q = p.toString()
  return q ? `/bagan?${q}` : '/bagan'
}
