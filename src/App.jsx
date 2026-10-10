import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import KhususAdmin from './components/KhususAdmin.jsx'
import Kerangka from './components/layout/Kerangka.jsx'
import { DataSilsilahProvider } from './lib/data/DataSilsilah.jsx'
import { modeContohAktif } from './lib/modeContoh'
import { useSesi } from './lib/konteksSesi.js'
import { SesiProvider } from './lib/sesi.jsx'
import { teks } from './teks/id'
import Beranda from './pages/Beranda.jsx'
import Bagan from './pages/Bagan.jsx'
import Daftar from './pages/Daftar.jsx'
import Orang from './pages/Orang.jsx'
import { Keadaan, KeadaanMemuat } from './pages/Keadaan.jsx'
import KotakMasuk from './pages/KotakMasuk.jsx'
import Keluar from './pages/Keluar.jsx'
import AksesSementara from './pages/AksesSementara.jsx'
import DuaLangkah from './pages/DuaLangkah.jsx'
import Masuk from './pages/Masuk.jsx'
import Penukaran from './pages/Penukaran.jsx'
import PerangkatSaya from './pages/PerangkatSaya.jsx'
import Privasi from './pages/Privasi.jsx'
import Saya from './pages/Saya.jsx'
import SelamatDatang from './pages/SelamatDatang.jsx'

// Layar Tambah perangkat membawa library kode QR; dimuat hanya saat dibuka.
const TambahPerangkat = lazy(() => import('./pages/TambahPerangkat.jsx'))
// Halaman perbandingan huruf (SEMENTARA): HANYA di mode contoh. Di build
// produksi kondisi ini selalu salah, jadi halaman dan hurufnya dibuang.
const PerbandinganHuruf =
  import.meta.env.DEV && modeContohAktif ? lazy(() => import('./contoh/PerbandinganHuruf.jsx')) : null

// HashRouter: GitHub Pages tidak mendukung rute SPA, dan bagian setelah
// "#" tidak pernah dikirim ke server (penting untuk link undangan).

function TidakDitemukan() {
  return (
    <>
      <h1 className="font-judul text-3xl font-bold text-emas-teks">{teks.aplikasi.tidakDitemukanJudul}</h1>
      <p className="text-lg">{teks.aplikasi.tidakDitemukanIsi}</p>
      <Link to="/" className="inline-flex min-h-12 items-center text-lg font-semibold underline">
        {teks.aplikasi.kembaliKeAwal}
      </Link>
    </>
  )
}

// Layar yang butuh login. Belum masuk → layar Masuk; sedang memeriksa atau
// gagal memeriksa → layar keadaan (tanpa data apa pun). Offline dengan
// salinan di perangkat → layar dibuka untuk membaca.
function Terlindungi({ children }) {
  const { status, galat, coba } = useSesi()
  if (status === 'memuat') return <KeadaanMemuat />
  if (status === 'belumDisiapkan') return <Keadaan jenis="belumDisiapkan" />
  if (status === 'tamu') return <Navigate to="/masuk" replace />
  if (status === 'galat') {
    return <Keadaan jenis={galat?.jenis} pesan={galat?.pesan} bisaCobaLagi={galat?.bisaCobaLagi} onCobaLagi={coba} />
  }
  return children
}

// Layar Masuk hanya untuk yang belum masuk.
function Tamu({ children }) {
  const { status } = useSesi()
  if (status === 'memuat') return <KeadaanMemuat />
  if (status === 'masuk' || status === 'offline') return <Navigate to="/" replace />
  return children
}

export default function App({ Router = HashRouter, klien }) {
  const lindungi = (layar) => <Terlindungi>{layar}</Terlindungi>
  // Setiap rute /admin/… WAJIB lewat admin(): admin utama harus terverifikasi
  // dua langkah dulu (tes aturan di App.test.jsx memastikannya).
  const admin = (layar) => lindungi(<KhususAdmin>{layar}</KhususAdmin>)
  return (
    <Router>
      <SesiProvider {...(klien !== undefined ? { klien } : {})}>
        <DataSilsilahProvider>
        <Kerangka
          spanduk={
            modeContohAktif && (
              <p role="status" className="bg-yellow-200 p-2 text-center text-base font-semibold text-black">
                MODE CONTOH: data fiktif, bukan data keluarga.
              </p>
            )
          }
        >
          <Suspense fallback={<KeadaanMemuat />}>
          <Routes>
            <Route path="/" element={lindungi(<Beranda />)} />
            <Route path="/bagan" element={lindungi(<Bagan />)} />
            <Route path="/daftar" element={lindungi(<Daftar />)} />
            <Route path="/orang/:id" element={lindungi(<Orang />)} />
            <Route path="/masuk" element={<Tamu><Masuk /></Tamu>} />
            <Route path="/u/:token" element={<Penukaran jenis="undangan" />} />
            <Route path="/kode/:kode" element={<Penukaran jenis="kode" />} />
            <Route path="/privasi" element={<Privasi />} />
            <Route path="/selamat-datang" element={lindungi(<SelamatDatang />)} />
            <Route path="/saya" element={lindungi(<Saya />)} />
            <Route path="/saya/tambah-perangkat" element={lindungi(<TambahPerangkat />)} />
            <Route path="/saya/perangkat" element={lindungi(<PerangkatSaya />)} />
            <Route path="/saya/keluar" element={lindungi(<Keluar />)} />
            <Route path="/saya/dua-langkah" element={lindungi(<DuaLangkah />)} />
            <Route path="/kotak-masuk" element={lindungi(<KotakMasuk />)} />
            <Route path="/admin/akses-sementara" element={admin(<AksesSementara />)} />
            {PerbandinganHuruf && <Route path="/contoh/huruf" element={lindungi(<PerbandinganHuruf />)} />}
            <Route path="*" element={<TidakDitemukan />} />
          </Routes>
          </Suspense>
        </Kerangka>
        </DataSilsilahProvider>
      </SesiProvider>
    </Router>
  )
}
