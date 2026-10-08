import { Link } from 'react-router-dom'
import { Avatar } from '../Avatar.jsx'
import { teks } from '../../teks/id.js'

const T = teks.detail

// Nama orang lain yang bisa diketuk. Di Bagan: memilih dan memusatkan
// kartunya (saatPilih); di halaman orang: membuka halamannya.
function NamaOrang({ id, nama, saatPilih }) {
  if (saatPilih) {
    return (
      <button type="button" onClick={() => saatPilih(id)} className="inline min-h-0 text-left font-semibold underline underline-offset-2 hover:text-emas-teks">
        {nama}
      </button>
    )
  }
  return (
    <Link to={`/orang/${encodeURIComponent(id)}`} className="font-semibold underline underline-offset-2 hover:text-emas-teks">
      {nama}
    </Link>
  )
}

function Bagian({ judul, tingkat, children }) {
  const H = `h${tingkat}`
  return (
    <section className="flex flex-col gap-2 border-t border-tepi pt-4">
      <H className="judul-kecil">{judul}</H>
      {children}
    </section>
  )
}

// "Label: isi", seperti aplikasi lama.
function Baris({ nama, children }) {
  if (children == null || children === '' || children === false) return null
  return (
    <div>
      <dt className="inline font-bold">{nama}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  )
}

const gabungOrang = (orang, saatPilih) =>
  orang.map((o, i) => (
    <span key={o.id}>
      {i > 0 && ' & '}
      <NamaOrang id={o.id} nama={o.nama} saatPilih={saatPilih} />
    </span>
  ))

// Isi keterangan seseorang dalam format aplikasi lama: avatar, NAMA, istilah
// dan generasi; INFORMASI ANGGOTA; RIWAYAT HIDUP; anak; pekerjaan; catatan.
// Dipakai di panel Bagan dan di halaman orang. `Judul`: elemen judul nama
// (h1 di halaman sendiri, h2 di panel). `aksi`: tempat tombol (+ Anak,
// + Pasangan, Edit, …) yang dibuat di kelompok berikutnya. `tingkat`:
// tingkat judul bagian (satu di bawah judul nama).
export function KeteranganOrang({ d, saatPilih = null, judul, tingkat = 3, aksi = null }) {
  return (
    <div className="flex flex-col gap-4 text-lg">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar sex={d.sex} />
        {judul}
        {d.subjudul && <p className="text-base text-redup">{d.subjudul}</p>}
      </div>

      <Bagian judul={T.informasi} tingkat={tingkat}>
        <dl className="flex flex-col gap-1.5">
          <Baris nama={T.jenisKelamin}>{d.jenisKelamin}</Baris>
          <Baris nama={T.panggilan}>{d.panggilan}</Baris>
          {d.orangTua.map((o) => (
            <Baris key={o.unionId} nama={T.orangTua}>
              {gabungOrang(o.orang, saatPilih)}
              {o.jenis && <span className="block text-base text-redup">{o.jenis}</span>}
            </Baris>
          ))}
          {d.urutan.length > 0 && (
            <Baris nama={T.urutan}>
              {d.urutan.length === 1 ? d.urutan[0] : d.urutan.map((u) => <span key={u} className="block">{u}</span>)}
              {d.lewat && <span className="block text-base text-redup">{d.lewat}</span>}
            </Baris>
          )}
          <Baris nama={T.pasangan}>
            {d.pasangan.length === 0 ? (
              T.tidakAda
            ) : (
              <ul className={d.pasangan.length > 1 ? 'mt-1 flex flex-col gap-1.5' : 'inline'}>
                {d.pasangan.map((p, i) => (
                  <li key={p.id ?? `?${i}`} className={d.pasangan.length > 1 ? '' : 'inline'}>
                    {p.ke && `${p.ke}: `}
                    {p.id ? <NamaOrang id={p.id} nama={p.nama} saatPilih={saatPilih} /> : T.pasanganTidakDiketahui}
                    {p.cerai && ` (${T.bercerai})`}
                    {p.waktu && <span className="block text-base text-redup">{p.waktu}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Baris>
          <Baris nama={T.nomor}>{d.nomor}</Baris>
        </dl>
      </Bagian>

      {(d.lahir || d.wafat) && (
        <Bagian judul={T.riwayat} tingkat={tingkat}>
          <dl className="flex flex-col gap-1.5">
            <Baris nama={T.lahir}>{d.lahir}</Baris>
            <Baris nama={T.wafat}>{d.wafat}</Baris>
          </dl>
        </Bagian>
      )}

      {d.anak.length > 0 && (
        <Bagian judul={T.anak} tingkat={tingkat}>
          <ol className="flex flex-col gap-1">
            {d.anak.map((a) => (
              <li key={a.id}>
                <NamaOrang id={a.id} nama={a.nama} saatPilih={saatPilih} />
              </li>
            ))}
          </ol>
        </Bagian>
      )}

      {d.pekerjaan && (
        <Bagian judul={T.pekerjaan} tingkat={tingkat}>
          <p>{d.pekerjaan}</p>
        </Bagian>
      )}
      {d.catatan && (
        <Bagian judul={T.catatan} tingkat={tingkat}>
          <p className="whitespace-pre-line">{d.catatan}</p>
        </Bagian>
      )}

      {aksi && <div className="flex flex-col gap-2 border-t border-tepi pt-4 sm:flex-row sm:flex-wrap">{aksi}</div>}
    </div>
  )
}
