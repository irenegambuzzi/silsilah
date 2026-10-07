// Mengurai alamat IP (teks) menjadi angka, untuk mencari perkiraan lokasi.
// Tanpa library dan tanpa jaringan.
//   IPv4 → { versi: 4, n }        n = 32 bit tanpa tanda
//   IPv6 → { versi: 6, hi, lo }   64 bit TERATAS (cukup untuk lokasi: data
//                                 lokasi dicatat per blok /64 atau lebih besar)
//   IPv6 yang memuat IPv4 (::ffff:a.b.c.d) diperlakukan sebagai IPv4.
//   Bentuk lain → null.

function urai4(teks) {
  const bagian = teks.split('.')
  if (bagian.length !== 4) return null
  let n = 0
  for (const b of bagian) {
    if (!/^\d{1,3}$/.test(b) || Number(b) > 255) return null
    n = n * 256 + Number(b)
  }
  return n
}

// Delapan kelompok 16 bit IPv6 (juga dipakai pembuat file data lokasi).
export function urai6(teks) {
  if (!/^[0-9a-fA-F:.]+$/.test(teks) || teks.split('::').length > 2) return null
  const [kiri, kanan] = teks.includes('::') ? teks.split('::') : [teks, null]
  const pecah = (s) => (s ? s.split(':') : [])
  const a = pecah(kiri)
  const b = kanan === null ? [] : pecah(kanan)
  // IPv4 di ujung (::ffff:1.2.3.4) → dua kelompok 16 bit.
  const akhir = (kanan === null ? a : b)
  if (akhir.length && akhir.at(-1).includes('.')) {
    const v4 = urai4(akhir.pop())
    if (v4 === null) return null
    akhir.push((Math.floor(v4 / 65536)).toString(16), (v4 % 65536).toString(16))
  }
  const kurang = 8 - a.length - b.length
  if (kanan === null ? kurang !== 0 : kurang < 1) return null
  const kelompok = [...a, ...Array(kanan === null ? 0 : kurang).fill('0'), ...b]
  if (kelompok.some((k) => !/^[0-9a-fA-F]{1,4}$/.test(k))) return null
  return kelompok.map((k) => parseInt(k, 16))
}

export function uraiIp(masukan) {
  const teks = String(masukan ?? '').trim().replace(/%.*$/, '')
  if (!teks || teks.length > 64) return null
  if (!teks.includes(':')) {
    const n = urai4(teks)
    return n === null ? null : { versi: 4, n }
  }
  const k = urai6(teks)
  if (!k) return null
  // ::ffff:0:0/96 = IPv4 yang dibungkus IPv6.
  if (k.slice(0, 5).every((x) => x === 0) && k[5] === 0xffff) {
    return { versi: 4, n: k[6] * 65536 + k[7] }
  }
  return { versi: 6, hi: k[0] * 65536 + k[1], lo: k[2] * 65536 + k[3] }
}
