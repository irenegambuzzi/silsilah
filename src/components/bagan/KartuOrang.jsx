import { Sprout } from 'lucide-react'
import { warnaKartu } from '../../lib/bagan/warna.js'
import { teksUrutanKe } from '../../lib/silsilah/urutan.js'
import { teks } from '../../teks/id.js'

const SIMBOL = { L: '♂', P: '♀' }

// Satu kartu di Bagan, seperti aplikasi lama: strip warna tipis di tepi
// atas, lingkaran kecil berisi simbol ♂/♀, NAMA kapital (Cinzel, boleh dua
// baris), dan satu label kecil kapital di bawahnya. Pojok kartu:
//   kanan atas  GEN.n
//   kiri atas   nomor urut (hanya anak KANDUNG; anak sambung/angkat tanpa nomor)
//   kanan bawah tunas daun: belum dewasa (di bawah 18 tahun)
// Warnanya menurut warnaKartu (keturunan/pasangan, jenis kelamin, pangkal,
// wafat). Gaya: .kartu-orang di index.css. Letak (rem) dari tata letak bagan.
//
// Kartu RUJUKAN (pernikahan antarsepupu): pasangan yang juga keturunan dan
// punya kartu utama di cabangnya sendiri. Warnanya tetap warna keturunan,
// labelnya "Dari cabang lain", dan mengetuknya melompat ke kartu utamanya.
// Kartu ULANG: pasangan yang dinikahi kembali, tampil lagi di pernikahan
// berikutnya; mengetuknya memilih orang yang sama.
export function KartuOrang({ kartu, letak, terpilih = false, rujukan = null, ulang = false, saatKetuk, ...sisa }) {
  const penanda = rujukan
    ? { 'data-rujukan': kartu.id, 'aria-label': rujukan.aria }
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
      onClick={() => saatKetuk(kartu.id)}
      className="kartu-orang absolute"
      style={{ left: `${letak.x}rem`, top: `${letak.y}rem` }}
      {...sisa}
    >
      <span aria-hidden="true" className="kartu-simbol">
        {SIMBOL[kartu.sex] ?? '?'}
      </span>
      {rujukan ? (
        <span aria-hidden="true" className="kartu-gen">
          ↗
        </span>
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
      <span className="kartu-nama">{kartu.nama}</span>
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
