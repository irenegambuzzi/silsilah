// Format waktu untuk layar: jam menurut zona waktu perangkat, dan sisa waktu.

const dua = (n) => String(n).padStart(2, '0')

// "15.30"
export const formatJam = (waktu) => {
  const d = new Date(waktu)
  return `${dua(d.getHours())}.${dua(d.getMinutes())}`
}

// "7 Oktober 2026, 15.30"
export const formatTanggalJam = (waktu, bulan) => {
  const d = new Date(waktu)
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}, ${formatJam(d)}`
}

// Milidetik → "9:05" (menit:detik) atau "1 jam 5 menit" / "5 menit" / "kurang dari 1 menit".
export const sisaMenitDetik = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${dua(s % 60)}`
}

export function sisaWaktuPanjang(ms) {
  const menit = Math.max(0, Math.ceil(ms / 60000))
  if (menit < 1) return 'kurang dari 1 menit'
  const jam = Math.floor(menit / 60)
  if (jam < 1) return `${menit} menit`
  const sisa = menit % 60
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`
}

// 30 → "30 menit", 90 → "90 menit", 120 → "2 jam", 1440 → "24 jam".
export const durasiTeks = (menit) => (menit % 60 === 0 ? `${menit / 60} jam` : `${menit} menit`)
