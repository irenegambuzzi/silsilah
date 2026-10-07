// Tanggal kabur: tahun, bulan, dan hari boleh kosong dari belakang, dengan
// tanda perkiraan (lihat PLAN.md bagian 5.3). Contoh: "12 Maret 1950",
// "Maret 1950", "1950", "sekitar 1950".
import { KATA } from './kata.js'

// Mengambil {y, m, d, approx} dari baris database, misalnya awalan 'birth'
// membaca birth_y, birth_m, birth_d, dan birth_approx.
export function tanggalDari(baris, awalan) {
  return {
    y: baris[`${awalan}_y`] ?? null,
    m: baris[`${awalan}_m`] ?? null,
    d: baris[`${awalan}_d`] ?? null,
    approx: Boolean(baris[`${awalan}_approx`]),
  }
}

export function formatTanggal(t) {
  if (!t || t.y == null) return ''
  const bagian = [t.d, t.m == null ? null : KATA.bulan[t.m - 1], t.y].filter((x) => x != null)
  const teks = bagian.join(' ')
  return t.approx ? `${KATA.sekitar} ${teks}` : teks
}

// Untuk mengurutkan: bagian yang kosong dianggap paling akhir. Mengembalikan
// angka negatif kalau a lebih awal, positif kalau lebih akhir, 0 kalau sama.
export function bandingkanKabur(a, b) {
  for (const k of ['y', 'm', 'd']) {
    const x = a?.[k] ?? Infinity
    const y = b?.[k] ?? Infinity
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

// Tahun lahir–wafat untuk kartu: "1950" (masih hidup), "1920–1990",
// "1920–?" (wafat, tahunnya tidak diketahui), "±1920" untuk perkiraan.
export function tahunHidup(orang) {
  const tahun = (awalan) => {
    const y = orang[`${awalan}_y`]
    if (y == null) return null
    return `${orang[`${awalan}_approx`] ? '±' : ''}${y}`
  }
  const lahir = tahun('birth')
  if (!orang.is_deceased) return lahir ?? ''
  const wafat = tahun('death')
  if (lahir == null && wafat == null) return ''
  return `${lahir ?? '?'}–${wafat ?? '?'}`
}

// "12 Maret 1950 di Kota" (tempat boleh kosong, begitu juga tanggalnya).
export function teksPeristiwa(orang, awalan) {
  const tanggal = formatTanggal(tanggalDari(orang, awalan))
  const tempat = orang[`${awalan}_place`]
  return [tanggal, tempat ? `${KATA.lahirDi} ${tempat}` : ''].filter(Boolean).join(' ')
}
