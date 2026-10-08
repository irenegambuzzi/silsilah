import { isiTeks, teks } from '../../teks/id.js'
import { KartuOrang } from './KartuOrang.jsx'

// Satu keturunan, pasangan-pasangannya berdampingan, dan anak-anaknya di
// bawah dengan garis penghubung (gaya CSS: .bagan-anak di index.css).
export function BlokKeluarga({ simpul, terpilih, saatKetuk }) {
  return (
    <li className="flex flex-col items-center">
      <div className="flex items-start justify-center gap-2">
        <KartuOrang kartu={simpul.kartu} terpilih={terpilih === simpul.id} saatKetuk={saatKetuk} />
        {simpul.pasangan.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            {p.label && <span className="text-sm font-semibold">{p.label}</span>}
            <KartuOrang kartu={p.kartu} terpilih={terpilih === p.id} saatKetuk={saatKetuk} />
            {p.anakDi && (
              <span className="w-44 text-center text-sm text-redup">
                {isiTeks(teks.bagan.anakDi, { nama: p.anakDi })}
              </span>
            )}
          </div>
        ))}
      </div>
      {simpul.anak.length > 0 && (
        <ul className="bagan-anak">
          {simpul.anak.map((a) => (
            <BlokKeluarga key={a.id} simpul={a} terpilih={terpilih} saatKetuk={saatKetuk} />
          ))}
        </ul>
      )}
    </li>
  )
}
