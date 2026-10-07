import { HashRouter, Route, Routes, Link } from 'react-router-dom'
import { modeContohAktif } from './lib/modeContoh'
import { teks } from './teks/id'

// Kerangka awal: belum ada login dan belum ada data. Halaman sengaja
// tidak memuat nama atau data keluarga apa pun.
// HashRouter: GitHub Pages tidak mendukung rute SPA, dan bagian setelah
// "#" tidak pernah dikirim ke server (penting untuk link undangan).
function Beranda() {
  return (
    <>
      <h1 className="text-3xl font-bold">{teks.aplikasi.nama}</h1>
      <p className="text-lg">{teks.aplikasi.sedangDibangun}</p>
    </>
  )
}

function TidakDitemukan() {
  return (
    <>
      <h1 className="text-3xl font-bold">{teks.aplikasi.tidakDitemukanJudul}</h1>
      <p className="text-lg">{teks.aplikasi.tidakDitemukanIsi}</p>
      <Link to="/" className="text-lg font-semibold underline">
        {teks.aplikasi.kembaliKeAwal}
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
