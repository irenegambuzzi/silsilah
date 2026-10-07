// Istilah kerabat di POHON KELUARGA ASAL, dihitung dari sudut pandang
// pasangan khusus itu sendiri (PLAN.md bagian 5.4): Bapak, Ibu, Mbah, Mbah
// buyut, Kakak/Adik, Pakdhe/Budhe/Paklik/Bulik, Keponakan, Sepupu, dst.
//
// Cara kerjanya: dari pasangan khusus, kerabat dijelajahi selangkah demi
// selangkah dengan tiga jenis langkah: O (ke orang tua), A (ke anak), dan
// P (ke pasangan). Jalur terpendek ke setiap orang ditulis sebagai kata,
// misalnya "OOA" = saudara dari orang tua (paman/bibi) dan "OOAA" = sepupu.
// Kalau urutan lahir yang diperlukan (kakak atau adik dari orang tua) tidak
// diketahui, ditulis "Pakdhe/Paklik". Hubungan yang tidak punya istilah baku
// ditulis dengan jalurnya, misalnya "Anak dari Sepupu".
import { teks } from '../../teks/id.js'
import { namaTampil } from './nama.js'
import { tahunHidup } from './tanggal.js'
import { orangTuaUnion, pasanganDi, urutanLahir } from './graf.js'

const KATA = teks.silsilah

const K = KATA.kerabat

// -1: a lebih tua dari b; 1: a lebih muda; null: tidak diketahui. Dibandingkan
// lewat orang tua yang sama (urutan lahir per orang tua).
function lebihTua(graf, a, b) {
  for (const t of graf.tautan.get(a) ?? []) {
    for (const p of orangTuaUnion(graf.unions.get(t.union_id))) {
      const ra = urutanLahir(graf, p, a)
      const rb = urutanLahir(graf, p, b)
      if (ra != null && rb != null && ra !== rb) return ra < rb ? -1 : 1
    }
  }
  return null
}

// sex: jenis kelamin yang disapa; lebih tua: true/false/null (belum diketahui).
function istilahPaman(sex, tua) {
  if (tua === true) return sex === 'L' ? K.pakdhe : sex === 'P' ? K.budhe : K.pakdheBudhe
  if (tua === false) return sex === 'L' ? K.paklik : sex === 'P' ? K.bulik : K.paklikBulik
  return sex === 'L' ? K.pakdhePaklik : sex === 'P' ? K.budheBulik : K.pamanBibi
}

const TETAP = {
  OO: K.mbah,
  OOO: K.mbahBuyut,
  OOOO: K.mbahCanggah,
  OOOOO: K.mbahWareng,
  OAP: K.ipar,
  OAA: K.keponakan,
  OOAA: K.sepupu,
  A: K.anak,
  AA: K.cucu,
  AAA: K.cicit,
}

// Istilah baku untuk satu jalur, atau null kalau tidak ada. `simpul` adalah
// orang-orang di sepanjang jalur, dimulai dari pasangan khusus.
function istilahBaku(graf, langkah, simpul) {
  const sex = graf.orang.get(simpul.at(-1))?.sex
  if (TETAP[langkah]) return TETAP[langkah]
  switch (langkah) {
    case 'O':
      return sex === 'L' ? K.bapak : sex === 'P' ? K.ibu : K.orangTua
    case 'P':
      return sex === 'L' ? K.suami : sex === 'P' ? K.istri : K.pasangan
    case 'OA': {
      const r = lebihTua(graf, simpul[2], simpul[0])
      return r === null ? K.kakakAdik : r < 0 ? K.kakak : K.adik
    }
    case 'OOA':
    case 'OOAP': {
      // Kakak atau adik dari orang tua? (pasangannya mengikuti.)
      const r = lebihTua(graf, simpul[3], simpul[1])
      return istilahPaman(sex, r === null ? null : r < 0)
    }
    default:
      return null
  }
}

const SISA = { A: K.anak, AA: K.cucu, AAA: K.cicit, O: K.orangTua, P: K.pasangan }
const LANGKAH = { A: K.anak, O: K.orangTua, P: K.pasangan }

// Kalau tidak ada istilah baku: potong dari belakang sampai ketemu istilah
// baku, lalu sisanya diuraikan. OOAAA → "Anak dari Sepupu".
function istilahDenganJalur(graf, langkah, simpul) {
  const baku = istilahBaku(graf, langkah, simpul)
  if (baku) return baku
  for (let k = langkah.length - 1; k >= 1; k--) {
    const dasar = istilahBaku(graf, langkah.slice(0, k), simpul.slice(0, k + 1))
    if (!dasar) continue
    const sisa = langkah.slice(k)
    const uraian =
      SISA[sisa] ?? [...sisa].reverse().map((l) => LANGKAH[l]).join(` ${KATA.dari} `)
    return `${uraian} ${KATA.dari} ${dasar}`
  }
  return null
}

const cache = new WeakMap()

// Semua kerabat pasangan khusus `anchorId` di graf pohon keluarga asal
// (bangunGraf(data, { pohon: idPohon })): Map orang → { istilah, langkah }.
export function semuaKerabat(graf, anchorId) {
  if (!cache.has(graf)) cache.set(graf, new Map())
  const perGraf = cache.get(graf)
  if (perGraf.has(anchorId)) return perGraf.get(anchorId)

  const hasil = new Map()
  if (graf.orang.has(anchorId)) {
    const dikunjungi = new Set([anchorId])
    let antrean = [{ id: anchorId, langkah: '', simpul: [anchorId] }]
    while (antrean.length > 0) {
      const berikut = []
      for (const { id, langkah, simpul } of antrean) {
        const tetangga = []
        for (const t of graf.tautan.get(id) ?? []) {
          for (const p of orangTuaUnion(graf.unions.get(t.union_id))) tetangga.push(['O', p])
        }
        for (const u of graf.pernikahan.get(id) ?? []) {
          for (const c of graf.anakUnion.get(u.id) ?? []) tetangga.push(['A', c.child_id])
        }
        for (const u of graf.pernikahan.get(id) ?? []) {
          const p = pasanganDi(u, id)
          if (p) tetangga.push(['P', p])
        }
        for (const [l, tujuan] of tetangga) {
          if (dikunjungi.has(tujuan)) continue
          dikunjungi.add(tujuan)
          const lanjut = { id: tujuan, langkah: langkah + l, simpul: [...simpul, tujuan] }
          hasil.set(tujuan, {
            istilah: istilahDenganJalur(graf, lanjut.langkah, lanjut.simpul),
            langkah: lanjut.langkah,
          })
          berikut.push(lanjut)
        }
      }
      antrean = berikut
    }
  }
  perGraf.set(anchorId, hasil)
  return hasil
}

// Istilah satu orang dari sudut pandang pasangan khusus; null kalau tidak
// terhubung ke pasangan khusus itu di pohon ini.
export function istilahKerabat(graf, anchorId, orangId) {
  if (orangId === anchorId) return graf.orang.has(anchorId) ? KATA.diriSendiri : null
  return semuaKerabat(graf, anchorId).get(orangId)?.istilah ?? null
}

// Kartu di pohon keluarga asal: nama, tahun, dan istilah kerabat.
export function labelKartuAsal(graf, anchorId, orangId) {
  const orang = graf.orang.get(orangId)
  if (!orang) return null
  return {
    id: orangId,
    nama: namaTampil(orang),
    panggilan: orang.nickname ?? null,
    tahun: tahunHidup(orang),
    istilah: istilahKerabat(graf, anchorId, orangId),
  }
}
