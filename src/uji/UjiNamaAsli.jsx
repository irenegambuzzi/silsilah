// Halaman uji ukuran nama dengan nama ASLI (SEMENTARA, HANYA LOKAL; putaran
// 7c, bagian B). Hanya dirender oleh main.jsx kalau build pengembangan DAN
// VITE_UJI_NAMA_ASLI=1 (npm run uji:nama-asli); dibuang dari build produksi
// (tes build memastikannya). Nama diminta ke server pengembangan saat halaman
// dibuka, hanya disimpan di memori halaman, dan tidak pernah ditulis ke
// penyimpanan browser.
//
// Bingkai selebar HP (390 px) di atas sebagai dasar penilaian; bingkai lebar
// komputer di bawahnya hanya pemeriksaan tambahan. Ukuran A–E dan aturannya
// sama dengan /contoh/ukuran (pilihanUkuran.js, barisNama.js).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { KartuOrang } from '../components/bagan/KartuOrang.jsx'
import { KonteksUkuranNama } from '../components/bagan/ukuranNama.js'
import { PILIHAN_UKURAN, teksPilihan } from '../contoh/pilihanUkuran.js'
import { TINGKAT_NAMA } from '../lib/bagan/barisNama.js'
import { kartuSkenario, ringkas, SKENARIO } from './namaAsli.js'

const ALAMAT_DATA = '/__uji-nama-asli/data'

// Teks halaman ini sengaja DI SINI, bukan di teks/id.js: halamannya tidak
// pernah ikut ke build produksi.
const T = {
  spanduk: 'DATA ASLI — HANYA DI KOMPUTER INI. Jangan ambil tangkapan layar dan jangan bagikan halaman ini.',
  judul: 'Uji ukuran nama (nama asli, sementara)',
  isi: 'Setiap nama memakai ukuran terbesar yang muat, dengan aturan yang sama seperti Bagan dan /contoh/ukuran. Bingkai selebar HP adalah dasar penilaian; bingkai lebar komputer hanya pemeriksaan tambahan.',
  memuat: 'Memuat nama…',
  gagal: 'Nama tidak bisa dimuat. Pastikan halaman ini dibuka lewat npm run uji:nama-asli.',
  ringkasan: 'Ringkasan menurut aturan Bagan (semua nama)',
  bingkaiHp: 'Selebar HP (390 px), dasar penilaian',
  bingkaiKomputer: 'Lebar komputer (pemeriksaan tambahan)',
  layar: 'Pemeriksaan di layar, bingkai HP',
}

function Info({ orang }) {
  const hitung = (f) => orang.filter(f).length
  const baris = [
    ['Jumlah orang', orang.length],
    ['Keturunan / pasangan', `${hitung((o) => o.peran !== 'pasangan')} / ${hitung((o) => o.peran === 'pasangan')}`],
    ['Jenis kelamin dari data / perkiraan / tidak diketahui', `${hitung((o) => o.sexDari === 'data')} / ${hitung((o) => o.sexDari === 'perkiraan')} / ${hitung((o) => !o.sex)}`],
    ['Wafat (ada tanggal wafat)', hitung((o) => o.wafat)],
  ]
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-base">
      {baris.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function TabelRingkasan({ orang }) {
  const isi = useMemo(
    () =>
      SKENARIO.map((s) => {
        const kartu = kartuSkenario(orang, s.kunci)
        return { ...s, gelarAsli: kartu.filter((k) => k.gelarAsli).length, pilihan: PILIHAN_UKURAN.map((p) => ({ huruf: p.huruf, h: ringkas(kartu, p.ukuran) })) }
      }),
    [orang]
  )
  const sel = 'border border-tepi px-2 py-1 text-right'
  return (
    <div className="flex flex-col gap-4">
      {isi.map((s) => (
        <section key={s.kunci} aria-label={s.judul} data-skenario={s.kunci} className="overflow-x-auto">
          <h3 className="text-lg font-semibold">
            {s.judul}
            {s.kunci === 'perkiraan' && ` · gelar asli dari data: ${s.gelarAsli}`}
          </h3>
          <table className="border-collapse text-base">
            <thead>
              <tr>
                {['Pilihan', '1 baris', '2 baris', '3 baris', ...TINGKAT_NAMA, 'cadangan (tidak muat)', 'melebihi lebar', 'melebihi tinggi', 'terpotong "…"'].map((k) => (
                  <th key={k} className="border border-tepi px-2 py-1 text-left">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.pilihan.map(({ huruf, h }) => (
                <tr key={huruf} data-pilihan={huruf}>
                  <th className="border border-tepi px-2 py-1 text-left">{huruf}</th>
                  <td className={sel}>{h.baris[1]}</td>
                  <td className={sel}>{h.baris[2]}</td>
                  <td className={sel}>{h.baris[3]}</td>
                  {TINGKAT_NAMA.map((t) => <td key={t} className={sel}>{h.tingkat[t]}</td>)}
                  <td className={sel}>{h.cadangan}</td>
                  <td className={sel}>{h.melebihiLebar}</td>
                  <td className={sel}>{h.melebihiTinggi}</td>
                  <td className={sel}>{h.terpotong}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

function Deretan({ kartu }) {
  return (
    <div className="flex flex-wrap gap-4">
      {kartu.map((k) => (
        <div key={k.id} className="relative h-[6.75rem] w-40 shrink-0">
          <KartuOrang kartu={k} letak={{ x: 0, y: 0 }} saatKetuk={() => {}} />
        </div>
      ))}
    </div>
  )
}

// Hitungan di layar: nama yang lebih lebar dari kartunya, atau memuat "…".
// Hasil ukur ditulis langsung ke paragrafnya (setelah kartu tergambar).
function PemeriksaanLayar({ wadah, kunci }) {
  const keluaran = useRef(null)
  useLayoutEffect(() => {
    const bingkai = wadah.current
    if (!bingkai || !keluaran.current) return
    let lebar = 0
    let terpotong = 0
    for (const n of bingkai.querySelectorAll('.kartu-nama')) {
      const batas = n.closest('.kartu-orang').getBoundingClientRect()
      const lewat = [...n.querySelectorAll('.kartu-nama-baris')].some((b) => b.getBoundingClientRect().right > batas.right + 0.5)
      if (lewat || n.scrollWidth > n.clientWidth + 1) lebar++
      if (n.textContent.includes('…')) terpotong++
    }
    keluaran.current.textContent = `${T.layar}: melebihi lebar ${lebar}, terpotong "…" ${terpotong}`
  }, [wadah, kunci])
  return <p ref={keluaran} className="text-base" data-pemeriksaan-layar />
}

function Isi({ orang }) {
  const [skenario, setSkenario] = useState('tanpa')
  const [huruf, setHuruf] = useState('A')
  const pilihan = PILIHAN_UKURAN.find((p) => p.huruf === huruf)
  const kartu = useMemo(() => kartuSkenario(orang, skenario), [orang, skenario])
  const hp = useRef(null)
  const tombol = (aktif) =>
    `min-h-12 rounded-lg border-2 px-3 text-base font-semibold ${aktif ? 'border-emas bg-emas/20' : 'border-tepi'}`
  return (
    <div className="flex flex-col gap-6">
      <Info orang={orang} />
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{T.ringkasan}</h2>
        <TabelRingkasan orang={orang} />
      </section>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Skenario gelar">
        {SKENARIO.map((s) => (
          <button key={s.kunci} type="button" aria-pressed={skenario === s.kunci} className={tombol(skenario === s.kunci)} onClick={() => setSkenario(s.kunci)}>
            {s.judul}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pilihan ukuran">
        {PILIHAN_UKURAN.map((p) => (
          <button key={p.huruf} type="button" aria-pressed={huruf === p.huruf} className={tombol(huruf === p.huruf)} onClick={() => setHuruf(p.huruf)}>
            {p.huruf}
          </button>
        ))}
      </div>
      <p className="text-base">{teksPilihan(pilihan)}</p>
      <KonteksUkuranNama.Provider value={pilihan.ukuran}>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{T.bingkaiHp}</h2>
          <div className="overflow-x-auto">
            <div ref={hp} data-bingkai="hp" className="bagan-latar w-[390px] rounded-xl border border-tepi p-3">
              <Deretan kartu={kartu} />
            </div>
          </div>
          {/* Sesudah bingkai: diukur setelah kartu-kartunya terpasang. */}
          <PemeriksaanLayar wadah={hp} kunci={`${skenario}-${huruf}`} />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{T.bingkaiKomputer}</h2>
          <div data-bingkai="komputer" className="bagan-latar rounded-xl border border-tepi p-3">
            <Deretan kartu={kartu} />
          </div>
        </section>
      </KonteksUkuranNama.Provider>
    </div>
  )
}

export default function UjiNamaAsli({ ambil = fetch }) {
  const [keadaan, setKeadaan] = useState({ status: 'memuat' })
  useEffect(() => {
    let batal = false
    ambil(ALAMAT_DATA, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal'))))
      .then((d) => !batal && setKeadaan({ status: 'siap', orang: d.orang ?? [] }))
      .catch(() => !batal && setKeadaan({ status: 'gagal' }))
    return () => {
      batal = true
    }
  }, [ambil])
  return (
    <>
      <p role="alert" data-spanduk="data-asli" className="sticky top-0 z-50 bg-red-700 p-3 text-center text-lg font-bold text-white">
        {T.spanduk}
      </p>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
        <h1 className="font-judul text-3xl font-bold text-emas-teks">{T.judul}</h1>
        <p className="text-lg">{T.isi}</p>
        {keadaan.status === 'memuat' && <p className="text-lg">{T.memuat}</p>}
        {keadaan.status === 'gagal' && <p className="text-lg">{T.gagal}</p>}
        {keadaan.status === 'siap' && <Isi orang={keadaan.orang} />}
      </main>
    </>
  )
}
