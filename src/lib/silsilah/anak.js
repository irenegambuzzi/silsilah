// Anak-anak seorang orang tua: siapa yang anak KANDUNG (bernomor), siapa
// anak sambung/angkat (tidak bernomor), dan urutannya.
//
// Aturan (PLAN.md bagian 5.4 dan 15.1):
// - "Putra/Putri ke-n" dan "n bersaudara" hanya menghitung anak kandung
//   orang tua itu, lintas semua pernikahannya. Anak sambung yang orang tua
//   darahnya adalah orang itu tetap anak kandungnya.
// - Urutan anak kandung: urutan lahir (birth_ranks), lalu tanggal lahir.
// - Semua anak (kandung, sambung, angkat) bisa disusun menurut UMUR: anak
//   sambung/angkat disisipkan di antara anak kandung menurut tanggal
//   lahirnya; yang tanpa tanggal lahir di paling akhir. Urutan anak kandung
//   sendiri tidak pernah berubah.
import { bandingkanKabur, tanggalDari } from './tanggal.js'

// true kalau hubungan anak `c` di pernikahan `u` menjadikan `p` orang tua
// kandungnya (sama dengan private.is_birth_parent di SQL 003).
export function kandungUntuk(c, u, p) {
  if (!c || !u || !p) return false
  if (c.biological_parent === 'keduanya') return p === u.partner1_id || p === u.partner2_id
  if (c.biological_parent === 'partner1') return p === u.partner1_id
  if (c.biological_parent === 'partner2') return p === u.partner2_id
  return false
}

// true kalau tanggal a PASTI sesudah tanggal b (bagian yang tidak diketahui
// tidak dibandingkan), seperti public.fuzzy_date_after di SQL 003.
export function pastiSesudah(a, b) {
  if (a?.y == null || b?.y == null) return false
  if (a.y !== b.y) return a.y > b.y
  if (a.m == null || b.m == null) return false
  if (a.m !== b.m) return a.m > b.m
  if (a.d == null || b.d == null) return false
  return a.d > b.d
}

const lahir = (graf, id) => tanggalDari(graf.orang.get(id) ?? {}, 'birth')
const bandingkanId = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// Menyisipkan anak sambung/angkat (`lain`) di antara anak kandung
// (`kandung`, sudah berurutan) menurut umur. Setiap anak sambung/angkat
// diletakkan sebelum anak kandung pertama yang PASTI lahir sesudahnya;
// yang tanpa tanggal lahir di paling akhir. Hasil: daftar id.
export function urutkanMenurutUmur(graf, kandung, lain) {
  const bertanggal = lain.filter((id) => lahir(graf, id).y != null)
  const tanpaTanggal = lain.filter((id) => lahir(graf, id).y == null)
  bertanggal.sort((a, b) => bandingkanKabur(lahir(graf, a), lahir(graf, b)) || bandingkanId(a, b))
  tanpaTanggal.sort(bandingkanId)
  const hasil = [...kandung]
  const kandungSet = new Set(kandung)
  for (const id of bertanggal) {
    const t = lahir(graf, id)
    let i = hasil.findIndex((x) => kandungSet.has(x) && pastiSesudah(lahir(graf, x), t))
    if (i < 0) i = hasil.length
    hasil.splice(i, 0, id)
  }
  return [...hasil, ...tanpaTanggal]
}

const simpanan = new WeakMap()

// Semua anak `p` di silsilah graf ini (dihitung sekali per graf):
//   kandung  id anak kandung, berurutan
//   ke       Map anak kandung → nomor (1, 2, 3, …)
//   semua    [{ id, kandung, kind, unionId, lain }] menurut umur (lihat di
//            atas). lain: anak kandung `p` yang dibawa ke pernikahan itu
//            (anak sambung bagi pasangannya), jadi BUKAN anak dari pasangan
//            di pernikahan itu: anak dari pernikahan sebelumnya.
//
// Berlaku sama untuk keturunan dan pasangan (bukan keturunan). Pasangan
// tidak punya birth_ranks, jadi anak kandungnya diurutkan menurut tanggal lahir.
export function anakOrangTua(graf, p) {
  let peta = simpanan.get(graf)
  if (!peta) simpanan.set(graf, (peta = new Map()))
  if (peta.has(p)) return peta.get(p)

  const tautan = new Map() // anak → { kandung, kind, unionId, lain } (kandung diutamakan)
  for (const u of graf.pernikahan.get(p) ?? []) {
    for (const c of graf.anakUnion.get(u.id) ?? []) {
      const kandung = kandungUntuk(c, u, p)
      const lain = kandung && c.biological_parent !== 'keduanya'
      const lama = tautan.get(c.child_id)
      if (!lama || (kandung && !lama.kandung) || (lama.lain && kandung && !lain)) {
        tautan.set(c.child_id, { kandung, kind: c.kind, unionId: u.id, lain })
      }
    }
  }
  const rank = (id) => graf.ranks.get(`${p}|${id}`) ?? Infinity
  const kandung = [...tautan].filter(([, t]) => t.kandung).map(([id]) => id)
  kandung.sort((a, b) => rank(a) - rank(b) || bandingkanKabur(lahir(graf, a), lahir(graf, b)) || bandingkanId(a, b))
  const lain = [...tautan].filter(([, t]) => !t.kandung).map(([id]) => id)
  const hasil = {
    kandung,
    ke: new Map(kandung.map((id, i) => [id, i + 1])),
    semua: urutkanMenurutUmur(graf, kandung, lain).map((id) => ({ id, ...tautan.get(id) })),
  }
  peta.set(p, hasil)
  return hasil
}

// Anak sebuah pernikahan menurut umur (untuk Bagan): anak kandung menurut
// nomornya di orang tua `p`, anak sambung/angkat disisipkan menurut umur.
export function anakPernikahanMenurutUmur(graf, u, p, anakIds) {
  const { ke } = anakOrangTua(graf, p)
  const tautan = new Map((graf.anakUnion.get(u.id) ?? []).map((c) => [c.child_id, c]))
  const kandung = anakIds.filter((id) => kandungUntuk(tautan.get(id), u, p))
  kandung.sort((a, b) => (ke.get(a) ?? Infinity) - (ke.get(b) ?? Infinity) || bandingkanId(a, b))
  const lain = anakIds.filter((id) => !kandungUntuk(tautan.get(id), u, p))
  return urutkanMenurutUmur(graf, kandung, lain)
}
