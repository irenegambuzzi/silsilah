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

// "Label: isi", seperti aplikasi lama. Isi yang kosong ditulis "-".
function Baris({ nama, children }) {
  const kosong = children == null || children === '' || children === false || (Array.isArray(children) && children.length === 0)
  return (
    <div>
      <dt className="inline font-bold">{nama}: </dt>
      <dd className="inline">{kosong ? T.kosong : children}</dd>
    </div>
  )
}

// "Bima & Eka"; anak sambung: "Umar & Cahya (ibu sambung)". Semua nama bisa diketuk.
const gabungOrang = (orang, saatPilih) =>
  orang.map((o, i) => (
    <span key={o.id}>
      {i > 0 && ' & '}
      <NamaOrang id={o.id} nama={o.nama} saatPilih={saatPilih} />
      {o.sambung && ` (${o.sambung})`}
    </span>
  ))

// Isi keterangan seseorang dalam format aplikasi lama: avatar, NAMA, istilah
// dan generasi; KETERANGAN PRIBADI; RIWAYAT HIDUP; anak. Dipakai di panel
// Bagan dan di halaman orang. `Judul`: elemen judul nama (h1 di halaman
// sendiri, h2 di panel). `aksi`: tempat tombol (+ Anak, + Pasangan, Edit, …)
// yang dibuat di kelompok berikutnya. `tingkat`: tingkat judul bagian (satu
// di bawah judul nama).
//
// Baris yang selalu tampil (isi "-" kalau belum diisi): Panggilan, Jenis
// kelamin, Orang tua (anak angkat: "Orang tua angkat"), Pekerjaan, Lahir,
// Catatan. Nomor silsilah TIDAK ditampilkan (hanya untuk mengurutkan Daftar). Baris yang
// hanya tampil kalau berlaku: Status pernikahan (tidak untuk anak di bawah
// umur), Pasangan (kalau ada data pernikahan), Wafat (yang sudah wafat).
export function KeteranganOrang({ d, saatPilih = null, judul, tingkat = 3, aksi = null }) {
  const banyakPasangan = d.pasangan.length > 1
  return (
    <div className="flex flex-col gap-4 text-lg">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar sex={d.sex} />
        {judul}
        {d.subjudul && <p className="text-base text-redup">{d.subjudul}</p>}
      </div>

      <Bagian judul={T.informasi} tingkat={tingkat}>
        {d.urutan.length > 0 && (
          <div data-urutan>
            {d.urutan.map((u) => (
              <p key={u} className="font-semibold">{u}</p>
            ))}
            {d.lewat && <p className="text-base text-redup">{d.lewat}</p>}
          </div>
        )}
        <dl className="flex flex-col gap-1.5">
          <Baris nama={T.panggilan}>{d.panggilan}</Baris>
          <Baris nama={T.jenisKelamin}>{d.jenisKelamin}</Baris>
          {d.orangTua.length === 0 ? (
            <Baris nama={T.orangTua}>{null}</Baris>
          ) : (
            d.orangTua.map((o) => (
              <Baris key={o.unionId} nama={o.angkat ? T.orangTuaAngkat : T.orangTua}>
                {gabungOrang(o.orang, saatPilih)}
              </Baris>
            ))
          )}
          {d.tampilStatus && <Baris nama={T.statusPernikahan}>{d.statusPernikahan}</Baris>}
          {d.pasangan.length > 0 && (
            <Baris nama={T.pasangan}>
              <ul className={banyakPasangan ? 'mt-1 flex flex-col gap-1.5' : 'inline'}>
                {d.pasangan.map((p, i) => (
                  <li key={p.id ?? `?${i}`} className={banyakPasangan ? '' : 'inline'}>
                    {p.ke && `${p.ke}: `}
                    {p.id ? <NamaOrang id={p.id} nama={p.nama} saatPilih={saatPilih} /> : T.pasanganTidakDiketahui}
                    {p.berpisah && ` (${T.berpisah})`}
                    {p.waktu && <span className="block text-base text-redup">{p.waktu}</span>}
                  </li>
                ))}
              </ul>
            </Baris>
          )}
          <Baris nama={T.pekerjaan}>{d.pekerjaan}</Baris>
        </dl>
      </Bagian>

      <Bagian judul={T.riwayat} tingkat={tingkat}>
        <dl className="flex flex-col gap-1.5">
          <Baris nama={T.lahir}>{d.lahir}</Baris>
          {d.sudahWafat && <Baris nama={T.wafat}>{d.wafat}</Baris>}
          <Baris nama={T.catatan}>{d.catatan && <span className="whitespace-pre-line">{d.catatan}</span>}</Baris>
        </dl>
      </Bagian>

      {d.anak.length > 0 && (
        <Bagian judul={T.anak} tingkat={tingkat}>
          <ol className="flex flex-col gap-1">
            {d.anak.map((a) => (
              <li key={a.id} data-anak={a.id} className="flex gap-2">
                <span aria-hidden={a.ke ? undefined : true} className="min-w-[2ch] shrink-0 text-right tabular-nums">
                  {a.ke ? `${a.ke}.` : ''}
                </span>
                <span>
                  <NamaOrang id={a.id} nama={a.nama} saatPilih={saatPilih} />
                  {a.jenis && <span className="text-base text-redup"> · {a.jenis}</span>}
                  {a.dari && <span className="text-base text-redup"> · {a.dari}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Bagian>
      )}

      {aksi && <div className="flex flex-col gap-2 border-t border-tepi pt-4 sm:flex-row sm:flex-wrap">{aksi}</div>}
    </div>
  )
}
