// Umur: apakah seseorang belum dewasa (di bawah 18 tahun).
//
// Sama dengan aturan undangan di SQL 004: dihitung dari tanggal lahir
// PALING AKHIR yang mungkin ("2008" = 31 Desember 2008, "Maret 2008" =
// 31 Maret 2008), jadi seseorang baru dianggap dewasa kalau PASTI sudah
// 18 tahun. Tanggal lahir yang tidak diketahui → tidak ditandai.

const hariTerakhir = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()

// true kalau orang yang masih hidup ini belum genap 18 tahun pada `hariIni`.
export function belumDewasa(orang, hariIni = new Date()) {
  if (!orang || orang.is_deceased || orang.birth_y == null) return false
  const m = orang.birth_m ?? 12
  const d = orang.birth_d ?? hariTerakhir(orang.birth_y, m)
  const dewasa = Date.UTC(orang.birth_y + 18, m - 1, d)
  return Date.UTC(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()) < dewasa
}

// Untuk panel keterangan: anak yang masih di bawah umur, atau yang wafat
// sebelum 18 tahun (dihitung per tahun; tanpa tahun wafat → tidak diketahui).
export function masihAnak(orang, hariIni = new Date()) {
  if (!orang || orang.birth_y == null) return false
  if (!orang.is_deceased) return belumDewasa(orang, hariIni)
  return orang.death_y != null && orang.death_y - orang.birth_y < 18
}
