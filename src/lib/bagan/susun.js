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
// Seorang anak ditaruh di bawah orang tua di jalur terdekat ke pangkal
// (jalur pertama; kalau sama dekat, pihak partner1), di bawah pernikahan
// orang tuanya. Jadi anak dari pernikahan antarsepupu muncul sekali saja; di
// tempat orang tua yang lain, kelompok pernikahan itu mencatat di mana anak
// mereka berada (`anakDi`).
import { labelKartu } from '../silsilah/kartu.js'
import { jenisPasangan, pasanganBerurutan, teksPasanganKe } from '../silsilah/urutan.js'
import { namaTampil } from '../silsilah/nama.js'
import { pasanganDi } from '../silsilah/graf.js'
import { anakOrangTua, anakPernikahanMenurutUmur } from '../silsilah/anak.js'

const hurufBesarAwal = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// Mengembalikan null kalau pangkal belum ditentukan. Selain itu:
//   akar     simpul pangkal
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
//   anakDi    { id, nama } kalau anak mereka tampil di tempat pasangan itu
// }
export function susunBagan(s, { hariIni = new Date() } = {}) {
  const root = s.graf.rootUnionId ? s.graf.unions.get(s.graf.rootUnionId) : null
  if (!root) return null

  const simpul = new Map()
  const induk = new Map()
  const tempat = new Map()
  const diproses = new Set()

  const pemilik = (anakId) => s.jalur.get(anakId)?.[0]?.orangTuaId ?? null
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
      const milikPasangan = pasanganId && anakSemua.some((c) => pemilik(c) === pasanganId)
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
        anakDi: milikPasangan && milikSini.length === 0 ? { id: pasanganId, nama: namaTampil(orang) } : null,
      }
    })

    const { ke } = anakOrangTua(s.graf, id)
    for (const k of kelompok) {
      k.anak = []
      for (const a of k.anakId) {
        if (diproses.has(a)) continue // penjaga: data rusak tidak boleh membuat putaran tanpa henti
        induk.set(a, id)
        const anak = bangun(a, s.jalur.get(a)?.[0]?.kandung ? (ke.get(a) ?? null) : null)
        k.anak.push(anak)
        node.anak.push(anak)
      }
      delete k.anakId
    }
    node.pasangan = kelompok
    return node
  }

  const akar = bangun(root.partner1_id)
  return { akar, simpul, induk, tempat }
}
