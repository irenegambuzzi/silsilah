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
import { pasanganDi } from './graf.js'

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

// Tanggal paling awal di antara yang diketahui (null kalau tidak ada).
function terawal(tanggal) {
  const ada = tanggal.filter((t) => t.y != null)
  return ada.length ? ada.reduce((a, b) => (bandingkanKabur(b, a) < 0 ? b : a)) : null
}

// Anak sambung dari sisi PASANGAN: anak kandung pasangan `q` dari hubungan
// lain (bukan dengan `p`), selama pernikahan p dan q berlaku. Itu anak
// sambung `p`, tanpa perlu dicatat di pernikahan p dan q. Dihitung bila ada
// satu saja pernikahan p dan q di mana anak itu
// - tidak PASTI lahir sesudah pernikahan itu berakhir (berpisah, atau salah
//   satu pasangan wafat), dan
// - tidak PASTI sudah wafat sebelum pernikahan itu dimulai.
// Tanggal yang tidak diketahui tidak mengeluarkan siapa pun. Hasil: Map anak →
// { unionId (hubungan anak itu dengan q), via (q), nikahId (pernikahan p dan q) }.
function sambungDariPasangan(graf, p, sudah) {
  const hasil = new Map()
  for (const u of graf.pernikahan.get(p) ?? []) {
    const q = pasanganDi(u, p)
    if (!q) continue
    const akhir = terawal([
      u.status === 'cerai' ? tanggalDari(u, 'end') : { y: null },
      graf.orang.get(p).is_deceased ? tanggalDari(graf.orang.get(p), 'death') : { y: null },
      graf.orang.get(q)?.is_deceased ? tanggalDari(graf.orang.get(q), 'death') : { y: null },
    ])
    const mulai = tanggalDari(u, 'marriage')
    for (const w of graf.pernikahan.get(q) ?? []) {
      if (w.partner1_id === p || w.partner2_id === p) continue // anak p dan q sendiri
      for (const c of graf.anakUnion.get(w.id) ?? []) {
        const id = c.child_id
        if (id === p || sudah.has(id) || hasil.has(id) || !kandungUntuk(c, w, q)) continue
        const anak = graf.orang.get(id)
        if (pastiSesudah(lahir(graf, id), akhir)) continue
        if (anak.is_deceased && pastiSesudah(mulai, tanggalDari(anak, 'death'))) continue
        hasil.set(id, { unionId: w.id, via: q, nikahId: u.id })
      }
    }
  }
  return hasil
}

const simpanan = new WeakMap()

// Semua anak `p` di silsilah graf ini (dihitung sekali per graf):
//   kandung  id anak kandung, berurutan
//   ke       Map anak kandung → nomor (1, 2, 3, …)
//   semua    [{ id, kandung, kind, unionId, lain }] menurut umur (lihat di
//            atas). lain: anak kandung `p` yang dibawa ke pernikahan itu
//            (anak sambung bagi pasangannya), jadi BUKAN anak dari pasangan
//            di pernikahan itu: anak dari pernikahan sebelumnya.
//   panel    seperti `semua`, DITAMBAH anak sambung dari sisi pasangan
//            (anak kandung pasangan dari hubungan lain; sambung: true,
//            via: pasangan itu); inilah daftar di panel keterangan.
//            `semua` sengaja tidak memuatnya: ia dipakai nomor silsilah.
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
  const dariPasangan = sambungDariPasangan(graf, p, tautan)
  const hasil = {
    kandung,
    ke: new Map(kandung.map((id, i) => [id, i + 1])),
    semua: urutkanMenurutUmur(graf, kandung, lain).map((id) => ({ id, ...tautan.get(id) })),
    panel: urutkanMenurutUmur(graf, kandung, [...lain, ...dariPasangan.keys()]).map((id) =>
      tautan.has(id) ? { id, ...tautan.get(id) } : { id, kandung: false, kind: 'sambung', lain: false, sambung: true, ...dariPasangan.get(id) }
    ),
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

// Orang tua sambung (kebalikan `panel`): untuk setiap anak, siapa saja
// orang tua sambungnya. SATU sumber untuk panel anak dan panel orang tua:
// X orang tua sambung Y persis kalau Y "anak sambung" di daftar anak X.
// Termasuk
// - orang tua sambung yang dicatat di pernikahan itu sendiri (anak sambung
//   dengan orang tua kandung diketahui; tanpa batas waktu, karena dicatat), dan
// - orang tua sambung dari sisi pasangan: menikah dengan orang tua kandungnya
//   di pernikahan lain, dengan batas waktu sambungDariPasangan (anak itu hidup
//   selama pernikahan itu berlangsung); pasangan: true.
// Map anak → [{ id (orang tua sambung), unionId (hubungan anak itu dengan
// orang tua kandungnya), nikahId (pernikahan yang menjadikannya orang tua
// sambung), pasangan }], urut menurut waktu pernikahan itu (paling awal
// dulu). Dihitung sekali per graf.
const simpananSambung = new WeakMap()
export function orangTuaSambung(graf) {
  let peta = simpananSambung.get(graf)
  if (peta) return peta
  peta = new Map()
  const tercatat = (a) => (graf.anakUnion.get(a.unionId) ?? []).find((c) => c.child_id === a.id)
  for (const p of graf.pernikahan.keys()) {
    for (const a of anakOrangTua(graf, p).panel) {
      if (a.kandung || a.kind !== 'sambung') continue
      // Anak sambung yang orang tua kandungnya tidak tercatat (database
      // menolaknya: children_biological_matches_kind): tidak ditulis sebagai
      // orang tua sambung, dan juga tidak di baris "Orang tua" (kartu.js).
      if (!a.sambung && tercatat(a)?.biological_parent == null) continue
      if (!peta.has(a.id)) peta.set(a.id, [])
      peta.get(a.id).push({ id: p, unionId: a.unionId, nikahId: a.sambung ? a.nikahId : a.unionId, pasangan: Boolean(a.sambung) })
    }
  }
  const mulai = (nikahId) => tanggalDari(graf.unions.get(nikahId), 'marriage')
  for (const daftar of peta.values()) {
    daftar.sort((a, b) => bandingkanKabur(mulai(a.nikahId), mulai(b.nikahId)) || bandingkanId(a.id, b.id))
  }
  simpananSambung.set(graf, peta)
  return peta
}

// Hanya orang tua sambung dari sisi pasangan (bagian dari orangTuaSambung).
export function orangTuaSambungPasangan(graf) {
  return new Map(
    [...orangTuaSambung(graf)]
      .map(([anak, daftar]) => [anak, daftar.filter((x) => x.pasangan)])
      .filter(([, daftar]) => daftar.length > 0)
  )
}
