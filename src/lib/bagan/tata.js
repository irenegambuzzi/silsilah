// Tata letak Bagan: letak setiap kartu, ikon hati, label, dan garis, dalam
// satuan rem (jadi ikut pengaturan ukuran huruf). Fungsi murni: masukannya
// simpul dari susunBagan, keluarannya koordinat.
//
// Seperti aplikasi lama:
// - Satu pasangan: [keturunan] ─♥─ [pasangan], anak-anak turun dari ikon hati.
// - Lebih dari satu pasangan: keturunan di atas, di bawahnya pasangan-
//   pasangannya berjajar (masing-masing dengan "Istri/Suami ke-n" dan ikon
//   hatinya sendiri), dan anak setiap pernikahan turun dari hatinya sendiri.
// - Tanpa pasangan yang diketahui: anak turun langsung dari kartu.
// Garis ke anak: turun lurus, lalu bercabang siku-siku ke setiap anak.
// Garis pernikahan putus-putus hanya untuk yang berakhir karena berpisah.
//
// Keluaran:
//   lebar, tinggi
//   letak   Map kunci → { x, y } (sudut kiri atas). Kunci:
//             o:<id>        kartu keturunan
//             p:<id>:<i>    kartu pasangan ke-i dari keturunan <id>
//             l:<id>:<i>    label "Istri ke-n" di atas kartu itu
//             c:<id>:<i>    catatan "Anak mereka …" (pernikahan antarsepupu)
//   hati    [{ kunci, x, y }] (titik tengah)
//   garis   [{ kunci, jenis: 'nikah' | 'anak', putus, titik: [[x, y], …] }]
export const UKURAN = {
  lebarKartu: 10,
  tinggiKartu: 6.75,
  jarakSaudara: 1.5, // antara blok saudara
  jarakHati: 2.75, // antara kartu keturunan dan pasangannya (hati di tengah)
  jariHati: 0.75,
  turun: 3, // dari dasar kartu/hati ke atas kartu anak
  tinggiLabel: 1.35, // ruang "Istri ke-n" di atas kartu pasangan
  kolomHati: 2.5, // lebar kolom hati di kiri kartu pasangan (susunan berjajar)
  jarakKelompok: 2,
  busKipas: 1, // dari dasar kartu keturunan ke garis datar ke para pasangan
  lebarCatatan: 10,
  tinggiCatatan: 3,
}
const U = UKURAN

const blokKosong = () => ({ lebar: 0, tinggi: 0, letak: [], hati: [], garis: [], masukX: 0 })

function geser(b, dx, dy) {
  return {
    ...b,
    letak: b.letak.map((e) => ({ ...e, x: e.x + dx, y: e.y + dy })),
    hati: b.hati.map((h) => ({ ...h, x: h.x + dx, y: h.y + dy })),
    garis: b.garis.map((g) => ({ ...g, titik: g.titik.map(([x, y]) => [x + dx, y + dy]) })),
    masukX: b.masukX + dx,
  }
}

function gabung(ke, dari) {
  ke.letak.push(...dari.letak)
  ke.hati.push(...dari.hati)
  ke.garis.push(...dari.garis)
}

// Menggeser isi supaya titik paling kiri di x = 0, lalu menghitung ukuran.
function rapikan(b) {
  const xs = [
    ...b.letak.map((e) => e.x),
    ...b.hati.map((h) => h.x - U.jariHati),
    ...b.garis.flatMap((g) => g.titik.map(([x]) => x)),
  ]
  const kiri = Math.min(0, ...xs)
  const hasil = kiri < 0 ? geser(b, -kiri, 0) : b
  const kanan = Math.max(
    ...hasil.letak.map((e) => e.x + (e.lebar ?? U.lebarKartu)),
    ...hasil.hati.map((h) => h.x + U.jariHati),
    ...hasil.garis.flatMap((g) => g.titik.map(([x]) => x)),
    0
  )
  const bawah = Math.max(
    ...hasil.letak.map((e) => e.y + (e.tinggi ?? U.tinggiKartu)),
    ...hasil.garis.flatMap((g) => g.titik.map(([, y]) => y)),
    0
  )
  return { ...hasil, lebar: kanan, tinggi: bawah }
}

// Anak-anak berjajar di bawah titik (hx, hy), dengan garis dari titik itu:
// turun lurus, lalu bercabang siku-siku ke setiap anak. `tengahX`: anak-anak
// diletakkan berpusat di x ini (bawaan: di bawah hx).
function pasangAnak(b, anak, { hx, hy, atas, tengahX = hx, kunci }) {
  if (anak.length === 0) return
  const blok = anak.map(tataSimpul)
  let x = 0
  const posisi = blok.map((a) => {
    const p = x
    x += a.lebar + U.jarakSaudara
    return p
  })
  const masukPertama = posisi[0] + blok[0].masukX
  const masukTerakhir = posisi.at(-1) + blok.at(-1).masukX
  const dx = tengahX - (masukPertama + masukTerakhir) / 2
  const bus = atas - U.turun / 2
  blok.forEach((a, i) => {
    const g = geser(a, posisi[i] + dx, atas)
    gabung(b, g)
    b.garis.push({
      kunci: `${kunci}>${anak[i].id}`,
      jenis: 'anak',
      putus: false,
      titik: [[hx, hy], [hx, bus], [g.masukX, bus], [g.masukX, atas]],
    })
  })
}

function tataSimpul(simpul) {
  const b = blokKosong()
  const W = U.lebarKartu
  const H = U.tinggiKartu
  const dikenal = simpul.pasangan.filter((k) => k.id)
  const tanpaPasangan = simpul.pasangan.filter((k) => !k.id)

  if (dikenal.length === 0) {
    // Tanpa pasangan yang diketahui: anak turun langsung dari kartu.
    b.letak.push({ kunci: `o:${simpul.id}`, x: 0, y: 0 })
    b.masukX = W / 2
    const anak = tanpaPasangan.flatMap((k) => k.anak)
    pasangAnak(b, anak, { hx: W / 2, hy: H, atas: H + U.turun, kunci: `o:${simpul.id}` })
    return rapikan(b)
  }

  if (simpul.pasangan.length === 1) {
    // [keturunan] ─♥─ [pasangan]; anak turun dari hati.
    const k = simpul.pasangan[0]
    const hx = W + U.jarakHati / 2
    const hy = H / 2
    const r = U.jariHati
    b.letak.push({ kunci: `o:${simpul.id}`, x: 0, y: 0 })
    b.letak.push({ kunci: `p:${simpul.id}:0`, x: W + U.jarakHati, y: 0 })
    b.hati.push({ kunci: `h:${simpul.id}:0`, x: hx, y: hy })
    b.garis.push(
      { kunci: `n:${simpul.id}:0:a`, jenis: 'nikah', putus: k.berpisah, titik: [[W, hy], [hx - r, hy]] },
      { kunci: `n:${simpul.id}:0:b`, jenis: 'nikah', putus: k.berpisah, titik: [[hx + r, hy], [W + U.jarakHati, hy]] }
    )
    b.masukX = W / 2
    pasangCatatan(b, simpul, 0, k, { hx, y: H + 0.75 })
    pasangAnak(b, k.anak, { hx, hy: hy + r, atas: H + U.turun, kunci: `h:${simpul.id}:0` })
    return rapikan(b)
  }

  // Lebih dari satu pasangan: berjajar di bawah kartu keturunan.
  const atasBaris = H + U.busKipas + 0.6
  const kartuY = U.tinggiLabel // di dalam blok kelompok
  const kelompok = simpul.pasangan.map((k, i) => {
    const g = blokKosong()
    const hx = U.jariHati + 0.25
    const hy = kartuY + H / 2
    const r = U.jariHati
    g.letak.push({ kunci: `p:${simpul.id}:${i}`, x: U.kolomHati, y: kartuY })
    if (k.label) g.letak.push({ kunci: `l:${simpul.id}:${i}`, x: U.kolomHati, y: 0, lebar: W, tinggi: U.tinggiLabel })
    g.hati.push({ kunci: `h:${simpul.id}:${i}`, x: hx, y: hy })
    g.garis.push({ kunci: `n:${simpul.id}:${i}:b`, jenis: 'nikah', putus: k.berpisah, titik: [[hx + r, hy], [U.kolomHati, hy]] })
    g.masukX = hx
    pasangCatatan(g, simpul, i, k, { hx: U.kolomHati + W / 2, y: kartuY + H + 0.75 })
    pasangAnak(g, k.anak, {
      hx,
      hy: hy + r,
      atas: kartuY + H + U.turun,
      tengahX: (U.kolomHati + W) / 2,
      kunci: `h:${simpul.id}:${i}`,
    })
    return { blok: rapikan(g), hy, k }
  })

  let x = 0
  const masuk = kelompok.map(({ blok, hy, k }, i) => {
    const g = geser(blok, x, atasBaris)
    gabung(b, g)
    x += blok.lebar + U.jarakKelompok
    return { x: g.masukX, atasHati: atasBaris + hy - U.jariHati, putus: k.berpisah, i }
  })
  const tengah = (masuk[0].x + masuk.at(-1).x) / 2
  const bus = H + U.busKipas
  b.letak.push({ kunci: `o:${simpul.id}`, x: tengah - W / 2, y: 0 })
  b.masukX = tengah
  b.garis.push({
    kunci: `n:${simpul.id}:bus`,
    jenis: 'nikah',
    putus: false,
    titik: [[tengah, H], [tengah, bus]],
  })
  b.garis.push({
    kunci: `n:${simpul.id}:jajar`,
    jenis: 'nikah',
    putus: false,
    titik: [[Math.min(tengah, masuk[0].x), bus], [Math.max(tengah, masuk.at(-1).x), bus]],
  })
  for (const m of masuk) {
    b.garis.push({ kunci: `n:${simpul.id}:${m.i}:a`, jenis: 'nikah', putus: m.putus, titik: [[m.x, bus], [m.x, m.atasHati]] })
  }
  return rapikan(b)
}

// Pernikahan antarsepupu: anak mereka tampil di tempat pasangannya; di sini
// hanya catatan kecil di bawah hati yang bisa diketuk.
function pasangCatatan(b, simpul, i, k, { hx, y }) {
  if (!k.anakDi) return
  b.letak.push({
    kunci: `c:${simpul.id}:${i}`,
    x: hx - U.lebarCatatan / 2,
    y,
    lebar: U.lebarCatatan,
    tinggi: U.tinggiCatatan,
  })
}

export function tataBagan(akar) {
  const b = akar ? tataSimpul(akar) : rapikan(blokKosong())
  return {
    lebar: b.lebar,
    tinggi: b.tinggi,
    letak: new Map(b.letak.map((e) => [e.kunci, { x: e.x, y: e.y }])),
    hati: b.hati,
    garis: b.garis,
  }
}
