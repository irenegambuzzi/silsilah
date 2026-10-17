// Membuat tabel lebar huruf untuk nama di kartu Bagan (putaran ketujuh,
// bagian 5): src/lib/bagan/lebarHuruf.js. Lebar diambil langsung dari file
// huruf yang dibundel (@fontsource, WOFF): Lora 600 untuk nama, Plus Jakarta
// Sans 400 untuk gelar. Hanya huruf Latin (U+0020–U+017F), cukup untuk nama;
// huruf lain memakai lebar rata-rata. Kerning tidak dihitung (selisihnya
// kecil, dan batas satu baris 85% memberi ruang).
//
// Jalankan ulang kalau versi paket huruf berubah: npm run lebar-huruf:buat
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const akar = path.resolve(import.meta.dirname, '..', '..')
const HURUF = {
  nama: ['lora', 'lora-latin-600-normal.woff', 'lora-latin-ext-600-normal.woff'],
  gelar: ['plus-jakarta-sans', 'plus-jakarta-sans-latin-400-normal.woff', 'plus-jakarta-sans-latin-ext-400-normal.woff'],
}
const AWAL = 0x20
const AKHIR = 0x17f

function bacaWoff(file) {
  const b = fs.readFileSync(file)
  if (b.toString('latin1', 0, 4) !== 'wOFF') throw new Error(`${file}: bukan WOFF`)
  const tabel = {}
  for (let i = 0; i < b.readUInt16BE(12); i++) {
    const p = 44 + i * 20
    const tag = b.toString('latin1', p, p + 4)
    const [offset, panjangZip, panjang] = [b.readUInt32BE(p + 4), b.readUInt32BE(p + 8), b.readUInt32BE(p + 12)]
    const isi = b.subarray(offset, offset + panjangZip)
    tabel[tag] = panjangZip < panjang ? zlib.inflateSync(isi) : isi
  }
  return tabel
}

// cmap format 4 (platform 3, encoding 1): kode huruf → nomor glyph.
function petaHuruf(cmap) {
  const n = cmap.readUInt16BE(2)
  for (let i = 0; i < n; i++) {
    const p = 4 + i * 8
    if (cmap.readUInt16BE(p) !== 3 || cmap.readUInt16BE(p + 2) !== 1) continue
    const t = cmap.subarray(cmap.readUInt32BE(p + 4))
    if (t.readUInt16BE(0) !== 4) continue
    const seg = t.readUInt16BE(6) / 2
    const akhir = 14
    const awal = akhir + seg * 2 + 2
    const delta = awal + seg * 2
    const rentang = delta + seg * 2
    return (kode) => {
      for (let s = 0; s < seg; s++) {
        if (kode > t.readUInt16BE(akhir + s * 2)) continue
        const a = t.readUInt16BE(awal + s * 2)
        if (kode < a) return 0
        const r = t.readUInt16BE(rentang + s * 2)
        const d = t.readInt16BE(delta + s * 2)
        if (r === 0) return (kode + d) & 0xffff
        const g = t.readUInt16BE(rentang + s * 2 + r + (kode - a) * 2)
        return g === 0 ? 0 : (g + d) & 0xffff
      }
      return 0
    }
  }
  throw new Error('cmap format 4 tidak ada')
}

function lebarHuruf(files) {
  const hasil = {}
  for (const file of files) {
    const t = bacaWoff(file)
    const upm = t.head.readUInt16BE(18)
    const jumlah = t.hhea.readUInt16BE(34)
    const glyph = petaHuruf(t.cmap)
    const maju = (g) => t.hmtx.readUInt16BE(Math.min(g, jumlah - 1) * 4)
    for (let kode = AWAL; kode <= AKHIR; kode++) {
      const g = glyph(kode)
      if (g && hasil[kode] === undefined) hasil[kode] = Math.round((maju(g) / upm) * 1000)
    }
  }
  return hasil
}

let keluar = `// DIBUAT OTOMATIS oleh scripts/lebar-huruf/buat-tabel.mjs, jangan diubah
// dengan tangan. Lebar huruf dalam per seribu em, dari file huruf yang
// dibundel; dipakai untuk mengukur nama di kartu (barisNama.js).
`
for (const [nama, [paket, ...files]] of Object.entries(HURUF)) {
  const versi = JSON.parse(fs.readFileSync(path.join(akar, 'node_modules', '@fontsource', paket, 'package.json'), 'utf8')).version
  const lebar = lebarHuruf(files.map((f) => path.join(akar, 'node_modules', '@fontsource', paket, 'files', f)))
  const kode = Object.keys(lebar).map(Number)
  const nilai = kode.map((k) => lebar[k])
  const rata = Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length)
  // Satu string: huruf ke-i = kode AWAL + i; nilai 0 = tidak ada di huruf ini.
  const deret = []
  for (let k = AWAL; k <= AKHIR; k++) deret.push(lebar[k] ?? 0)
  keluar += `\n// @fontsource/${paket} ${versi}\nexport const ${nama.toUpperCase()} = { awal: ${AWAL}, rata: ${rata}, lebar: [${deret.join(',')}] }\n`
}
fs.writeFileSync(path.join(akar, 'src', 'lib', 'bagan', 'lebarHuruf.js'), keluar)
console.log('src/lib/bagan/lebarHuruf.js dibuat')
