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
import { namaKartu, namaSingkat, namaTampil } from './nama.js'
import { tahunHidup, tanggalDari, teksPeristiwa, teksWaktu } from './tanggal.js'
import { istilahGenerasi, labelGen, teksGenerasi } from './generasi.js'
import { jenisPasangan, pasanganBerurutan, teksBersaudara, teksPasanganKe, teksUrutanKe } from './urutan.js'
import { orangTuaUnion, pasanganDi } from './graf.js'
import { anakOrangTua, kandungUntuk, orangTuaSambung } from './anak.js'
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

// true kalau GEN dan istilah orang ini tidak ditampilkan: keturunan tanpa
// garis darah/angkat (generasi.js), atau pasangan pangkal cabang yang
// pangkal cabangnya seperti itu.
function tanpaGenDi(s, id) {
  if (!s.tanpaGen) return false
  if (s.tanpaGen.has(id)) return true
  return Boolean(s.pasanganCabang?.has(id) && s.tanpaGen.has(s.pangkalCabang))
}

// jenis: 'pangkal' (GEN.0) | 'keturunan' | 'pasangan' (bukan keturunan).
// label: satu label kecil di bawah nama; pojok: "GEN.n" di pojok kartu.
// Di cabang yang dihitung dari orang tertentu (bagan/cabang.js), orang itu
// berlabel "Pangkal cabang" dengan GEN.0, tetapi warnanya tetap warna
// keturunan (emas hanya untuk pasangan pangkal utama). Pasangannya (yang
// bukan keturunan) juga "Pangkal cabang" dengan GEN.0, berwarna pasangan.
// belumDewasa: penanda tunas daun di pojok kartu (di bawah 18 tahun).
// panggilan hanya untuk pencarian, tidak tampil di kartu.
export function labelKartu(s, id, { hariIni = new Date() } = {}) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const pasanganCabang = Boolean(s.pasanganCabang?.has(id))
  const genAsli = pasanganCabang ? 0 : (s.gen.get(id) ?? null)
  const pangkalCabang = s.pangkalCabang === id || pasanganCabang
  const jenis = pasanganCabang || genAsli === null ? 'pasangan' : genAsli === 0 && !pangkalCabang ? 'pangkal' : 'keturunan'
  // Keturunan tanpa garis darah/angkat (generasi.js, tanpaGen): kartu
  // keturunan biasa, tetapi tanpa GEN dan istilah Jawa. Juga kalau ia
  // pangkal cabang (dan pasangannya): label "Pangkal cabang" tanpa GEN.
  const tanpaGen = tanpaGenDi(s, id)
  const gen = tanpaGen ? null : genAsli
  const istilah = pangkalCabang ? KATA.pangkalCabang : gen === null ? null : istilahGenerasi(gen, s.daftarGenerasi)
  return {
    id,
    nama: namaTampil(orang),
    // Bentuk nama di kartu Bagan: gelar terpisah (nama.js); ukuran dan baris dari lebar (bagan/barisNama.js).
    namaKartu: namaKartu(orang),
    sex: orang.sex === 'L' || orang.sex === 'P' ? orang.sex : null,
    wafat: Boolean(orang.is_deceased),
    panggilan: orang.nickname ?? null,
    jenis,
    gen,
    labelGen: gen === null ? null : labelGen(gen),
    istilahGen: istilah,
    label: pangkalCabang ? istilah : jenis === 'pasangan' ? KATA.labelPasangan : istilah,
    pojok: gen !== null && (jenis === 'keturunan' || pangkalCabang) ? labelGen(gen) : null,
    belumDewasa: belumDewasa(orang, hariIni),
  }
}

// Keterangan pembeda di daftar hasil pencarian (putaran ketujuh), supaya
// nama yang sama di cabang berbeda bisa dibedakan. Panel detail tidak
// memakainya.
//   [istilah] · [hubungan] · panggilan: [panggilan]
// - Istilah generasi di depan, sama dengan di kartu (cara hitung bagan saat
//   itu, `tampil`); tanpa istilah kalau kartunya tanpa istilah.
// - Anak (punya orang tua di silsilah): "putra Kirana & Harvel", kedua orang
//   tua yang tercatat, KANDUNG; anak angkat memakai orang tua angkat (tanpa
//   kata "angkat"). Orang tua yang keturunan dulu, lalu pasangannya; kalau
//   keduanya keturunan atau keduanya bukan: ayah dulu. Kalau tidak ada orang
//   tua yang keturunan tetapi pasangan orang tuanya keturunan: penghubung
//   dalam kurung, "putra Harvel (suami Kirana)".
// - Pasangan (bukan keturunan): "istri Yoga (putra Lorvan & Sinta)": orang
//   yang dinikahinya, lalu orang tua orang itu dalam kurung.
// - "suami"/"istri" kalau pernikahan itu masih berlangsung (juga kalau
//   pasangannya wafat); "pasangan" kalau berpisah atau jenis kelamin belum
//   diisi.
// - "Keturunan" = punya GEN di bagan lengkap (silsilah utama `s`).
// - Nama: nama depan tanpa gelar, dua kata kalau nama depan itu dipakai lebih
//   dari satu orang (nama.js, namaSingkat).
// - Nama panggilan di akhir, tidak pernah dibuang. Kalau seluruhnya lebih dari
//   60 huruf, bagian dalam kurung dibuang.
const BATAS_CARI = 60
const URUT_SEX = { L: 0, P: 1, x: 2 }
const sexDari = (s, id) => {
  const sex = s.graf.orang.get(id)?.sex
  return sex === 'L' || sex === 'P' ? sex : 'x'
}
const berGen = (s, id) => s.gen.has(id) && !s.tanpaGen?.has(id)

// Orang tua yang tercatat: kandung; kalau tidak ada, orang tua angkat.
function orangTuaTercatat(s, id) {
  const kandung = []
  const angkat = []
  for (const t of s.graf.tautan.get(id) ?? []) {
    const u = s.graf.unions.get(t.union_id)
    for (const p of orangTuaUnion(u)) {
      if (t.kind === 'angkat') {
        if (!angkat.includes(p)) angkat.push(p)
      } else if (kandungUntuk(t, u, p) && !kandung.includes(p)) kandung.push(p)
    }
  }
  const ortu = kandung.length > 0 ? kandung : angkat
  // Keturunan dulu; sesudah itu (atau kalau sama) ayah dulu. Sort stabil.
  return ortu.sort((a, b) => Number(berGen(s, b)) - Number(berGen(s, a)) || URUT_SEX[sexDari(s, a)] - URUT_SEX[sexDari(s, b)])
}

// "suami"/"istri" (pernikahan terakhir dengan orang itu masih berlangsung),
// selain itu "pasangan".
function sebutanPasangan(s, id, pernikahan) {
  const sex = sexDari(s, id)
  if (pernikahan.status === 'cerai' || sex === 'x') return KATA.jenisPasangan.pasangan
  return sex === 'L' ? KATA.jenisPasangan.suami : KATA.jenisPasangan.istri
}

// Orang yang dinikahi `id` (berbeda, menurut urutan pernikahan) dengan
// pernikahan TERAKHIR dengan masing-masing, yang memenuhi `syarat`.
function pasanganYang(s, id, syarat) {
  const terakhir = new Map()
  for (const u of s.graf.pernikahan.get(id) ?? []) {
    const p = pasanganDi(u, id)
    if (p && syarat(p)) terakhir.set(p, u)
  }
  return [...terakhir]
}

// "putra Kirana & Harvel" (tanpa kurung), atau null kalau tidak ada orang tua.
function teksAnakDari(s, id, ortu) {
  if (ortu.length === 0) return null
  return isiTeks(KATA.cariAnak[sexDari(s, id)], { nama: ortu.map((p) => namaSingkat(s.graf, p)).join(' & ') })
}

export function keteranganCari(s, id, { tampil = s } = {}) {
  const orang = s.graf.orang.get(id)
  if (!orang) return ''
  const k = labelKartu(tampil, id)
  const istilah = k.istilahGen ?? (k.gen === null ? null : labelGen(k.gen))
  const panggilan = orang.nickname ? isiTeks(KATA.cariPanggilanAkhir, { panggilan: orang.nickname }) : null

  let inti = null
  let kurung = null
  const ortu = orangTuaTercatat(s, id)
  if (ortu.length > 0) {
    inti = teksAnakDari(s, id, ortu)
    if (!ortu.some((p) => berGen(s, p))) {
      for (const p of ortu) {
        const [hubung] = pasanganYang(s, p, (q) => berGen(s, q))
        if (hubung) {
          kurung = `${sebutanPasangan(s, p, hubung[1])} ${namaSingkat(s.graf, hubung[0])}`
          break
        }
      }
    }
  } else if (!s.gen.has(id)) {
    // Pasangan: orang yang dinikahinya yang keturunan; kalau tidak ada,
    // keturunan tanpa GEN (Ratrisa Kemuntari, istri Vino).
    let dinikahi = pasanganYang(s, id, (q) => berGen(s, q))
    if (dinikahi.length === 0) dinikahi = pasanganYang(s, id, (q) => s.gen.has(q))
    if (dinikahi.length > 0) {
      inti = dinikahi.map(([p, u]) => `${sebutanPasangan(s, id, u)} ${namaSingkat(s.graf, p)}`).join(', ')
      if (dinikahi.length === 1) kurung = teksAnakDari(s, dinikahi[0][0], orangTuaTercatat(s, dinikahi[0][0]))
    }
  }
  const susun = (denganKurung) =>
    [istilah, inti && (denganKurung && kurung ? `${inti} (${kurung})` : inti), panggilan].filter(Boolean).join(' · ')
  const panjang = susun(true)
  return panjang.length > BATAS_CARI ? susun(false) : panjang
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
//                atau "Pasangan dari Bima · berpisah"; null (tidak tampil)
//                untuk keturunan tanpa GEN (generasi.js, tanpaGen)
//   jenisKelamin "Laki-laki" / "Perempuan" / "Tidak diketahui"
//   panggilan, pekerjaan, catatan   (null kalau kosong)
//   (Nomor silsilah sengaja tidak ada di sini: tidak pernah ditampilkan.)
//   orangTua     [{ jenis, sex, orang: [{ id, nama }] }], satu baris per jenis:
//                jenis "kandung": "Orang tua: Bima & Eka" (ayah dulu; satu
//                nama saja kalau hanya satu yang tercatat);
//                jenis "sambung", per jenis kelamin (sex L/P/x): "Ayah
//                sambung: Harvel", "Ibu sambung: Fitri, Gita" (urut waktu
//                pernikahan; ayah sambung dulu, lalu ibu sambung). Hanya
//                kalau anak itu hidup selama pernikahan itu (orangTuaSambung);
//                jenis "angkat": "Orang tua angkat: Lorvan & Sinta".
//   urutan       kalimat di bawah judul KETERANGAN PRIBADI, tanpa label:
//                "Putri ke-3 dari 11 bersaudara"; antarsepupu: sekali kalau
//                sama bagi kedua orang tua ("Putra tunggal"), selain itu satu
//                kalimat per orang tua ("… (pihak Rangga)"). Tanpa kalimat
//                "Anak sambung …"/"Anak angkat …" (putaran keenam)
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
//                   ("anak sambung"/"anak angkat"), dari ("dari pernikahan dengan Eka",
//                   "dari pernikahan sebelumnya") }]
//                menurut umur: anak kandung bernomor, anak sambung/angkat
//                disisipkan menurut tanggal lahirnya. Anak sambung termasuk
//                anak pasangan dari hubungan lain ("Celvia · anak sambung"
//                di panel Harvel), untuk keturunan maupun pasangan
//   masihAnak    belum 18 tahun, atau wafat sebelum 18 tahun
export function labelDetail(s, id, { hariIni = new Date() } = {}) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const tanpaGen = tanpaGenDi(s, id)
  const nama = (pid) => namaTampil(s.graf.orang.get(pid))

  // Orang tua: baris "Orang tua" (kandung, ayah dulu), lalu "Ayah sambung"
  // dan "Ibu sambung" (urut waktu pernikahan, dari orangTuaSambung: satu
  // sumber dengan daftar anak sambung), lalu "Orang tua angkat".
  const tautan = s.graf.tautan.get(id) ?? []
  const sambungSemua = orangTuaSambung(s.graf).get(id) ?? []
  // Baris "Orang tua" hanya memuat orang tua KANDUNG (kandungUntuk): orang
  // tua sambung tidak pernah masuk ke sana. Anak sambung yang orang tua
  // kandungnya tidak tercatat (database menolaknya, tetapi data rusak tetap
  // aman): tidak satu pun orang tua di hubungan itu ditulis sebagai orang tua.
  const kandung = []
  for (const t of tautan.filter((x) => x.kind !== 'angkat')) {
    const u = s.graf.unions.get(t.union_id)
    for (const pid of orangTuaUnion(u)) if (kandungUntuk(t, u, pid) && !kandung.includes(pid)) kandung.push(pid)
  }
  const sexDari = (pid) => {
    const sex = s.graf.orang.get(pid)?.sex
    return sex === 'L' || sex === 'P' ? sex : 'x'
  }
  const URUT_SEX = { L: 0, P: 1, x: 2 }
  const ayahDulu = (ids) => [...ids].sort((a, b) => URUT_SEX[sexDari(a)] - URUT_SEX[sexDari(b)])
  const isi = (ids) => ids.map((pid) => ({ id: pid, nama: nama(pid) }))
  const orangTua = []
  if (kandung.length > 0) orangTua.push({ jenis: 'kandung', orang: isi(ayahDulu(kandung)) })
  for (const sex of ['L', 'P', 'x']) {
    const ids = sambungSemua.filter((x) => sexDari(x.id) === sex).map((x) => x.id)
    if (ids.length > 0) orangTua.push({ jenis: 'sambung', sex, orang: isi(ids) })
  }
  for (const t of tautan.filter((x) => x.kind === 'angkat')) {
    orangTua.push({ jenis: 'angkat', orang: isi(ayahDulu(orangTuaUnion(s.graf.unions.get(t.union_id)))) })
  }

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
  // (Kalimat "Anak sambung …"/"Anak angkat …" dihapus di putaran keenam:
  // cukup baris "Ayah sambung"/"Ibu sambung"/"Orang tua angkat".)
  const lain = jalur.find((j) => j.gen !== gen)
  // Di cabang yang dihitung ulang, GEN jalur lain tidak lagi sebanding.
  const lewat =
    jalur.length > 1 && lain && !s.pangkalCabang && !tanpaGen
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
  // bernomor; "dari pernikahan dengan Eka" (tanpa angka) hanya kalau orang
  // tua ini menikah dengan lebih dari satu orang; menikah kembali dengan
  // orang yang sama tetap "dari pernikahan dengan Eka"; anak kandung yang
  // dibawanya ke pernikahan (anak sambung bagi pasangannya): "dari
  // pernikahan sebelumnya".
  const { ke, panel } = anakOrangTua(s.graf, id)
  const dariPernikahan = new Map() // pernikahan → "dari pernikahan dengan Eka"
  if (berurutan.length > 1) {
    for (const p of berurutan) {
      const teksDari = p.pasanganId ? isiTeks(KATA.dariPernikahanDengan, { nama: nama(p.pasanganId) }) : KATA.dariPernikahanTanpaNama
      for (const uid of p.unionIds) dariPernikahan.set(uid, teksDari)
    }
  }
  const anak = panel.map((a) => ({
    id: a.id,
    nama: nama(a.id),
    ke: a.kandung ? ke.get(a.id) : null,
    jenis: a.kandung ? null : (KATA.jenisAnakKecil[a.kind] ?? null),
    // Anak sambung dari sisi pasangan lahir dari hubungan lain: tanpa "dari …".
    dari: a.sambung ? null : a.lain ? KATA.dariSebelumnya : (dariPernikahan.get(a.unionId) ?? null),
  }))

  const subjudul =
    s.pangkalCabang === id || s.pasanganCabang?.has(id)
      ? KATA.pangkalCabang
      : gen === null
        ? keteranganPasangan(s, id)
        : tanpaGen
        ? null
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
    lahir: teksPeristiwa(orang, 'birth') || null,
    sudahWafat: Boolean(orang.is_deceased),
    wafat: orang.is_deceased ? teksPeristiwa(orang, 'death') || null : null,
    anak,
    pekerjaan: orang.occupation ?? null,
    catatan: orang.notes ?? null,
    masihAnak: anakKecil,
  }
}
