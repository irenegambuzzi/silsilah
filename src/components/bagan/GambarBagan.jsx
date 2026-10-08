import { UKURAN } from '../../lib/bagan/tata.js'
import { isiTeks, teks } from '../../teks/id.js'
import { KartuOrang } from './KartuOrang.jsx'

const T = teks.bagan
const rem = (n) => `${n}rem`
const jalur = (titik) => titik.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')

// Label kecil kapital di bawah nama: istilah generasi untuk keturunan.
const labelUntuk = (kartu) => (kartu.jenis === 'pasangan' ? null : kartu.istilahGen)
const genUntuk = (kartu) => (kartu.jenis === 'keturunan' && kartu.gen > 0 ? kartu.labelGen : null)

// Satu keturunan dengan pernikahan dan anak-anaknya. Kartu diletakkan
// menurut tata letak (posisi absolut), tetapi urutan di halaman tetap
// berupa daftar bersarang, supaya pembaca layar membacanya sebagai silsilah.
function Simpul({ simpul, tata, terpilih, saatKetuk }) {
  const letak = (kunci) => tata.letak.get(kunci)
  return (
    <li>
      <KartuOrang
        kartu={simpul.kartu}
        letak={letak(`o:${simpul.id}`)}
        label={labelUntuk(simpul.kartu)}
        gen={genUntuk(simpul.kartu)}
        terpilih={terpilih === simpul.id}
        saatKetuk={saatKetuk}
      />
      {simpul.pasangan.map((k, i) => {
        const kunci = `${simpul.id}:${i}`
        const lLabel = letak(`l:${kunci}`)
        const lKartu = letak(`p:${kunci}`)
        return (
          <div key={kunci}>
            <span className="sr-only">
              {isiTeks(k.cerai ? T.pasanganDariCerai : T.pasanganDari, { nama: simpul.kartu.nama })}
            </span>
            {k.label && lLabel && (
              <span
                aria-hidden="true"
                className="absolute flex items-end justify-center pb-1 text-sm font-bold uppercase tracking-wide text-emas-teks"
                style={{ left: rem(lLabel.x), top: rem(lLabel.y), width: rem(UKURAN.lebarKartu), height: rem(UKURAN.tinggiLabel) }}
              >
                {k.label}
              </span>
            )}
            {k.kartu && lKartu && (
              <KartuOrang
                kartu={k.kartu}
                letak={lKartu}
                label={labelUntuk(k.kartu)}
                terpilih={terpilih === k.id}
                saatKetuk={saatKetuk}
                aria-label={k.label ? `${k.label}: ${k.kartu.nama}` : undefined}
              />
            )}
            {!k.kartu && lKartu && (
              <div className="kartu-orang absolute cursor-default" style={{ left: rem(lKartu.x), top: rem(lKartu.y) }}>
                <span aria-hidden="true" className="kartu-simbol">?</span>
                <span className="kartu-nama">{T.pasanganTidakDiketahui}</span>
              </div>
            )}
            {k.anak.length > 0 && (
              <ul aria-label={k.kartu ? isiTeks(T.anakBerdua, { nama: simpul.kartu.nama, pasangan: k.kartu.nama }) : isiTeks(T.anakDari, { nama: simpul.kartu.nama })}>
                {k.anak.map((a) => (
                  <Simpul key={a.id} simpul={a} tata={tata} terpilih={terpilih} saatKetuk={saatKetuk} />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </li>
  )
}

// Seluruh bagan: garis (SVG) di belakang, ikon hati, lalu kartu.
export function GambarBagan({ akar, tata, terpilih, saatKetuk }) {
  return (
    <div className="relative" style={{ width: rem(tata.lebar), height: rem(tata.tinggi) }}>
      <svg
        aria-hidden="true"
        className="absolute left-0 top-0 overflow-visible"
        style={{ width: rem(tata.lebar), height: rem(tata.tinggi) }}
        viewBox={`0 0 ${tata.lebar} ${tata.tinggi}`}
      >
        {tata.garis.map((g) => (
          <path
            key={g.kunci}
            d={jalur(g.titik)}
            data-garis={g.jenis}
            data-putus={g.putus || undefined}
            className={`bagan-garis bagan-garis-${g.jenis}${g.putus ? ' bagan-garis-putus' : ''}`}
          />
        ))}
      </svg>
      {tata.hati.map((h) => (
        <span
          key={h.kunci}
          aria-hidden="true"
          data-hati={h.kunci}
          className="bagan-hati absolute"
          style={{ left: rem(h.x - UKURAN.jariHati), top: rem(h.y - UKURAN.jariHati), width: rem(2 * UKURAN.jariHati), height: rem(2 * UKURAN.jariHati) }}
        >
          ♥
        </span>
      ))}
      <ul>
        <Simpul simpul={akar} tata={tata} terpilih={terpilih} saatKetuk={saatKetuk} />
      </ul>
    </div>
  )
}
