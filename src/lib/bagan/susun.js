// Menyusun pohon untuk Bagan dari turunan silsilah (susunSilsilah).
//
// Setiap keturunan punya SATU simpul: kartunya, pernikahannya (satu
// kelompok per pasangan yang berbeda, berurutan), dan anak yang
// "dimiliki"-nya. Seorang anak ditaruh di bawah orang tua di jalur terdekat
// ke pangkal (jalur pertama; kalau sama dekat, pihak partner1), di bawah
// pernikahan orang tuanya. Jadi anak dari pernikahan antarsepupu muncul
// sekali saja; di tempat orang tua yang lain, kelompok pernikahan itu
// mencatat di mana anak mereka berada (`anakDi`).
import { labelKartu } from '../silsilah/kartu.js'
import { jenisPasangan, pasanganBerurutan, teksPasanganKe } from '../silsilah/urutan.js'
import { namaTampil } from '../silsilah/nama.js'
import { bandingkanKabur, tanggalDari } from '../silsilah/tanggal.js'

const hurufBesarAwal = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// Mengembalikan null kalau pangkal belum ditentukan. Selain itu:
//   akar     simpul pangkal
//   simpul   Map orang → simpul (hanya keturunan)
//   induk    Map orang → id keturunan yang memilikinya sebagai anak
//   tempat   Map orang → id simpul tempat orang itu tampil (keturunan: dirinya;
//            pasangan yang bukan keturunan: pasangan pertamanya)
// simpul = { id, kartu, pasangan: [kelompok], anak: [simpul] (semua anak, urut lahir) }
// kelompok = {
//   id        pasangan (null = tidak diketahui)
//   kartu     kartu pasangan (null kalau tidak diketahui)
//   label     "Istri ke-2" (hanya kalau menikah dengan lebih dari satu orang)
//   berpisah  pernikahan terakhir dengan pasangan ini berakhir karena berpisah
//   keturunan pasangan ini juga keturunan dengan tempatnya sendiri (antarsepupu)
//   anak      anak dari pernikahan ini yang tampil di sini, urut lahir
//   anakDi    { id, nama } kalau anak mereka tampil di tempat pasangan itu
// }
export function susunBagan(s) {
  const root = s.graf.rootUnionId ? s.graf.unions.get(s.graf.rootUnionId) : null
  if (!root) return null

  const simpul = new Map()
  const induk = new Map()
  const tempat = new Map()
  const diproses = new Set()

  const pemilik = (anakId) => s.jalur.get(anakId)?.[0]?.orangTuaId ?? null
  const punyaTempat = (id) => (s.jalur.get(id) ?? []).length > 0
  const urutan = (a) => s.jalur.get(a)?.[0]?.anakKe ?? Infinity
  const urutLahir = (a, b) =>
    urutan(a) - urutan(b) ||
    bandingkanKabur(tanggalDari(s.graf.orang.get(a), 'birth'), tanggalDari(s.graf.orang.get(b), 'birth')) ||
    (a < b ? -1 : 1)

  const bangun = (id) => {
    diproses.add(id)
    const node = { id, kartu: labelKartu(s, id), pasangan: [], anak: [] }
    simpul.set(id, node)
    tempat.set(id, id)

    const berurutan = pasanganBerurutan(s.graf.pernikahan.get(id) ?? [], id)
    const jumlahDikenal = berurutan.filter((p) => p.pasanganId).length
    const kelompok = berurutan.map((p, i) => {
      const unions = p.unionIds.map((uid) => s.graf.unions.get(uid))
      const anakSemua = unions.flatMap((u) => (s.graf.anakUnion.get(u.id) ?? []).map((c) => c.child_id))
      const milikSini = [...new Set(anakSemua.filter((c) => pemilik(c) === id))].sort(urutLahir)
      const milikPasangan = p.pasanganId && anakSemua.some((c) => pemilik(c) === p.pasanganId)
      const orang = p.pasanganId ? s.graf.orang.get(p.pasanganId) : null
      if (p.pasanganId && !s.gen.has(p.pasanganId) && !tempat.has(p.pasanganId)) tempat.set(p.pasanganId, id)
      return {
        id: p.pasanganId,
        kartu: p.pasanganId ? labelKartu(s, p.pasanganId) : null,
        label: jumlahDikenal > 1 ? hurufBesarAwal(teksPasanganKe(jenisPasangan(orang), i + 1)) : null,
        berpisah: unions.at(-1).status === 'cerai',
        keturunan: Boolean(p.pasanganId && punyaTempat(p.pasanganId)),
        anakId: milikSini,
        anakDi: milikPasangan && milikSini.length === 0 ? { id: p.pasanganId, nama: namaTampil(orang) } : null,
      }
    })

    for (const k of kelompok) {
      k.anak = []
      for (const a of k.anakId) {
        if (diproses.has(a)) continue // penjaga: data rusak tidak boleh membuat putaran tanpa henti
        induk.set(a, id)
        const anak = bangun(a)
        k.anak.push(anak)
        node.anak.push(anak)
      }
      delete k.anakId
    }
    node.pasangan = kelompok
    node.anak.sort((a, b) => urutLahir(a.id, b.id))
    return node
  }

  const akar = bangun(root.partner1_id)
  return { akar, simpul, induk, tempat }
}
