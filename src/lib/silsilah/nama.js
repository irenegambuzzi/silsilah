// Nama untuk ditampilkan. "Alm." (laki-laki) atau "Almh." (perempuan)
// ditambahkan otomatis di depan nama orang yang sudah wafat; kalau jenis
// kelaminnya belum diketahui, "Alm./Almh.".
import { KATA } from './kata.js'

export function awalanAlmarhum(orang) {
  if (!orang.is_deceased) return ''
  if (orang.sex === 'L') return KATA.almL
  if (orang.sex === 'P') return KATA.almP
  return KATA.almNetral
}

// "Alm. KH. Nama, S.Ag." (gelar religius di depan, gelar pendidikan di belakang).
export function namaTampil(orang, { gelar = true } = {}) {
  const depan = [awalanAlmarhum(orang), gelar ? orang.religious_title : null, orang.full_name]
    .filter(Boolean)
    .join(' ')
  return gelar && orang.academic_title ? `${depan}, ${orang.academic_title}` : depan
}
