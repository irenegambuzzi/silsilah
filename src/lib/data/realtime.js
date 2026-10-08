// Sinkron live: berlangganan perubahan tabel silsilah lewat Supabase
// Realtime. Server hanya mengirim perubahan yang boleh dibaca anggota ini
// (RLS), ditambah penanda "dibuang ke tempat sampah" (SQL 014).
import { TABEL_SILSILAH } from './kolom.js'

export const TABEL_LIVE = [...TABEL_SILSILAH, 'settings', 'sync_removals']

// saatPerubahan(peristiwa); saatStatus('SUBSCRIBED' | 'CHANNEL_ERROR' |
// 'TIMED_OUT' | 'CLOSED'). Hasil: fungsi untuk berhenti berlangganan.
export function dengarkanPerubahan(klien, { saatPerubahan, saatStatus }) {
  const saluran = klien.channel('silsilah-live')
  for (const table of TABEL_LIVE) {
    saluran.on('postgres_changes', { event: '*', schema: 'public', table }, saatPerubahan)
  }
  saluran.subscribe((status) => saatStatus?.(status))
  return () => {
    Promise.resolve()
      .then(() => klien.removeChannel(saluran))
      .catch(() => {})
  }
}
