import { useMemo } from 'react'
import { Sprout } from 'lucide-react'
import { barisNamaKartu } from '../../lib/bagan/barisNama.js'
import { warnaKartu } from '../../lib/bagan/warna.js'
import { teksUrutanKe } from '../../lib/silsilah/urutan.js'
import { teks } from '../../teks/id.js'
import { useUkuranNama } from './ukuranNama.js'

const SIMBOL = { L: '♂', P: '♀' }

// Nama di kartu (namaKartu di lib/silsilah/nama.js, baris di
// lib/bagan/barisNama.js): Lora tebal sedang, huruf besar-kecil; ukuran
// terbesar yang muat, satu sampai dua baris (tiga untuk nama bergelar)
// menurut lebar yang diukur, gelar di span tersendiri (Plus Jakarta Sans,
// lebih kecil dan tipis) yang menempel pada kata di sebelahnya. Nama tidak
// pernah dipotong dan tidak pernah melebihi lebar kartu: kalau tidak muat,
// gelar dikecilkan (--skala-gelar) atau gelar belakang pindah baris
// (putaran 7c-2; index.css).
function NamaKartu({ kartu }) {
  const ukuranNama = useUkuranNama()
  const n = kartu.namaKartu
  const susunan = useMemo(() => (n && n.kata.length > 0 ? barisNamaKartu(n, ukuranNama) : null), [n, ukuranNama])
  if (!susunan) return <span className="kartu-nama">{kartu.nama}</span>
  const isiBaris = (bagian) =>
    bagian.map((b, j) => {
      const spasi = j < bagian.length - 1 ? ' ' : ''
      if (b.gelar) {
        return (
          <span key={j}>
            <span className="kartu-gelar">{b.gelar}</span>
            {spasi}
          </span>
        )
      }
      if (!b.depan && !b.belakang && !b.koma) return `${b.kata}${spasi}`
      return (
        <span key={j}>
          <span className="kartu-nama-utuh">
            {b.depan && <span className="kartu-gelar">{`${b.depan} `}</span>}
            {b.kata}
            {b.belakang && <span className="kartu-gelar">{`, ${b.belakang}`}</span>}
            {b.koma && <span className="kartu-gelar">,</span>}
          </span>
          {spasi}
        </span>
      )
    })
  const akhir = susunan.baris.length - 1
  return (
    <span
      className="kartu-nama"
      data-ukuran={susunan.ukuran}
      data-kata={n.jumlahKata}
      data-baris={susunan.baris.length}
      data-gelar-kecil={susunan.skalaGelar < 0.8 || undefined}
      data-gelar-pindah={susunan.gelarPindah || undefined}
      data-dihitung={susunan.dihitung || undefined}
      style={{ '--ukuran-nama': `${susunan.rem}rem`, ...(susunan.skalaGelar < 0.8 ? { '--skala-gelar': susunan.skalaGelar } : {}) }}
    >
      {susunan.baris.map((bagian, i) => (
        <span key={i} className="kartu-nama-baris">
          {isiBaris(bagian)}
          {i < akhir && ' '}
        </span>
      ))}
    </span>
  )
}

// Satu kartu di Bagan, seperti aplikasi lama: strip warna tipis di tepi
// atas, lingkaran kecil berisi simbol ♂/♀, nama (Lora, huruf besar-kecil,
// paling banyak dua atau tiga baris), dan satu label kecil kapital di bawahnya. Pojok kartu:
//   kanan atas  GEN.n
//   kiri atas   nomor urut (hanya anak KANDUNG; anak sambung/angkat tanpa nomor)
//   kanan bawah tunas daun: belum dewasa (di bawah 18 tahun)
// Ukuran nama dari lebarnya (NamaKartu); nama tidak pernah terpotong.
// disorot: hasil pencarian yang sedang ditunjuk (cincin emas tebal), tanpa
// membuka panel; terpilih: kartu yang diketuk (panelnya terbuka).
// Warnanya menurut warnaKartu (keturunan/pasangan, jenis kelamin, pangkal,
// wafat). Gaya: .kartu-orang di index.css. Letak (rem) dari tata letak bagan.
//
// Kartu RUJUKAN (pernikahan antarsepupu): pasangan yang juga keturunan dan
// punya kartu utama di cabangnya sendiri. Warnanya tetap warna keturunan,
// labelnya "Dari cabang lain", dan mengetuknya melompat ke kartu utamanya.
// Saat fokus cabang tanpa tanda ↗ (rujukan.panah false); orang di luar cabang
// (rujukan.luar) hanya dibuka panelnya, jadi tetap di cabang itu.
// Kartu ULANG: pasangan yang dinikahi kembali, tampil lagi di pernikahan
// berikutnya; mengetuknya memilih orang yang sama.
export function KartuOrang({ kartu, letak, terpilih = false, disorot = false, rujukan = null, ulang = false, saatKetuk, ...sisa }) {
  const penanda = rujukan
    ? { 'data-rujukan': kartu.id, 'aria-label': rujukan.aria, ...(rujukan.luar ? { 'aria-pressed': terpilih } : {}) }
    : ulang
      ? { 'data-orang-ulang': kartu.id, 'aria-pressed': terpilih }
      : { 'data-orang': kartu.id, 'aria-pressed': terpilih }
  return (
    <button
      type="button"
      {...penanda}
      data-warna={warnaKartu(kartu)}
      data-sex={kartu.sex ?? 'x'}
      data-wafat={kartu.wafat || undefined}
      data-belum-dewasa={kartu.belumDewasa || undefined}
      data-sorot={disorot || undefined}
      aria-current={disorot || undefined}
      onClick={() => saatKetuk(kartu.id)}
      className="kartu-orang absolute"
      style={{ left: `${letak.x}rem`, top: `${letak.y}rem` }}
      {...sisa}
    >
      <span aria-hidden="true" className="kartu-simbol">
        {SIMBOL[kartu.sex] ?? '?'}
      </span>
      {rujukan ? (
        rujukan.panah !== false && (
          <span aria-hidden="true" className="kartu-gen">
            ↗
          </span>
        )
      ) : (
        kartu.pojok && <span className="kartu-gen">{kartu.pojok}</span>
      )}
      {!rujukan && kartu.urut != null && (
        <>
          <span aria-hidden="true" className="kartu-urut" data-urut={kartu.urut}>
            {kartu.urut}
          </span>
          <span className="sr-only">{teksUrutanKe(kartu.sex, kartu.urut)}</span>
        </>
      )}
      <NamaKartu kartu={kartu} />
      {rujukan ? (
        <span className="kartu-label">{rujukan.label}</span>
      ) : (
        kartu.label && <span className="kartu-label">{kartu.label}</span>
      )}
      {kartu.belumDewasa && (
        <span className="kartu-tunas" data-tunas>
          <Sprout aria-hidden="true" className="size-full" />
          <span className="sr-only">{teks.bagan.belumDewasa}</span>
        </span>
      )}
    </button>
  )
}
