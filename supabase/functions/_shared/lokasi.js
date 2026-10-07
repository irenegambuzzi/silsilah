// Perkiraan lokasi dari alamat IP, sepenuhnya di memori (data DB-IP "IP to
// City Lite", lisensi CC BY 4.0). Tidak ada permintaan jaringan: alamat IP
// tidak pernah dikirim ke layanan lain. Tanpa koordinat: hanya kota/negara.
//
// Format file data (biner, little-endian, dibuat scripts/lokasi-ip/buat-data.mjs):
//   kepala 32 byte: 'SLIP', versi, n4, n6, nTeks, byteTeks, tanggalData, lebarIndeks
//   awal4  Uint32[n4]        awal setiap rentang IPv4 (urut naik)
//   indeks4 Uint16/32[n4]    nomor teks untuk rentang itu (0 = tidak diketahui)
//   awal6  Uint32[2·n6]      64 bit teratas awal rentang IPv6 (hi, lo), urut naik
//   indeks6 Uint16/32[n6]
//   teks   UTF-8, entri dipisah '\n', setiap entri "KODE_NEGARA\tKota" (kota boleh kosong)
// Setiap rentang berlaku sampai awal rentang berikutnya; celah ditandai 0.

const AJAIB = 'SLIP'
const VERSI = 1
const KEPALA = 32

const rata4 = (n) => (n + 3) & ~3

// Menyusun file data dari rentang yang sudah urut.
//   v4: [{ awal, indeks }]  v6: [{ hi, lo, indeks }]  teks: ['', 'ID\tJakarta', …]
export function susunDataLokasi({ v4, v6, teks, tanggal }) {
  if (teks[0] !== '') throw new Error('teks[0] harus kosong (tidak diketahui)')
  const lebar = teks.length <= 0xffff ? 2 : 4
  const byteTeks = new TextEncoder().encode(teks.join('\n'))
  const ukuran = KEPALA + v4.length * 4 + rata4(v4.length * lebar) + v6.length * 8 + rata4(v6.length * lebar) + byteTeks.length
  const buf = new ArrayBuffer(ukuran)
  const u8 = new Uint8Array(buf)
  const dv = new DataView(buf)
  u8.set(new TextEncoder().encode(AJAIB), 0)
  ;[VERSI, v4.length, v6.length, teks.length, byteTeks.length, tanggal, lebar]
    .forEach((x, i) => dv.setUint32(4 + i * 4, x, true))
  let pos = KEPALA
  const tulisIndeks = (daftar) => {
    daftar.forEach((r, i) => (lebar === 2 ? dv.setUint16(pos + i * 2, r.indeks, true) : dv.setUint32(pos + i * 4, r.indeks, true)))
    pos += rata4(daftar.length * lebar)
  }
  v4.forEach((r, i) => dv.setUint32(pos + i * 4, r.awal, true))
  pos += v4.length * 4
  tulisIndeks(v4)
  v6.forEach((r, i) => { dv.setUint32(pos + i * 8, r.hi, true); dv.setUint32(pos + i * 8 + 4, r.lo, true) })
  pos += v6.length * 8
  tulisIndeks(v6)
  u8.set(byteTeks, pos)
  return u8
}

// Membaca file data (tanpa menyalin isinya). Galat → melempar.
export function bacaDataLokasi(data) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (u8.byteOffset % 4 !== 0) return bacaDataLokasi(u8.slice())
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) throw new Error('mesin bukan little-endian')
  if (u8.length < KEPALA || new TextDecoder().decode(u8.subarray(0, 4)) !== AJAIB) throw new Error('bukan data lokasi')
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const [versi, n4, n6, nTeks, byteTeks, tanggal, lebar] = Array.from({ length: 7 }, (_, i) => dv.getUint32(4 + i * 4, true))
  if (versi !== VERSI || (lebar !== 2 && lebar !== 4)) throw new Error('versi data lokasi tidak dikenal')
  const Indeks = lebar === 2 ? Uint16Array : Uint32Array
  let pos = u8.byteOffset + KEPALA
  const awal4 = new Uint32Array(u8.buffer, pos, n4); pos += n4 * 4
  const indeks4 = new Indeks(u8.buffer, pos, n4); pos += rata4(n4 * lebar)
  const awal6 = new Uint32Array(u8.buffer, pos, n6 * 2); pos += n6 * 8
  const indeks6 = new Indeks(u8.buffer, pos, n6); pos += rata4(n6 * lebar)
  if (pos - u8.byteOffset + byteTeks !== u8.length) throw new Error('ukuran data lokasi tidak sesuai')
  const teks = new TextDecoder().decode(new Uint8Array(u8.buffer, pos, byteTeks)).split('\n')
  if (teks.length !== nTeks) throw new Error('jumlah teks data lokasi tidak sesuai')
  return { awal4, indeks4, awal6, indeks6, teks, tanggal }
}

// Posisi rentang terakhir yang awalnya ≤ nilai (atau -1).
function cari(n, lebihKecilAtauSama) {
  let kiri = 0
  let kanan = n - 1
  let hasil = -1
  while (kiri <= kanan) {
    const tengah = (kiri + kanan) >>> 1
    if (lebihKecilAtauSama(tengah)) { hasil = tengah; kiri = tengah + 1 } else kanan = tengah - 1
  }
  return hasil
}

// ip: hasil uraiIp(). Hasil: { approx_country, approx_city } (kota boleh
// null) atau null kalau tidak diketahui.
export function cariLokasi(data, ip) {
  if (!data || !ip) return null
  let nomor = 0
  if (ip.versi === 4) {
    const i = cari(data.awal4.length, (t) => data.awal4[t] <= ip.n)
    nomor = i < 0 ? 0 : data.indeks4[i]
  } else {
    const a = data.awal6
    const i = cari(data.indeks6.length, (t) => a[2 * t] < ip.hi || (a[2 * t] === ip.hi && a[2 * t + 1] <= ip.lo))
    nomor = i < 0 ? 0 : data.indeks6[i]
  }
  if (!nomor) return null
  const [negara, kota] = (data.teks[nomor] ?? '').split('\t')
  if (!/^[A-Z]{2}$/.test(negara ?? '')) return null
  return { approx_country: negara, approx_city: kota || null }
}
