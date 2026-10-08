// Label untuk kartu di Bagan dan panel Detail (PLAN.md bagian 15.1).
//
// Kartu dibuat SEDERHANA seperti aplikasi lama: nama (dengan Alm./Almh. dan
// gelar) dan SATU label kecil, yaitu istilah Jawa ("Putu") untuk keturunan
// dengan "GEN.n" di pojok, "Pangkal" untuk pasangan pangkal, dan TANPA label
// untuk pasangan (warnanya sudah menandakan pasangan). Tahun lahir–wafat,
// "Anak ke-n", "dari istri ke-n", dan "Pasangan dari …" ada di panel
// keterangan dan Daftar. Anak sambung dan anak angkat tampil SAMA PERSIS
// dengan saudaranya; keterangan "Anak sambung"/"Anak angkat" hanya ada di
// keterangan anak itu sendiri.
import { isiTeks, teks } from '../../teks/id.js'
import { namaTampil } from './nama.js'
import { bandingkanKabur, tahunHidup, tanggalDari, teksPeristiwa, teksWaktu } from './tanggal.js'
import { istilahGenerasi, labelGen, teksGenerasi } from './generasi.js'
import { jenisPasangan, pasanganBerurutan, teksAnakKe, teksPasanganKe } from './urutan.js'
import { orangTuaUnion, pasanganDi, urutanLahir } from './graf.js'

const KATA = teks.silsilah

const hurufBesarAwal = (teks) => teks.charAt(0).toUpperCase() + teks.slice(1)

// "Anak ke-6 · dari istri ke-1". Bagian "dari …" hanya muncul kalau orang
// tua itu pernah punya lebih dari satu pasangan.
export function teksJalur(jalur) {
  const bagian = []
  if (jalur.anakKe != null) bagian.push(teksAnakKe(jalur.anakKe))
  if (jalur.pasanganKe && jalur.pasanganKe.jumlah > 1) {
    bagian.push(`${KATA.dari} ${teksPasanganKe(jalur.pasanganKe.jenis, jalur.pasanganKe.ke)}`)
  }
  return hurufBesarAwal(bagian.join(' · '))
}

const gabungNama = (nama) =>
  nama.length < 2 ? nama.join('') : `${nama.slice(0, -1).join(', ')} ${KATA.dan} ${nama.at(-1)}`

// "Pasangan dari [nama]" untuk orang yang bukan keturunan; "· bercerai" kalau
// pernikahan terakhirnya dengan setiap keturunan itu berakhir cerai.
export function keteranganPasangan(s, id) {
  const terakhir = new Map() // keturunan → pernikahan terakhir dengan orang ini
  for (const u of s.graf.pernikahan.get(id) ?? []) {
    const pasangan = pasanganDi(u, id)
    if (pasangan && s.gen.has(pasangan)) {
      terakhir.delete(pasangan) // supaya urutan nama mengikuti pernikahan terakhir
      terakhir.set(pasangan, u)
    }
  }
  if (terakhir.size === 0) return ''
  const nama = [...terakhir.keys()].map((p) => namaTampil(s.graf.orang.get(p)))
  const bercerai = [...terakhir.values()].every((u) => u.status === 'cerai')
  return `${KATA.pasanganDari} ${gabungNama(nama)}${bercerai ? ` · ${KATA.bercerai}` : ''}`
}

// jenis: 'pangkal' (GEN.0) | 'keturunan' | 'pasangan' (bukan keturunan).
// label: satu label kecil di bawah nama; pojok: "GEN.n" di pojok kartu.
// panggilan hanya untuk pencarian, tidak tampil di kartu.
export function labelKartu(s, id) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const jenis = gen === null ? 'pasangan' : gen === 0 ? 'pangkal' : 'keturunan'
  const istilah = gen === null ? null : istilahGenerasi(gen, s.daftarGenerasi)
  return {
    id,
    nama: namaTampil(orang),
    sex: orang.sex === 'L' || orang.sex === 'P' ? orang.sex : null,
    wafat: Boolean(orang.is_deceased),
    panggilan: orang.nickname ?? null,
    jenis,
    gen,
    labelGen: gen === null ? null : labelGen(gen),
    istilahGen: istilah,
    label: jenis === 'pasangan' ? null : istilah,
    pojok: jenis === 'keturunan' ? labelGen(gen) : null,
  }
}

// Untuk Daftar: tahun lahir–wafat dan keterangan singkat ("Anak ke-6 · dari
// istri ke-1", atau "Pasangan dari …").
export function keteranganDaftar(s, id) {
  const orang = s.graf.orang.get(id)
  const utama = s.jalur.get(id)?.[0]
  return {
    tahun: tahunHidup(orang),
    keterangan: !s.gen.has(id) ? keteranganPasangan(s, id) : utama ? teksJalur(utama) : '',
  }
}

// Panel keterangan (format aplikasi lama). Semua teks sudah jadi, siap tampil:
//   subjudul     "Putu · Generasi ke-2" (istilah Jawa dulu), "Pangkal",
//                atau "Pasangan dari Bima · bercerai"
//   jenisKelamin "Laki-laki" / "Perempuan" / "Tidak diketahui"
//   orangTua     [{ orang: [{ id, nama }], jenis }]: satu baris per pasangan
//                orang tua ("Bima & Eka"); jenis = "Anak sambung Cahya" /
//                "Anak angkat" (kata lembut, HANYA di keterangan anak itu)
//   urutan       ["Anak ke-6 · dari istri ke-1"]; antarsepupu: satu baris per
//                orang tua ("Anak ke-1 dari Rangga")
//   lewat        antarsepupu dengan GEN berbeda: "Lewat Gendis: Canggah · Generasi ke-4"
//   pasangan     [{ id, nama, ke ("Istri ke-1" kalau lebih dari satu), cerai,
//                   waktu ("Menikah tahun 1970, bercerai tahun 1976") }]
//   lahir, wafat "Kota, 12 Maret 1950"
//   anak         [{ id, nama }] urut lahir, lintas semua pernikahan
export function labelDetail(s, id) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const nama = (pid) => namaTampil(s.graf.orang.get(pid))

  // Orang tua: satu baris per hubungan anak (biasanya satu).
  const orangTua = (s.graf.tautan.get(id) ?? []).map((t) => {
    const u = s.graf.unions.get(t.union_id)
    const ids = orangTuaUnion(u)
    let jenis = KATA.jenisAnak[t.kind] ?? null
    if (t.kind === 'sambung') {
      // Anak sambung dari orang tua yang BUKAN orang tua kandungnya.
      const sambung = t.biological_parent === 'partner2' ? u.partner1_id : t.biological_parent === 'partner1' ? u.partner2_id : null
      if (sambung) jenis = isiTeks(KATA.anakSambungDari, { nama: nama(sambung) })
    }
    return { unionId: u.id, orang: ids.map((pid) => ({ id: pid, nama: nama(pid) })), jenis }
  })

  // Urutan lahir: dari orang tua keturunan. Kalau kedua orang tua keturunan
  // (antarsepupu), satu baris untuk masing-masing. Anak pasangan pangkal
  // BUKAN antarsepupu walaupun kedua pangkal ber-GEN.0: cukup satu baris.
  const jalur = (s.jalur.get(id) ?? []).filter((j, i) => i === 0 || s.gen.get(j.orangTuaId) !== 0)
  const urutan =
    jalur.length > 1
      ? jalur.filter((j) => j.anakKe != null).map((j) => isiTeks(KATA.anakKeDari, { n: j.anakKe, nama: nama(j.orangTuaId) }))
      : jalur.map(teksJalur).filter(Boolean)
  const lain = jalur.find((j) => j.gen !== gen)
  const lewat =
    jalur.length > 1 && lain
      ? isiTeks(KATA.lewat, { nama: nama(lain.orangTuaId), generasi: teksGenerasi(lain.gen, s.daftarGenerasi) })
      : null

  // Pasangan: satu baris per pasangan yang berbeda, berurutan.
  const unions = s.graf.pernikahan.get(id) ?? []
  const berurutan = pasanganBerurutan(unions, id)
  const pasangan = berurutan.map((p, i) => {
    const daftar = p.unionIds.map((uid) => s.graf.unions.get(uid))
    const bagian = daftar.map((u, j) => {
      const menikah = teksWaktu(tanggalDari(u, 'marriage'))
      const akhir = teksWaktu(tanggalDari(u, 'end'))
      const kalimat = []
      if (menikah) kalimat.push(`${j === 0 ? KATA.menikahPertama : KATA.menikahLagi} ${menikah}`)
      else if (j > 0) kalimat.push(KATA.menikahLagi)
      if (u.status === 'cerai' && akhir) kalimat.push(`${KATA.bercerai} ${akhir}`)
      return kalimat.join(', ')
    })
    const waktu = bagian.filter(Boolean).join('; ')
    return {
      id: p.pasanganId,
      nama: p.pasanganId ? nama(p.pasanganId) : null,
      ke: berurutan.length > 1 ? hurufBesarAwal(teksPasanganKe(jenisPasangan(p.pasanganId ? s.graf.orang.get(p.pasanganId) : null), i + 1)) : null,
      cerai: daftar.at(-1).status === 'cerai',
      waktu: waktu ? hurufBesarAwal(waktu) : '',
    }
  })

  // Anak dari semua pernikahan, urut lahir.
  const anakId = [...new Set(unions.flatMap((u) => (s.graf.anakUnion.get(u.id) ?? []).map((c) => c.child_id)))]
  const rank = (c) => urutanLahir(s.graf, id, c) ?? Infinity
  anakId.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      bandingkanKabur(tanggalDari(s.graf.orang.get(a), 'birth'), tanggalDari(s.graf.orang.get(b), 'birth')) ||
      (a < b ? -1 : 1)
  )

  const subjudul =
    gen === null
      ? keteranganPasangan(s, id)
      : gen === 0
        ? (istilahGenerasi(0, s.daftarGenerasi) ?? teksGenerasi(0, s.daftarGenerasi))
        : teksGenerasi(gen, s.daftarGenerasi)

  return {
    id,
    nama: namaTampil(orang),
    sex: orang.sex === 'L' || orang.sex === 'P' ? orang.sex : null,
    subjudul,
    jenisKelamin: KATA.jenisKelamin[orang.sex === 'L' || orang.sex === 'P' ? orang.sex : 'x'],
    panggilan: orang.nickname ?? null,
    orangTua,
    urutan,
    lewat,
    pasangan,
    nomor: s.nomor.get(id) ?? null,
    lahir: teksPeristiwa(orang, 'birth'),
    wafat: teksPeristiwa(orang, 'death'),
    anak: anakId.map((c) => ({ id: c, nama: nama(c) })),
    pekerjaan: orang.occupation ?? null,
    catatan: orang.notes ?? null,
  }
}
