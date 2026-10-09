import { pasanganDi } from '../silsilah/graf.js'

// Fokus pada satu cabang dengan generasi dihitung dari orang yang difokuskan
// ("Hitung dari [nama]", PLAN.md bagian 15.1): orang itu menjadi GEN.0
// dengan label "Pangkal cabang", anak-anaknya GEN.1 · Anak, cucunya
// GEN.2 · Putu, dan seterusnya. GEN dihitung dari letak di cabang itu
// (kedalaman di bagan), jadi istilah Jawa di kartu dan panel ikut berubah.
// Nomor silsilah TIDAK berubah (tetap dari pangkal utama).
//
// PASANGAN orang itu (yang bukan keturunan) juga berlabel "Pangkal cabang"
// dengan GEN.0, seperti kedua pasangan pangkal utama (putaran ketiga
// tinjauan); warnanya tetap warna pasangan.
//
// `simpulCabang`: simpul orang yang difokuskan dari susunBagan (silsilah
// utama). Hasilnya turunan silsilah baru untuk susunBagan/labelKartu/
// labelDetail.
export function silsilahCabang(s, simpulCabang) {
  if (!simpulCabang) return s
  const gen = new Map(s.gen)
  const jalan = (n, d) => {
    gen.set(n.id, d)
    for (const a of n.anak) jalan(a, d + 1)
  }
  jalan(simpulCabang, 0)
  const pasanganCabang = new Set()
  for (const u of s.graf.pernikahan.get(simpulCabang.id) ?? []) {
    const p = pasanganDi(u, simpulCabang.id)
    if (p && !s.gen.has(p)) pasanganCabang.add(p)
  }
  return { ...s, gen, pangkalCabang: simpulCabang.id, pasanganCabang }
}
