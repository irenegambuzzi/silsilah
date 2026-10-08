import { Link } from 'react-router-dom'

// Tombol besar (tinggi ≥ 48px) dengan teks + ikon, bergaya aplikasi lama:
// kotak membulat; tombol utama emas, tombol lain krem bergaris, tombol hapus
// bergaris merah. Informasi tidak hanya lewat warna: setiap tombol punya tulisan.
const DASAR =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 px-5 py-3 text-lg font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
const VARIAN = {
  utama: 'border-utama bg-utama text-utama-teks hover:border-utama-hover hover:bg-utama-hover',
  sekunder: 'border-garis bg-latar text-teks hover:border-emas hover:bg-kertas hover:text-emas-teks',
  bahaya: 'border-bahaya bg-latar text-bahaya hover:bg-kertas',
  tautan: 'border-transparent bg-transparent text-teks underline',
}

export function Tombol({ ikon: Ikon, varian = 'utama', children, className = '', ...sisa }) {
  return (
    <button type="button" className={`${DASAR} ${VARIAN[varian]} ${className}`} {...sisa}>
      {Ikon && <Ikon aria-hidden="true" className="size-6 shrink-0" />}
      <span>{children}</span>
    </button>
  )
}

export function TautanTombol({ ikon: Ikon, varian = 'sekunder', children, className = '', ...sisa }) {
  return (
    <Link className={`${DASAR} ${VARIAN[varian]} ${className}`} {...sisa}>
      {Ikon && <Ikon aria-hidden="true" className="size-6 shrink-0" />}
      <span>{children}</span>
    </Link>
  )
}
