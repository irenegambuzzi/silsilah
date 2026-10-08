import { useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bell, House, List, Network, ShieldCheck, UserRound } from 'lucide-react'
import { useSesi } from '../../lib/konteksSesi.js'
import { useBelumDibaca } from '../../lib/useBelumDibaca.js'
import { isiTeks, teks } from '../../teks/id.js'
import { BannerAksesSementara } from '../BannerAksesSementara.jsx'
import { SpandukData } from '../SpandukData.jsx'

const MENU = [
  { ke: '/', teks: teks.navigasi.beranda, ikon: House, akhir: true },
  { ke: '/bagan', teks: teks.navigasi.bagan, ikon: Network },
  { ke: '/daftar', teks: teks.navigasi.daftar, ikon: List },
  { ke: '/kotak-masuk', teks: teks.navigasi.kotakMasuk, ikon: Bell, lencana: true },
  { ke: '/saya', teks: teks.navigasi.saya, ikon: UserRound },
]

// Nama aplikasi di atas setiap layar, seperti aplikasi lama (di Bagan
// tempatnya di bilah atas bagan; di layar Masuk sudah menjadi judul).
export function Merek({ className = '' }) {
  return (
    <div className={className}>
      <p className="font-judul text-xl font-bold uppercase tracking-wider text-emas-teks">{teks.aplikasi.nama}</p>
      <p className="text-sm font-semibold uppercase tracking-widest text-redup">{teks.aplikasi.subjudul}</p>
    </div>
  )
}

// Bingkai halaman: tombol "langsung ke isi" untuk papan ketik, nama
// aplikasi, isi halaman, dan (kalau sudah masuk) navigasi bawah. Bagan
// memakai seluruh layar di atas navigasi bawah.
export default function Kerangka({ children, spanduk = null }) {
  const { status, klien, berakhir } = useSesi()
  const isi = useRef(null)
  const { pathname } = useLocation()
  const penuh = pathname === '/bagan'
  const masuk = status === 'masuk' || status === 'offline'
  const belumDibaca = useBelumDibaca(klien, status === 'masuk')

  return (
    <div className={`flex flex-col ${penuh ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:m-2 focus:rounded-lg focus:bg-kertas focus:p-3 focus:text-lg focus:font-semibold"
        onClick={() => isi.current?.focus()}
      >
        {teks.navigasi.lewatiKeIsi}
      </button>
      {spanduk}
      {status === 'masuk' && berakhir && <BannerAksesSementara berakhir={berakhir} />}
      {masuk && <SpandukData />}
      {!penuh && pathname !== '/masuk' && <Merek className="mx-auto w-full max-w-xl px-5 pt-5 text-center" />}
      <main
        id="isi"
        ref={isi}
        tabIndex={-1}
        className={
          penuh
            ? 'relative min-h-0 w-full flex-1 outline-none'
            : `mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 p-5 outline-none ${masuk ? 'pb-8' : 'justify-center'}`
        }
      >
        {children}
      </main>
      {masuk ? (
        <nav
          aria-label={teks.navigasi.menu}
          className="sticky bottom-0 z-30 border-t border-t-tepi bg-kertas shadow-lembut"
        >
          <ul className="mx-auto flex max-w-xl">
            {MENU.map(({ ke, teks: nama, ikon: Ikon, akhir, lencana }) => (
              <li key={ke} className="flex-1">
                <NavLink
                  to={ke}
                  end={akhir}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-1 break-words px-1 text-center text-sm font-semibold leading-tight ${
                      isActive ? 'text-emas-teks underline decoration-4 underline-offset-4' : 'text-teks'
                    }`
                  }
                >
                  <span className="relative">
                    <Ikon aria-hidden="true" className="size-6" />
                    {lencana && belumDibaca > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-3 -top-2 min-w-6 rounded-full border-2 border-kertas bg-bahaya px-1 text-center text-sm font-bold text-bahaya-teks"
                      >
                        {belumDibaca > 99 ? teks.kotakMasuk.banyak : belumDibaca}
                      </span>
                    )}
                  </span>
                  {nama}
                  {lencana && belumDibaca > 0 && (
                    <span className="sr-only">{isiTeks(teks.kotakMasuk.jumlahBelumDibaca, { n: belumDibaca })}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <footer className="mx-auto w-full max-w-xl p-5 text-center">
          <Link to="/privasi" className="inline-flex min-h-12 items-center gap-2 text-lg underline">
            <ShieldCheck aria-hidden="true" className="size-6" />
            {teks.navigasi.privasi}
          </Link>
        </footer>
      )}
    </div>
  )
}
