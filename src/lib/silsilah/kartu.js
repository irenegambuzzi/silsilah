// Label untuk kartu di Bagan dan panel Detail (PLAN.md bagian 15.1).
//
// Kartu dibuat SEDERHANA seperti aplikasi lama: nama (dengan Alm./Almh. dan
// gelar) dan SATU label kecil, yaitu istilah Jawa ("Putu") untuk keturunan
// dengan "GEN.n" di pojok, "Pangkal" untuk pasangan pangkal, dan "Pasangan"
// (tanpa GEN) untuk pasangan yang bukan keturunan. Tahun lahir–wafat,
// "Putra/Putri ke-n", "dari istri ke-n", dan "Pasangan dari …" ada di panel
// keterangan dan Daftar. Anak sambung dan anak angkat memakai kartu yang
// sama dengan saudaranya, tetapi tidak bernomor (hanya anak kandung yang
// punya "Putra/Putri ke-n").
import { isiTeks, teks } from '../../teks/id.js'
import { namaTampil } from './nama.js'
import { tahunHidup, tanggalDari, teksPeristiwa, teksWaktu } from './tanggal.js'
import { istilahGenerasi, labelGen, teksGenerasi } from './generasi.js'
import { jenisPasangan, pasanganBerurutan, teksBersaudara, teksPasanganKe, teksUrutanKe } from './urutan.js'
import { orangTuaUnion, pasanganDi } from './graf.js'
import { anakOrangTua, kandungUntuk } from './anak.js'
import { statusPernikahan } from './status.js'
import { belumDewasa, masihAnak } from './umur.js'

const KATA = teks.silsilah

const hurufBesarAwal = (teks) => teks.charAt(0).toUpperCase() + teks.slice(1)

// "dari istri ke-1": hanya kalau orang tua itu pernah punya lebih dari satu pasangan.
function teksDariPasangan(pasanganKe) {
  return pasanganKe && pasanganKe.jumlah > 1 ? `${KATA.dari} ${teksPasanganKe(pasanganKe.jenis, pasanganKe.ke)}` : null
}

// Untuk Daftar: "Putra ke-6 · dari istri ke-1". Kosong untuk anak
// sambung/angkat (tidak bernomor).
export function teksJalur(jalur, sex) {
  if (jalur.anakKe == null) return ''
  return [teksUrutanKe(sex, jalur.anakKe), teksDariPasangan(jalur.pasanganKe)].filter(Boolean).join(' · ')
}

const gabungNama = (nama) =>
  nama.length < 2 ? nama.join('') : `${nama.slice(0, -1).join(', ')} ${KATA.dan} ${nama.at(-1)}`

// "Pasangan dari [nama]" untuk orang yang bukan keturunan; "· berpisah" kalau
// pernikahan terakhirnya dengan setiap keturunan itu berakhir karena berpisah.
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
  const berpisah = [...terakhir.values()].every((u) => u.status === 'cerai')
  return `${KATA.pasanganDari} ${gabungNama(nama)}${berpisah ? ` · ${KATA.berpisah}` : ''}`
}

// jenis: 'pangkal' (GEN.0) | 'keturunan' | 'pasangan' (bukan keturunan).
// label: satu label kecil di bawah nama; pojok: "GEN.n" di pojok kartu.
// Di cabang yang dihitung dari orang tertentu (bagan/cabang.js), orang itu
// berlabel "Pangkal cabang" dengan GEN.0, tetapi warnanya tetap warna
// keturunan (emas hanya untuk pasangan pangkal utama).
// belumDewasa: penanda tunas daun di pojok kartu (di bawah 18 tahun).
// panggilan hanya untuk pencarian, tidak tampil di kartu.
export function labelKartu(s, id, { hariIni = new Date() } = {}) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const pangkalCabang = s.pangkalCabang === id
  const jenis = gen === null ? 'pasangan' : gen === 0 && !pangkalCabang ? 'pangkal' : 'keturunan'
  const istilah = gen === null ? null : pangkalCabang ? KATA.pangkalCabang : istilahGenerasi(gen, s.daftarGenerasi)
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
    label: jenis === 'pasangan' ? KATA.labelPasangan : istilah,
    pojok: jenis === 'keturunan' ? labelGen(gen) : null,
    belumDewasa: belumDewasa(orang, hariIni),
  }
}

// Untuk Daftar: tahun lahir–wafat dan keterangan singkat ("Putra ke-6 ·
// dari istri ke-1", atau "Pasangan dari …").
export function keteranganDaftar(s, id) {
  const orang = s.graf.orang.get(id)
  const utama = s.jalur.get(id)?.[0]
  return {
    tahun: tahunHidup(orang),
    keterangan: !s.gen.has(id) ? keteranganPasangan(s, id) : utama ? teksJalur(utama, orang.sex) : '',
  }
}

// Panel keterangan (format aplikasi lama). Semua teks sudah jadi, siap
// tampil; isian yang kosong (null) ditulis "-" oleh layar:
//   subjudul     "Putu · Generasi ke-2" (istilah Jawa dulu), "Pangkal",
//                atau "Pasangan dari Bima · berpisah"
//   jenisKelamin "Laki-laki" / "Perempuan" / "Tidak diketahui"
//   panggilan, pekerjaan, catatan, nomor   (null kalau kosong)
//   orangTua     [{ unionId, angkat, orang: [{ id, nama, sambung }] }]: satu
//                baris per pasangan orang tua ("Bima & Eka"). Anak sambung:
//                orang tua kandung dulu, lalu orang tua sambungnya dengan
//                keterangan (sambung: "ibu sambung"/"ayah sambung"), misalnya
//                "Umar & Cahya (ibu sambung)". Anak angkat (angkat: true):
//                barisnya "Orang tua angkat: Lorvan & Sinta".
//   urutan       kalimat di bawah judul KETERANGAN PRIBADI, tanpa label:
//                "Putri ke-3 dari 11 bersaudara"; antarsepupu: sekali kalau
//                sama bagi kedua orang tua ("Putra tunggal"), selain itu satu
//                kalimat per orang tua ("… (pihak Rangga)"); anak sambung/angkat:
//                "Anak sambung Cahya" / "Anak angkat Lorvan & Sinta"
//   lewat        antarsepupu dengan GEN berbeda: jalur pihak ibu, singkat dan
//                netral: "Lewat Gendis: Canggah · Generasi ke-4"
//   tampilStatus baris "Status pernikahan" tampil (tidak untuk anak di bawah
//                umur tanpa data pernikahan)
//   statusPernikahan "Menikah" / "Berpisah" / "Ditinggal wafat pasangan" /
//                "Belum menikah" (hanya pilihan orangnya sendiri) / null ("-")
//   pasangan     [{ id, nama, ke ("Istri ke-1" kalau lebih dari satu), berpisah,
//                   waktu ("Menikah tahun 1970, berpisah tahun 1976") }]; baris
//                "Pasangan" hanya tampil kalau ada data pernikahan
//   lahir        "Kota, 12 Maret 1950" (null kalau tidak diketahui)
//   sudahWafat, wafat   baris "Wafat" hanya untuk yang sudah wafat
//   anak         [{ id, nama, ke (null untuk anak sambung/angkat), jenis
//                   ("anak sambung"/"anak angkat"), dari ("dari istri ke-2",
//                   "dari pernikahan sebelumnya") }]
//                menurut umur: anak kandung bernomor, anak sambung/angkat
//                disisipkan menurut tanggal lahirnya
//   masihAnak    belum 18 tahun, atau wafat sebelum 18 tahun
export function labelDetail(s, id, { hariIni = new Date() } = {}) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const nama = (pid) => namaTampil(s.graf.orang.get(pid))
  const gabungOrangTua = (u) => orangTuaUnion(u).map(nama).join(' & ')

  // Orang tua: satu baris per hubungan anak (biasanya satu). Anak sambung:
  // orang tua kandungnya dulu, lalu orang tua sambungnya dengan keterangan.
  const tautan = s.graf.tautan.get(id) ?? []
  const orangTua = tautan.map((t) => {
    const u = s.graf.unions.get(t.union_id)
    const orang = orangTuaUnion(u).map((pid) => {
      const sambung = t.kind === 'sambung' && t.biological_parent != null && !kandungUntuk(t, u, pid)
      const sex = s.graf.orang.get(pid)?.sex
      return { id: pid, nama: nama(pid), sambung: sambung ? KATA.orangTuaSambung[sex === 'L' || sex === 'P' ? sex : 'x'] : null }
    })
    orang.sort((a, b) => Number(Boolean(a.sambung)) - Number(Boolean(b.sambung)))
    return { unionId: u.id, angkat: t.kind === 'angkat', orang }
  })

  // Urutan lahir: dari orang tua keturunan, hanya kalau ia anak KANDUNG orang
  // tua itu. Kalau kedua orang tua keturunan (antarsepupu), satu kalimat untuk
  // masing-masing. Anak pasangan pangkal BUKAN antarsepupu walaupun kedua
  // pangkal ber-GEN.0: cukup satu kalimat.
  const jalur = (s.jalur.get(id) ?? []).filter((j, i) => i === 0 || s.gen.get(j.orangTuaId) !== 0)
  // Kalau hasilnya SAMA untuk kedua pihak (misalnya "Putra tunggal" bagi ayah
  // dan bagi ibunya), cukup ditulis sekali tanpa "(pihak …)".
  const bernomor = jalur.filter((j) => j.anakKe != null)
  const kalimatPihak = bernomor.map((j) => teksBersaudara(orang.sex, j.anakKe, anakOrangTua(s.graf, j.orangTuaId).kandung.length))
  const urutan =
    new Set(kalimatPihak).size <= 1
      ? kalimatPihak.slice(0, 1)
      : kalimatPihak.map((kalimat, i) => isiTeks(KATA.pihak, { isi: kalimat, nama: nama(bernomor[i].orangTuaId) }))
  // Anak sambung / anak angkat (kata lembut).
  for (const t of tautan) {
    const u = s.graf.unions.get(t.union_id)
    if (t.kind === 'sambung') {
      // Anak sambung dari orang tua yang BUKAN orang tua kandungnya.
      const sambung = t.biological_parent === 'partner2' ? u.partner1_id : t.biological_parent === 'partner1' ? u.partner2_id : null
      if (sambung) urutan.push(isiTeks(KATA.anakSambungDari, { nama: nama(sambung) }))
    } else if (t.kind === 'angkat') {
      urutan.push(isiTeks(KATA.anakAngkatDari, { nama: gabungOrangTua(u) }))
    }
  }
  const lain = jalur.find((j) => j.gen !== gen)
  // Di cabang yang dihitung ulang, GEN jalur lain tidak lagi sebanding.
  const lewat =
    jalur.length > 1 && lain && !s.pangkalCabang
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
      if (u.status === 'cerai' && akhir) kalimat.push(`${KATA.berpisah} ${akhir}`)
      return kalimat.join(', ')
    })
    const waktu = bagian.filter(Boolean).join('; ')
    return {
      id: p.pasanganId,
      nama: p.pasanganId ? nama(p.pasanganId) : null,
      ke: berurutan.length > 1 ? hurufBesarAwal(teksPasanganKe(jenisPasangan(p.pasanganId ? s.graf.orang.get(p.pasanganId) : null), i + 1)) : null,
      berpisah: daftar.at(-1).status === 'cerai',
      waktu: waktu ? hurufBesarAwal(waktu) : '',
    }
  })

  // Anak dari semua pernikahan, menurut umur, SAMA untuk keturunan dan
  // pasangan: nomor dihitung dari sudut pandang orang ini. Anak kandung
  // bernomor; "dari istri ke-n" hanya kalau orang tua ini pernah punya lebih
  // dari satu pasangan; anak kandung yang dibawanya ke pernikahan (anak
  // sambung bagi pasangannya): "dari pernikahan sebelumnya".
  const { ke, semua } = anakOrangTua(s.graf, id)
  const pasanganKe = new Map()
  berurutan.forEach((p, i) => {
    for (const uid of p.unionIds) {
      pasanganKe.set(uid, { ke: i + 1, jumlah: berurutan.length, jenis: jenisPasangan(p.pasanganId ? s.graf.orang.get(p.pasanganId) : null) })
    }
  })
  const anak = semua.map((a) => ({
    id: a.id,
    nama: nama(a.id),
    ke: a.kandung ? ke.get(a.id) : null,
    jenis: a.kandung ? null : (KATA.jenisAnakKecil[a.kind] ?? null),
    dari: a.lain ? KATA.dariSebelumnya : teksDariPasangan(pasanganKe.get(a.unionId)),
  }))

  const subjudul =
    gen === null
      ? keteranganPasangan(s, id)
      : s.pangkalCabang === id
        ? KATA.pangkalCabang
        : gen === 0
        ? (istilahGenerasi(0, s.daftarGenerasi) ?? teksGenerasi(0, s.daftarGenerasi))
        : teksGenerasi(gen, s.daftarGenerasi)

  const anakKecil = masihAnak(orang, hariIni)
  const status = statusPernikahan(s, id)
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
    tampilStatus: !anakKecil || unions.length > 0,
    statusPernikahan: status ? KATA.statusPernikahan[status] : null,
    pasangan,
    nomor: s.nomor.get(id) ?? null,
    lahir: teksPeristiwa(orang, 'birth') || null,
    sudahWafat: Boolean(orang.is_deceased),
    wafat: orang.is_deceased ? teksPeristiwa(orang, 'death') || null : null,
    anak,
    pekerjaan: orang.occupation ?? null,
    catatan: orang.notes ?? null,
    masihAnak: anakKecil,
  }
}
