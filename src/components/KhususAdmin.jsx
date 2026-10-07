import { useSesi } from '../lib/konteksSesi.js'
import { PanelDuaLangkah } from '../pages/DuaLangkah.jsx'

// Gerbang untuk SEMUA layar admin (rute /admin/…, lihat App.jsx): admin utama
// yang perangkatnya belum terverifikasi dua langkah (aal2) melihat layar
// verifikasi, bukan layar admin, dan layar admin tidak memanggil server sama
// sekali. Server tetap menolak fungsi admin tanpa aal2 (SQL 004 is_owner()),
// jadi gerbang ini untuk kejelasan, bukan satu-satunya pengaman.
// Asisten tidak memerlukan verifikasi dua langkah untuk izinnya.
export default function KhususAdmin({ children }) {
  const { anggota, duaLangkah } = useSesi()
  if (anggota?.pemilik && duaLangkah?.level !== 'aal2') return <PanelDuaLangkah dariGerbang />
  return children
}
