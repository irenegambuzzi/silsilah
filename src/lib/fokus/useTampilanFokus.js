import { useMemo } from 'react'
import { susunBagan } from '../bagan/susun.js'
import { tampilanCabang } from '../bagan/cabang.js'
import { useSilsilah } from '../silsilah/useSilsilah.js'
import { useFokusCabang } from './konteksFokus.js'

// Untuk Daftar dan halaman orang: fokus cabang yang sedang aktif (kalau
// orangnya masih ada di silsilah) dan tampilan cabang itu (bagan/cabang.js),
// sama persis dengan yang tampil di Bagan.
//   fokus   null atau { id, hitung }
//   cabang  null atau { sTampil, bagan, kartu, rujukan, anggota, nama }
//   sTampil turunan silsilah untuk label (GEN dihitung dari orang itu kalau hitung)
export function useTampilanFokus() {
  const silsilah = useSilsilah()
  const { fokus, setFokus } = useFokusCabang()
  const bagan = useMemo(() => (silsilah && fokus ? susunBagan(silsilah) : null), [silsilah, fokus])
  const id = fokus && bagan?.simpul.has(fokus.id) ? fokus.id : null
  const hitung = Boolean(id && fokus.hitung)
  const cabang = useMemo(() => (id ? tampilanCabang(silsilah, id, hitung) : null), [silsilah, id, hitung])
  return {
    silsilah,
    fokus: id ? { id, hitung } : null,
    cabang,
    sTampil: cabang?.sTampil ?? silsilah,
    keluar: () => setFokus(null),
    kembaliKeUtama: () => setFokus({ id, hitung: false }),
  }
}
