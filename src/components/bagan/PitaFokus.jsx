import { LogOut } from 'lucide-react'
import { isiTeks, teks } from '../../teks/id.js'

const T = teks.bagan
const TOMBOL_KECIL =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-lg border-2 border-garis bg-latar px-3 text-lg font-semibold hover:border-emas hover:bg-kertas hover:text-emas-teks'

// Pita SELAMA mode fokus aktif, sama di Bagan, Daftar, dan halaman orang:
// cabang mana yang tampil (atau dari siapa generasi dihitung), "Kembali ke
// leluhur utama" (hanya kalau generasi dihitung dari orang itu), dan tombol
// "Keluar dari fokus" yang selalu terlihat. Hanya dua tombol itu jalan
// keluarnya. `sisiKanan`: panel keterangan terbuka di kanan (layar lebar),
// jadi isi pita tidak boleh tertutup panel.
export function PitaFokus({ nama, hitungCabang, saatKembali, saatKeluar, sisiKanan = false, className = '' }) {
  return (
    <div className={`pointer-events-auto flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-emas bg-kertas px-4 py-1 text-lg font-semibold shadow-lembut ${sisiKanan ? 'md:pr-[27rem]' : ''} ${className}`}>
      <p role="status" className="flex flex-wrap items-center gap-x-2">
        <span>{isiTeks(hitungCabang ? T.pitaCabang : T.fokusJudul, { nama })}</span>
        {hitungCabang && (
          <>
            <span aria-hidden="true" className="text-redup">·</span>
            <button type="button" onClick={saatKembali} className="min-h-12 font-bold text-emas-teks underline underline-offset-2">
              {T.kembaliKePangkal}
            </button>
          </>
        )}
      </p>
      <button type="button" onClick={saatKeluar} className={TOMBOL_KECIL} data-keluar-fokus>
        <LogOut aria-hidden="true" className="size-5" />
        {T.keluarFokus}
      </button>
    </div>
  )
}
