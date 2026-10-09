import { UKURAN } from '../../lib/bagan/tata.js'
import { isiTeks, teks } from '../../teks/id.js'
import { IkonHati } from './IkonHati.jsx'
import { KartuOrang } from './KartuOrang.jsx'

const T = teks.bagan
const rem = (n) => `${n}rem`
const jalur = (titik) => titik.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')

// Satu keturunan dengan pernikahan dan anak-anaknya. Kartu diletakkan
// menurut tata letak (posisi absolut), tetapi urutan di halaman tetap
// berupa daftar bersarang, supaya pembaca layar membacanya sebagai silsilah.
// Satu kelompok per pernikahan, dari kiri ke kanan menurut waktu; pasangan
// yang dinikahi kembali tampil lagi dengan keterangan "menikah kembali".
function Simpul({ simpul, tata, terpilih, sorot, saatKetuk, saatLompat }) {
  const letak = (kunci) => tata.letak.get(kunci)
  return (
    <li>
      <KartuOrang
        kartu={simpul.kartu}
        letak={letak(`o:${simpul.id}`)}
        terpilih={terpilih === simpul.id}
        disorot={sorot === simpul.id}
        saatKetuk={saatKetuk}
      />
      {simpul.pasangan.map((k, i) => {
        const kunci = `${simpul.id}:${i}`
        const lLabel = letak(`l:${kunci}`)
        const lKartu = letak(`p:${kunci}`)
        const lCatatan = letak(`c:${kunci}`)
        return (
          <div key={kunci}>
            <span className="sr-only">
              {isiTeks(k.berpisah ? T.pasanganDariBerpisah : T.pasanganDari, { nama: simpul.kartu.nama })}
              {k.ulang && ` (${T.menikahKembali})`}
            </span>
            {(k.label || k.ulang) && lLabel && (
              <span
                aria-hidden="true"
                data-label-pasangan
                className="absolute flex flex-col items-center justify-end pb-1 text-sm font-bold uppercase leading-tight tracking-wide text-emas-teks"
                style={{ left: rem(lLabel.x), top: rem(lLabel.y), width: rem(UKURAN.lebarKartu), height: rem(lLabel.tinggi ?? UKURAN.tinggiLabel) }}
              >
                {k.label}
                {k.ulang && <span className="text-xs font-semibold normal-case tracking-normal text-redup">{T.menikahKembali}</span>}
              </span>
            )}
            {k.kartu && lKartu && !k.keturunan && (
              <KartuOrang
                kartu={k.kartu}
                letak={lKartu}
                ulang={k.ulang}
                terpilih={terpilih === k.id}
                disorot={!k.ulang && sorot === k.id}
                saatKetuk={saatKetuk}
                aria-label={
                  k.label || k.ulang
                    ? `${k.label ? `${k.label}: ` : ''}${k.kartu.nama}${k.ulang ? ` (${T.menikahKembali})` : ''}`
                    : undefined
                }
              />
            )}
            {k.kartu && lKartu && k.keturunan && (
              <KartuOrang
                kartu={k.kartu}
                letak={lKartu}
                rujukan={{
                  label: T.cabangLain,
                  aria: `${k.label ? `${k.label}: ` : ''}${isiTeks(T.rujukan, { nama: k.kartu.nama })}`,
                }}
                saatKetuk={saatLompat}
              />
            )}
            {k.anakDi && lCatatan && (
              <button
                type="button"
                data-catatan={k.anakDi.id}
                onClick={() => saatLompat(k.anakDi.id)}
                className="bagan-catatan absolute min-h-12"
                style={{ left: rem(lCatatan.x), top: rem(lCatatan.y), width: rem(UKURAN.lebarCatatan), height: rem(UKURAN.tinggiCatatan) }}
              >
                {isiTeks(T.anakDiCabang, { nama: k.anakDi.nama })}
              </button>
            )}
            {!k.kartu && lKartu && (
              <div data-warna="x" className="kartu-orang absolute cursor-default" style={{ left: rem(lKartu.x), top: rem(lKartu.y) }}>
                <span aria-hidden="true" className="kartu-simbol">?</span>
                <span className="kartu-nama">{T.pasanganTidakDiketahui}</span>
              </div>
            )}
            {k.anak.length > 0 && (
              <ul aria-label={k.kartu ? isiTeks(T.anakBerdua, { nama: simpul.kartu.nama, pasangan: k.kartu.nama }) : isiTeks(T.anakDari, { nama: simpul.kartu.nama })}>
                {k.anak.map((a) => (
                  <Simpul key={a.id} simpul={a} tata={tata} terpilih={terpilih} sorot={sorot} saatKetuk={saatKetuk} saatLompat={saatLompat} />
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
// saatLompat(id): ke kartu utama seseorang (dari kartu rujukan atau catatan).
export function GambarBagan({ akar, tata, terpilih, sorot = null, saatKetuk, saatLompat }) {
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
          data-patah={h.patah || undefined}
          className="bagan-hati absolute"
          style={{ left: rem(h.x - UKURAN.jariHati), top: rem(h.y - UKURAN.jariHati), width: rem(2 * UKURAN.jariHati), height: rem(2 * UKURAN.jariHati) }}
        >
          <IkonHati patah={h.patah} className="size-[62%]" />
        </span>
      ))}
      <ul>
        <Simpul simpul={akar} tata={tata} terpilih={terpilih} sorot={sorot} saatKetuk={saatKetuk} saatLompat={saatLompat} />
      </ul>
    </div>
  )
}
