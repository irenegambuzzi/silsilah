import { warnaKartu } from '../../lib/bagan/warna.js'

const SIMBOL = { L: '♂', P: '♀' }

// Satu kartu di Bagan, seperti aplikasi lama: strip warna tipis di tepi
// atas, lingkaran kecil berisi simbol ♂/♀, NAMA kapital (Cinzel, boleh dua
// baris), dan satu label kecil kapital di bawahnya. GEN di pojok kartu.
// Warnanya menurut warnaKartu (keturunan/pasangan, jenis kelamin, pangkal,
// wafat). Gaya: .kartu-orang di index.css. Letak (rem) dari tata letak bagan.
export function KartuOrang({ kartu, letak, label = null, gen = null, terpilih = false, saatKetuk, ...sisa }) {
  return (
    <button
      type="button"
      data-orang={kartu.id}
      data-warna={warnaKartu(kartu)}
      data-sex={kartu.sex ?? 'x'}
      data-wafat={kartu.wafat || undefined}
      aria-pressed={terpilih}
      onClick={() => saatKetuk(kartu.id)}
      className="kartu-orang absolute"
      style={{ left: `${letak.x}rem`, top: `${letak.y}rem` }}
      {...sisa}
    >
      <span aria-hidden="true" className="kartu-simbol">
        {SIMBOL[kartu.sex] ?? '?'}
      </span>
      {gen && <span className="kartu-gen">{gen}</span>}
      <span className="kartu-nama">{kartu.nama}</span>
      {label && <span className="kartu-label">{label}</span>}
    </button>
  )
}
