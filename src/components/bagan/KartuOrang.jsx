import { warnaKartu } from '../../lib/bagan/warna.js'

const SIMBOL = { L: '♂', P: '♀' }

// Satu kartu di Bagan, seperti aplikasi lama: strip warna tipis di tepi
// atas, lingkaran kecil berisi simbol ♂/♀, NAMA kapital (Cinzel, boleh dua
// baris), dan satu label kecil kapital di bawahnya. GEN di pojok kartu.
// Warnanya menurut warnaKartu (keturunan/pasangan, jenis kelamin, pangkal,
// wafat). Gaya: .kartu-orang di index.css. Letak (rem) dari tata letak bagan.
//
// Kartu RUJUKAN (pernikahan antarsepupu): pasangan yang juga keturunan dan
// punya kartu utama di cabangnya sendiri. Warnanya tetap warna keturunan,
// labelnya "Dari cabang lain", dan mengetuknya melompat ke kartu utamanya.
export function KartuOrang({ kartu, letak, terpilih = false, rujukan = null, saatKetuk, ...sisa }) {
  return (
    <button
      type="button"
      {...(rujukan ? { 'data-rujukan': kartu.id, 'aria-label': rujukan.aria } : { 'data-orang': kartu.id, 'aria-pressed': terpilih })}
      data-warna={warnaKartu(kartu)}
      data-sex={kartu.sex ?? 'x'}
      data-wafat={kartu.wafat || undefined}
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
      <span className="kartu-nama">{kartu.nama}</span>
      {rujukan ? (
        <span className="kartu-label">{rujukan.label}</span>
      ) : (
        kartu.label && <span className="kartu-label">{kartu.label}</span>
      )}
    </button>
  )
}
