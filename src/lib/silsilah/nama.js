// Nama untuk ditampilkan. "Alm." (laki-laki) atau "Almh." (perempuan)
// ditambahkan otomatis di depan nama orang yang sudah wafat; kalau jenis
// kelaminnya belum diketahui, "Alm./Almh.".
import { teks } from '../../teks/id.js'

const KATA = teks.silsilah

export function awalanAlmarhum(orang) {
  if (!orang.is_deceased) return ''
  if (orang.sex === 'L') return KATA.almL
  if (orang.sex === 'P') return KATA.almP
  return KATA.almNetral
}

// "Alm. KH. Nama, S.Ag." (gelar religius di depan, gelar pendidikan di belakang).
export function namaTampil(orang, { gelar = true } = {}) {
  const depan = [awalanAlmarhum(orang), gelar ? orang.religious_title : null, orang.full_name]
    .filter(Boolean)
    .join(' ')
  return gelar && orang.academic_title ? `${depan}, ${orang.academic_title}` : depan
}

// Nama di kartu Bagan (putaran keenam tinjauan, Oktober 2026), aturan tetap:
// - Ukuran huruf HANYA dari jumlah kata nama asli (full_name): 1–2 kata
//   "besar", 3 kata "sedang", 4 kata atau lebih "kecil". Nama dengan jumlah
//   kata yang sama selalu berukuran sama persis.
// - Gelar (Alm./Almh., gelar religius, gelar pendidikan) TIDAK dihitung dan
//   tidak pernah mengubah ukuran; ditulis terpisah (huruf biasa, lebih kecil).
// - Baris: 1–3 kata satu aliran (turun baris sendiri kalau tidak muat, tanpa
//   mengecilkan huruf); 4 kata atau lebih dibagi DUA baris (separuh pertama
//   di atas), dan setiap baris masih boleh turun sekali lagi kalau terpaksa.
// Hasil: { depan ("Alm. H." atau null), baris ([["Bagaskara", "Wiryawan"],
// ["Adinata", "Mahardika"]]), belakang ("S.H." atau null), jumlahKata, ukuran }.
export const ukuranNamaKartu = (jumlahKata) => (jumlahKata >= 4 ? 'kecil' : jumlahKata === 3 ? 'sedang' : 'besar')

export function namaKartu(orang) {
  const kata = String(orang.full_name ?? '').trim().split(/\s+/).filter(Boolean)
  const depan = [awalanAlmarhum(orang), orang.religious_title].filter(Boolean).join(' ') || null
  const tengah = Math.ceil(kata.length / 2)
  return {
    depan,
    baris: kata.length >= 4 ? [kata.slice(0, tengah), kata.slice(tengah)] : [kata],
    belakang: orang.academic_title || null,
    jumlahKata: kata.length,
    ukuran: ukuranNamaKartu(kata.length),
  }
}

// Nama singkat di tautan dan keterangan (putaran ketujuh): nama depan saja,
// tanpa gelar dan tanpa Alm./Almh. ("Dorvi", bukan "Dorvi, S.Kom."). Kalau
// nama depan itu dipakai lebih dari satu orang di silsilah utama, dua kata
// ("Ratrisa Kemuntari", "Sadevan Bramasta").
const simpananDepan = new WeakMap()
export function namaSingkat(graf, id) {
  const orang = graf.orang.get(id)
  if (!orang) return ''
  let hitungan = simpananDepan.get(graf)
  if (!hitungan) {
    hitungan = new Map()
    for (const p of graf.orang.values()) {
      if ((p.tree_id ?? null) !== (graf.pohon ?? null)) continue
      const depan = kataNama(p)[0]?.toLocaleLowerCase('id')
      if (depan) hitungan.set(depan, (hitungan.get(depan) ?? 0) + 1)
    }
    simpananDepan.set(graf, hitungan)
  }
  const kata = kataNama(orang)
  const ganda = (hitungan.get(kata[0]?.toLocaleLowerCase('id')) ?? 0) > 1
  return kata.slice(0, ganda ? 2 : 1).join(' ')
}

const kataNama = (orang) => String(orang.full_name ?? '').trim().split(/\s+/).filter(Boolean)
