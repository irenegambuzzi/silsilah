import { HashRouter, Route, Routes, Link } from 'react-router-dom'
import { modeContohAktif } from './lib/modeContoh'

// Kerangka awal: belum ada login dan belum ada data. Halaman sengaja
// tidak memuat nama atau data keluarga apa pun.
// HashRouter: GitHub Pages tidak mendukung rute SPA, dan bagian setelah
// "#" tidak pernah dikirim ke server (penting untuk link undangan).
function Beranda() {
  return (
    <>
      <h1 className="text-3xl font-bold">Silsilah Keluarga</h1>
      <p className="text-lg">Aplikasi ini sedang dibangun.</p>
    </>
  )
}

function TidakDitemukan() {
  return (
    <>
      <h1 className="text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="text-lg">Alamat yang Anda buka tidak ada di aplikasi ini.</p>
      <Link to="/" className="text-lg font-semibold underline">
        Kembali ke halaman awal
      </Link>
    </>
  )
}

export default function App({ Router = HashRouter }) {
  return (
    <Router>
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
        {modeContohAktif && (
          <p role="status" className="rounded bg-yellow-200 p-2 text-base font-semibold">
            MODE CONTOH: data fiktif, bukan data keluarga.
          </p>
        )}
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route path="*" element={<TidakDitemukan />} />
        </Routes>
      </main>
    </Router>
  )
}
