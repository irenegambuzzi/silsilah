// Menyusun pohon untuk Bagan dari turunan silsilah (susunSilsilah).
//
// Setiap keturunan punya SATU simpul: kartunya, pernikahannya, dan anak yang
// "dimiliki"-nya. Pernikahan disusun dari KIRI ke KANAN menurut waktu
// terjadinya, SATU kelompok per pernikahan: istri ke-1 → istri ke-2 →
// istri ke-1 (menikah kembali) → istri ke-3. Pernikahan kembali dengan
// pasangan yang sama tampil sebagai hati tersendiri dengan kartu pasangan
// yang muncul lagi ("menikah kembali"), dan anak-anak berada di bawah hati
// pernikahannya masing-masing, sehingga membaca bagan dari kiri ke kanan
// menghasilkan urutan kelahiran.
//
// Di bawah setiap pernikahan, SEMUA anak (kandung, sambung, angkat) disusun
// menurut umur, dari yang paling tua di kiri (anak.js). Hanya anak kandung
// yang diberi nomor urut di pojok kartunya.
//
// Seorang anak ditaruh di bawah orang tua di jalur pertamanya (generasi.js):
// untuk anak dari pernikahan antarsepupu SELALU pihak laki-laki (sama dengan
// GEN-nya); kalau jenis kelamin belum diketahui, jalur terdekat ke pangkal.
// Jadi anak itu muncul sekali saja; di tempat orang tua yang lain (pihak
// perempuan), kelompok pernikahan itu mencatat di mana anak mereka berada
// (`anakDi`).
import { labelKartu } from '../silsilah/kartu.js'
import { jenisPasangan, pasanganBerurutan, teksPasanganKe } from '../silsilah/urutan.js'
import { namaSingkat } from '../silsilah/nama.js'
import { pasanganDi } from '../silsilah/graf.js'
import { anakOrangTua, anakPernikahanMenurutUmur } from '../silsilah/anak.js'

const hurufBesarAwal = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// Mode fokus (`fokus`: id keturunan, putaran ketujuh): bagan dimulai dari
// orang itu dan memuat SEMUA keturunannya (keturunanCabang), lewat anak
// laki-laki maupun perempuan. Anak dari perempuan di cabang ini yang menikah
// dengan laki-laki dari cabang lain tampil di bawah pernikahan itu (di sini
// dimiliki oleh si ibu), beserta keturunannya; anak laki-laki itu dari
// pernikahan lain tidak. Kalau kedua orang tua di cabang ini, anaknya tetap
// di pihak ayah, seperti di bagan lengkap. Tanpa `fokus`: bagan lengkap,
// tidak berubah.
//
// Mengembalikan null kalau pangkal belum ditentukan. Selain itu:
//   akar     simpul pangkal (mode fokus: orang yang difokuskan)
//   simpul   Map orang → simpul (hanya keturunan)
//   induk    Map orang → id keturunan yang memilikinya sebagai anak
//   tempat   Map orang → id simpul tempat orang itu tampil (keturunan: dirinya;
//            pasangan yang bukan keturunan: pasangan pertamanya)
// simpul = { id, kartu, pasangan: [kelompok], anak: [simpul] (kiri ke kanan) }
//   kartu.urut  nomor urut di pojok kartu (anak kandung saja), atau null
// kelompok (satu per pernikahan, berurutan menurut waktu) = {
//   id        pasangan (null = tidak diketahui)
//   unionId   pernikahan
//   kartu     kartu pasangan (null kalau tidak diketahui)
//   label     "Istri ke-2" (hanya kalau menikah dengan lebih dari satu orang;
//             "ke-n" menurut pasangan yang BERBEDA)
//   ulang     pernikahan kembali dengan pasangan yang sudah tampil di kiri
//   berpisah  pernikahan ini berakhir karena berpisah
//   keturunan pasangan ini juga keturunan dengan tempatnya sendiri (antarsepupu)
//   anak      anak dari pernikahan ini yang tampil di sini, menurut umur
//   anakDi    { id, nama (singkat, tanpa gelar), anak: [id] (menurut umur) }
//             kalau anak mereka tampil di tempat pasangan itu; di mode fokus
//             hanya kalau pasangan itu juga di cabang ini
// }
export function susunBagan(s, { hariIni = new Date(), fokus = null } = {}) {
  const root = s.graf.rootUnionId ? s.graf.unions.get(s.graf.rootUnionId) : null
  if (!root) return null
  const cabang = fokus ? keturunanCabang(s, fokus) : null

  const simpul = new Map()
  const induk = new Map()
  const tempat = new Map()
  const diproses = new Set()

  // Jalur yang menentukan letak anak: jalur pertama (generasi.js); di mode
  // fokus, jalur pertama lewat orang tua di cabang itu.
  const jalurPemilik = (anakId) => {
    const jalur = s.jalur.get(anakId) ?? []
    return cabang ? jalur.find((j) => cabang.has(j.orangTuaId)) : jalur[0]
  }
  const pemilik = (anakId) => jalurPemilik(anakId)?.orangTuaId ?? null
  const punyaTempat = (id) => (s.jalur.get(id) ?? []).length > 0
  const kartuDari = (id, urut = null) => ({ ...labelKartu(s, id, { hariIni }), urut })

  const bangun = (id, urut = null) => {
    diproses.add(id)
    const node = { id, kartu: kartuDari(id, urut), pasangan: [], anak: [] }
    simpul.set(id, node)
    tempat.set(id, id)

    const unions = s.graf.pernikahan.get(id) ?? []
    const berbeda = pasanganBerurutan(unions, id)
    const nomorPasangan = new Map()
    berbeda.forEach((p, i) => p.unionIds.forEach((uid) => nomorPasangan.set(uid, i)))
    const jumlahDikenal = berbeda.filter((p) => p.pasanganId).length
    const sudahTampil = new Set()

    const kelompok = unions.map((u) => {
      const pasanganId = pasanganDi(u, id)
      const ulang = Boolean(pasanganId && sudahTampil.has(pasanganId))
      if (pasanganId) sudahTampil.add(pasanganId)
      const anakSemua = [...new Set((s.graf.anakUnion.get(u.id) ?? []).map((c) => c.child_id))]
      const milikSini = anakPernikahanMenurutUmur(s.graf, u, id, anakSemua.filter((c) => pemilik(c) === id))
      const anakPasangan = pasanganId ? anakSemua.filter((c) => pemilik(c) === pasanganId) : []
      const orang = pasanganId ? s.graf.orang.get(pasanganId) : null
      if (pasanganId && !s.gen.has(pasanganId) && !tempat.has(pasanganId)) tempat.set(pasanganId, id)
      return {
        id: pasanganId,
        unionId: u.id,
        kartu: pasanganId ? kartuDari(pasanganId) : null,
        label: jumlahDikenal > 1 ? hurufBesarAwal(teksPasanganKe(jenisPasangan(orang), nomorPasangan.get(u.id) + 1)) : null,
        ulang,
        berpisah: u.status === 'cerai',
        keturunan: Boolean(pasanganId && punyaTempat(pasanganId)),
        anakId: milikSini,
        // Mode fokus: catatan "Anak mereka ada di cabang …" hanya kalau
        // tujuannya di dalam cabang ini (cabang terisolasi).
        anakDi:
          anakPasangan.length > 0 && milikSini.length === 0 && (!cabang || cabang.has(pasanganId))
            ? { id: pasanganId, nama: namaSingkat(s.graf, pasanganId), anak: anakPernikahanMenurutUmur(s.graf, u, pasanganId, anakPasangan) }
            : null,
      }
    })

    const { ke } = anakOrangTua(s.graf, id)
    for (const k of kelompok) {
      k.anak = []
      for (const a of k.anakId) {
        if (diproses.has(a)) continue // penjaga: data rusak tidak boleh membuat putaran tanpa henti
        induk.set(a, id)
        const anak = bangun(a, jalurPemilik(a)?.kandung ? (ke.get(a) ?? null) : null)
        k.anak.push(anak)
        node.anak.push(anak)
      }
      delete k.anakId
    }
    node.pasangan = kelompok
    return node
  }

  const akar = bangun(cabang ? fokus : root.partner1_id)
  return { akar, simpul, induk, tempat }
}

// Semua keturunan `id` (termasuk dirinya), lewat orang tua mana pun di jalur
// generasi.js: anak kandung, sambung, dan angkat, dari anak laki-laki maupun
// perempuan, siapa pun pasangannya.
export function keturunanCabang(s, id) {
  const anakDari = new Map()
  for (const [anak, jalur] of s.jalur) {
    for (const j of jalur) {
      if (!anakDari.has(j.orangTuaId)) anakDari.set(j.orangTuaId, [])
      anakDari.get(j.orangTuaId).push(anak)
    }
  }
  const hasil = new Set([id])
  const antre = [id]
  while (antre.length) {
    for (const a of anakDari.get(antre.pop()) ?? []) {
      if (!hasil.has(a)) {
        hasil.add(a)
        antre.push(a)
      }
    }
  }
  return hasil
}

// Semua kartu yang tampil di bagan, dalam urutan bagan (untuk pencarian dan
// panel): `utama` (keturunan dan pasangan yang bukan keturunan, masing-masing
// sekali) dan `rujukan` (kartu "Dari cabang lain" dari pernikahan
// antarsepupu; orangnya punya kartu utama sendiri, di bagan lengkap selalu
// di bagan ini juga).
export function kartuDiBagan(akar) {
  const utama = []
  const rujukan = []
  const ada = new Set()
  const jalan = (s) => {
    utama.push(s.kartu)
    ada.add(s.id)
    for (const k of s.pasangan) {
      if (k.kartu && !k.keturunan && !ada.has(k.id)) {
        utama.push(k.kartu)
        ada.add(k.id)
      }
      if (k.kartu && k.keturunan && !rujukan.some((x) => x.id === k.id)) rujukan.push(k.kartu)
      k.anak.forEach(jalan)
    }
  }
  jalan(akar)
  return { utama, rujukan: rujukan.filter((k) => !ada.has(k.id)) }
}
