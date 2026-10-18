// Halaman uji ukuran nama dengan nama asli (SEMENTARA, HANYA LOKAL; putaran
// 7c, bagian B): susunan kartu untuk tiga skenario gelar, dan ringkasan
// angka menurut aturan Bagan (barisNama.js). Tanpa nama apa pun di file ini;
// nama datang dari server pengembangan saat halaman dibuka.
import { barisNamaKartu, cobaUkuran, JARAK_BARIS, LEBAR_DALAM, lebarBaris, TINGGI_NAMA, TINGKAT_NAMA } from '../lib/bagan/barisNama.js'

// Gelar perkiraan (skenario 2 dan 3), urut seperti ditulis di depan nama.
export const GELAR_DEPAN = ['Prof.', 'Dr.', 'Ir.', 'K.H.', 'H.', 'Hj.', 'Ust.']
export const GELAR_BELAKANG = ['S.Pd.', 'S.T.', 'S.H.', 'S.E.', 'S.Kom.', 'M.Pd.', 'M.M.', 'Lc.', 'S.Ag.']
// Paling banyak satu dari gelar haji ini; Hj. hanya perempuan, H. dan K.H.
// tidak untuk perempuan.
const HAJI = new Set(['K.H.', 'H.', 'Hj.'])
const bolehUntuk = (gelar, sex) => (gelar === 'Hj.' ? sex === 'P' : gelar === 'H.' || gelar === 'K.H.' ? sex !== 'P' : true)

export const SKENARIO = [
  { kunci: 'tanpa', judul: 'Tanpa gelar' },
  { kunci: 'perkiraan', judul: 'Gelar perkiraan (±30%)' },
  { kunci: 'terpanjang', judul: 'Gelar terpanjang' },
]

// Gelar yang sudah tertulis di nama: kata gelar di depan, dan bagian
// sesudah koma (atau kata berbentuk "S.Pd.") di belakang.
const DEPAN_KENAL = /^(?:alm\.?|almh\.?|almarhum|almarhumah|h\.|hj\.?|dr\.?|drs\.?|dra\.?|ir\.?|k\.\s?h\.|kh\.?|ust\.?|ustadz|ustadzah|prof\.?)$/i
const BELAKANG_KENAL = /^(?:[A-Z]\.\s?[A-Za-z]{1,5}\.?(?:[A-Za-z]{1,5}\.?)?|Lc\.?)$/
const ALM = /^(?:alm\.?|almh\.?|almarhum|almarhumah)$/i

export function pisahGelar(nama) {
  const [utama, ...setelahKoma] = String(nama ?? '').split(',')
  const kata = utama.trim().split(/\s+/).filter(Boolean)
  const depan = []
  while (kata.length > 1 && DEPAN_KENAL.test(kata[0])) depan.push(kata.shift())
  const belakang = []
  while (kata.length > 1 && BELAKANG_KENAL.test(kata.at(-1))) belakang.unshift(kata.pop())
  const sesudah = setelahKoma.map((s) => s.trim()).filter(Boolean)
  belakang.push(...sesudah)
  return {
    kata,
    depan: depan.filter((g) => !ALM.test(g)),
    almarhum: depan.some((g) => ALM.test(g)),
    belakang,
    adaGelar: depan.some((g) => !ALM.test(g)) || belakang.length > 0,
  }
}

// Acak dengan benih tetap (mulberry32): hasil sama setiap kali dibuka.
export function acakBenih(benih) {
  let a = benih >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const urutDepan = (gelar) => GELAR_DEPAN.filter((g) => gelar.includes(g))
const urutBelakang = (gelar) => GELAR_BELAKANG.filter((g) => gelar.includes(g))
const lebarGelar = (depan, belakang) =>
  lebarBaris([{ kata: '', depan: depan.join(' ') || null, belakang: belakang.join(', ') || null }], 1)

// Gabungan 1–3 gelar terlebar untuk jenis kelamin itu.
const simpananTerpanjang = new Map()
export function gelarTerpanjang(sex) {
  if (simpananTerpanjang.has(sex)) return simpananTerpanjang.get(sex)
  const semua = [...GELAR_DEPAN, ...GELAR_BELAKANG].filter((g) => bolehUntuk(g, sex))
  let terbaik = null
  const coba = (pilih) => {
    if (pilih.filter((g) => HAJI.has(g)).length > 1) return
    const g = { depan: urutDepan(pilih), belakang: urutBelakang(pilih) }
    const lebar = lebarGelar(g.depan, g.belakang)
    if (!terbaik || lebar > terbaik.lebar) terbaik = { ...g, lebar }
  }
  for (let i = 0; i < semua.length; i++) {
    coba([semua[i]])
    for (let j = i + 1; j < semua.length; j++) {
      coba([semua[i], semua[j]])
      for (let k = j + 1; k < semua.length; k++) coba([semua[i], semua[j], semua[k]])
    }
  }
  simpananTerpanjang.set(sex, terbaik)
  return terbaik
}

// 1–3 gelar acak yang boleh untuk jenis kelamin itu.
function gelarAcak(acak, sex) {
  const jumlah = 1 + Math.floor(acak() * 3)
  const pilih = []
  const tersedia = [...GELAR_DEPAN, ...GELAR_BELAKANG].filter((g) => bolehUntuk(g, sex))
  while (pilih.length < jumlah) {
    const g = tersedia[Math.floor(acak() * tersedia.length)]
    if (pilih.includes(g) || (HAJI.has(g) && pilih.some((x) => HAJI.has(x)))) continue
    pilih.push(g)
  }
  return { depan: urutDepan(pilih), belakang: urutBelakang(pilih) }
}

const awalanAlm = (sex) => (sex === 'P' ? 'Almh.' : 'Alm.')

// orang: [{ nama, sex, wafat }] dari server. Hasil: kartu untuk KartuOrang.
export function kartuSkenario(orang, skenario, { benih = 7, bagian = 0.3 } = {}) {
  const acak = acakBenih(benih)
  return orang.map((o, i) => {
    const p = pisahGelar(o.nama)
    const wafat = Boolean(o.wafat || p.almarhum)
    let depan = []
    let belakang = []
    let gelarAsli = false
    if (skenario === 'perkiraan') {
      // Satu angka acak per orang, apa pun gelarnya, supaya urutannya tetap.
      const terpilih = acak() < bagian
      if (p.adaGelar) {
        depan = p.depan
        belakang = p.belakang
        gelarAsli = true
      } else if (terpilih) {
        ;({ depan, belakang } = gelarAcak(acak, o.sex))
      }
    } else if (skenario === 'terpanjang') {
      ;({ depan, belakang } = gelarTerpanjang(o.sex))
    }
    if (skenario !== 'tanpa' && wafat) depan = [awalanAlm(o.sex), ...depan]
    return {
      id: `uji-${i}`,
      nama: p.kata.join(' '),
      sex: o.sex ?? null,
      wafat,
      gelarAsli,
      jenis: o.peran === 'pasangan' ? 'pasangan' : 'keturunan',
      label: o.peran === 'pasangan' ? 'Pasangan' : 'Putu',
      pojok: o.peran === 'pasangan' ? null : 'GEN.2',
      namaKartu: {
        depan: depan.join(' ') || null,
        kata: p.kata,
        belakang: belakang.join(', ') || null,
        jumlahKata: p.kata.length,
      },
    }
  })
}

// Ringkasan menurut aturan Bagan pada satu pilihan ukuran.
export function ringkas(kartu, ukuranNama) {
  const h = {
    jumlah: 0,
    baris: { 1: 0, 2: 0, 3: 0, lebih: 0 },
    tingkat: Object.fromEntries(TINGKAT_NAMA.map((t) => [t, 0])),
    // Tidak muat di tingkat mana pun: aturan Bagan memakai cadangan
    // (terkecil, sebanyak-banyaknya baris), yang bisa melebihi lebar.
    cadangan: 0,
    melebihiLebar: 0,
    melebihiTinggi: 0,
    terpotong: 0,
  }
  for (const k of kartu) {
    if (k.namaKartu.kata.length === 0) continue
    const s = barisNamaKartu(k.namaKartu, ukuranNama)
    h.jumlah++
    h.baris[s.baris.length <= 3 ? s.baris.length : 'lebih']++
    h.tingkat[s.ukuran]++
    if (!cobaUkuran(k.namaKartu, 'terkecil', ukuranNama)) h.cadangan++
    if (s.baris.some((b) => lebarBaris(b, s.rem) > LEBAR_DALAM + 1e-9)) h.melebihiLebar++
    if (s.baris.length * s.rem * JARAK_BARIS[s.ukuran] > TINGGI_NAMA + 1e-9) h.melebihiTinggi++
    // Aturan Bagan tidak pernah memotong nama; "…" hanya mungkin kalau ada
    // kata yang hilang dari susunan.
    if (s.baris.flat().length !== k.namaKartu.kata.length) h.terpotong++
  }
  return h
}
