import { Keadaan } from '../pages/Keadaan.jsx'
import { useDataSilsilah } from '../lib/data/konteksData.js'

// Gerbang untuk layar yang menampilkan data silsilah: isi layar hanya
// tampil kalau data tersedia. Selain itu layar keterangan (memuat, belum ada
// data, galat + "Coba lagi"). Tidak pernah menulis apa pun.
export function GerbangData({ children, bagian = false }) {
  const { status, galat, coba } = useDataSilsilah()
  if (status === 'kosong') return <Keadaan jenis="kosong" bagian={bagian} />
  if (status === 'galat') {
    return (
      <Keadaan
        jenis={galat?.jenis}
        pesan={galat?.pesan}
        bisaCobaLagi={galat?.bisaCobaLagi}
        onCobaLagi={coba}
        bagian={bagian}
      />
    )
  }
  if (status !== 'siap') return <Keadaan jenis="memuat" bagian={bagian} />
  return children
}
