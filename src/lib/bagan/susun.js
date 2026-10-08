// Menyusun pohon untuk Bagan dari turunan silsilah (susunSilsilah).
//
// Setiap keturunan punya SATU simpul: kartunya, kartu pasangannya, dan anak
// yang "dimiliki"-nya. Seorang anak ditaruh di bawah orang tua di jalur
// terdekat ke pangkal (jalur pertama; kalau sama dekat, pihak partner1).
// Jadi anak dari pernikahan antarsepupu muncul sekali saja; di simpul orang
// tua yang lain, kartu pasangan diberi catatan "Anak mereka ada di bawah …".
// Pasangan yang juga keturunan tampil di dua tempat: di tempatnya sendiri
// sebagai anak, dan sebagai kartu pasangan.
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
// simpul = { id, kartu, pasangan: [{ id, kartu, label, anakDi }], anak: [simpul] }
export function susunBagan(s) {
  const root = s.graf.rootUnionId ? s.graf.unions.get(s.graf.rootUnionId) : null
  if (!root) return null

  const simpul = new Map()
  const induk = new Map()
  const tempat = new Map()
  const diproses = new Set()

  const pemilik = (anakId) => s.jalur.get(anakId)?.[0]?.orangTuaId ?? null

  const bangun = (id) => {
    diproses.add(id)
    const pernikahan = s.graf.pernikahan.get(id) ?? []
    const berurutan = pasanganBerurutan(pernikahan, id)

    const pasangan = []
    berurutan.forEach((p, i) => {
      if (!p.pasanganId) return
      const orang = s.graf.orang.get(p.pasanganId)
      // Anak dari pernikahan dengan pasangan ini yang dimiliki pasangan itu sendiri.
      const dimilikiPasangan = p.unionIds.some((uid) =>
        (s.graf.anakUnion.get(uid) ?? []).some((c) => pemilik(c.child_id) === p.pasanganId)
      )
      pasangan.push({
        id: p.pasanganId,
        kartu: labelKartu(s, p.pasanganId),
        label: berurutan.length > 1 ? hurufBesarAwal(teksPasanganKe(jenisPasangan(orang), i + 1)) : null,
        anakDi: dimilikiPasangan ? namaTampil(orang) : null,
      })
      if (!s.gen.has(p.pasanganId) && !tempat.has(p.pasanganId)) tempat.set(p.pasanganId, id)
    })

    const anakId = []
    for (const u of pernikahan) {
      for (const c of s.graf.anakUnion.get(u.id) ?? []) {
        if (pemilik(c.child_id) === id && !anakId.includes(c.child_id)) anakId.push(c.child_id)
      }
    }
    const urutan = (a) => s.jalur.get(a)[0].anakKe ?? Infinity
    anakId.sort(
      (a, b) =>
        urutan(a) - urutan(b) ||
        bandingkanKabur(tanggalDari(s.graf.orang.get(a), 'birth'), tanggalDari(s.graf.orang.get(b), 'birth')) ||
        (a < b ? -1 : 1)
    )

    const node = { id, kartu: labelKartu(s, id), pasangan, anak: [] }
    simpul.set(id, node)
    tempat.set(id, id)
    for (const a of anakId) {
      if (diproses.has(a)) continue // penjaga: data rusak tidak boleh membuat putaran tanpa henti
      induk.set(a, id)
      node.anak.push(bangun(a))
    }
    return node
  }

  const akar = bangun(root.partner1_id)
  return { akar, simpul, induk, tempat }
}
