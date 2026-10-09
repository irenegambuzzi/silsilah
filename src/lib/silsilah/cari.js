// Pencarian orang di Bagan dan Daftar (PLAN.md bagian 15.2).
//
// Yang dicari: nama (lengkap, sebagian, atau satu kata di posisi mana pun)
// dan nama panggilan. Tidak dibedakan: huruf besar/kecil, aksen, tanda baca,
// gelar (H., Hj., KH., Gus, S.Kom., …), dan ejaan lama (Ch/Kh, Oe/U, Dj/J,
// Tj/C, …). Setiap kata yang diketik harus ketemu di nama atau panggilan,
// urutannya bebas.
//
// Kalau orang itu muncul karena nama panggilannya (kata itu tidak ada di
// namanya), hasilnya ditandai lewat: 'panggilan' supaya layar bisa
// menjelaskan kenapa ia muncul ("panggilan: Ovi").

// Gelar dan sapaan kehormatan, ditulis tanpa titik dan huruf kecil. Dibuang
// dari kata yang dicari (dan dari nama yang dibandingkan) supaya "H. Halvin"
// dan "Halvin" sama saja. Sengaja daftar eksplisit, bukan pola: banyak nama
// biasa yang dimulai dengan huruf s atau m.
const GELAR = new Set([
  // religius dan sapaan
  'h', 'hj', 'haji', 'hajjah', 'kh', 'k', 'ky', 'kyai', 'kiai', 'gus', 'ning', 'ustaz', 'ustadz', 'ustazah', 'ustadzah',
  'ust', 'habib', 'habibah', 'syekh', 'syaikh', 'syeikh', 'sheikh', 'buya', 'tgh',
  // Alm./Almh. (ditambahkan otomatis di depan nama yang sudah wafat)
  'alm', 'almh', 'almarhum', 'almarhumah',
  // pendidikan
  'dr', 'drs', 'dra', 'drg', 'ir', 'prof', 'phd', 'mba', 'msc', 'bsc', 'lc', 'apt', 'ners',
  's', 'sh', 'shi', 'shum', 'se', 'ssi', 'skom', 'sked', 'sag', 'sos', 'ssos', 'sip', 'sikom', 'spd', 'spdi', 'spsi',
  'sfarm', 'skep', 'skm', 'st', 'sst', 'sp', 'spt', 'ssn', 'sht',
  'm', 'ma', 'mm', 'mt', 'mh', 'mhum', 'mkom', 'msi', 'mpd', 'mpdi', 'mag', 'mkes', 'mkm', 'mpsi', 'mfarm', 'mkn', 'mhi', 'msn',
])

// Ejaan lama dan variasi, urutannya penting (PLAN.md 15.2): oe→u, dj→j,
// tj→c, sj→sy, nj→ny, ch→kh, dl/dh→d, th→t, ts→s; huruf ganda jadi satu.
const EJAAN = [
  [/tj/g, 'c'],
  [/dj/g, 'j'],
  [/sj/g, 'sy'],
  [/nj/g, 'ny'],
  [/ch/g, 'kh'],
  [/d[lh]/g, 'd'],
  [/th/g, 't'],
  [/ts/g, 's'],
  [/oe/g, 'u'],
  [/(\p{L})\1+/gu, '$1'],
]

const ejaan = (kata) => EJAAN.reduce((hasil, [pola, ganti]) => hasil.replace(pola, ganti), kata)

// Huruf kecil, tanpa aksen; apostrof dibuang ("Ma'ruf" = "Maruf").
const dasar = (teks) =>
  teks
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('id')
    .replace(/['’‘`´]/g, '')

// Memecah teks menjadi kata: [{ kata (sudah diseragamkan ejaannya), gelar }].
// Pemisah: spasi dan tanda baca. Titik tidak langsung memisah, supaya
// "S.Kom." dikenali sebagai satu gelar ("skom"); kalau gabungannya bukan
// gelar, titik memisah seperti biasa ("H.Halvin" = "H." + "Halvin").
export function pecahKata(teks) {
  const hasil = []
  const tambah = (mentah) => {
    const bersih = mentah.replace(/[^\p{L}\p{N}]/gu, '')
    if (bersih) hasil.push({ kata: ejaan(bersih), gelar: GELAR.has(bersih) })
  }
  for (const potongan of dasar(teks ?? '').split(/[\s,;:/()[\]\-_"“”]+/)) {
    const tanpaTitik = potongan.replaceAll('.', '')
    if (GELAR.has(tanpaTitik)) tambah(tanpaTitik)
    else potongan.split('.').forEach(tambah)
  }
  return hasil
}

// Kata yang diketik pengguna; null kalau tidak ada yang bisa dicari (kosong
// atau hanya tanda baca). Gelar dibuang, kecuali yang diketik hanya gelar
// ("Hj"): maka gelar dicocokkan juga dengan nama.
export function siapkanPencarian(kata) {
  const semua = pecahKata(kata)
  if (semua.length === 0) return null
  const tanpaGelar = semua.filter((k) => !k.gelar)
  return tanpaGelar.length > 0 ? { kata: tanpaGelar.map((k) => k.kata), hanyaGelar: false } : { kata: semua.map((k) => k.kata), hanyaGelar: true }
}

// Mencocokkan satu orang (nama tampil dan nama panggilan) dengan pencarian
// dari siapkanPencarian. Hasil: null (tidak cocok) atau { lewat: 'nama' |
// 'panggilan' }.
export function cocokOrang(pencarian, { nama, panggilan }) {
  if (!pencarian) return null
  const bagianNama = pecahKata(nama).filter((k) => pencarian.hanyaGelar || !k.gelar).map((k) => k.kata)
  const bagianPanggilan = pecahKata(panggilan).map((k) => k.kata)
  let lewatPanggilan = false
  for (const k of pencarian.kata) {
    if (bagianNama.some((b) => b.includes(k))) continue
    if (bagianPanggilan.some((b) => b.includes(k))) lewatPanggilan = true
    else return null
  }
  return { lewat: lewatPanggilan ? 'panggilan' : 'nama' }
}

// Mencari di sebuah daftar orang { nama, panggilan, … }. Hasil menurut urutan
// daftar, masing-masing dengan `lewat`. Tanpa kata yang bisa dicari: null.
export function cariOrang(daftar, kata) {
  const pencarian = siapkanPencarian(kata)
  if (!pencarian) return null
  const hasil = []
  for (const orang of daftar) {
    const cocok = cocokOrang(pencarian, orang)
    if (cocok) hasil.push({ ...orang, lewat: cocok.lewat })
  }
  return hasil
}
