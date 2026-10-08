// Daftar orang untuk layar Daftar: keturunan menurut nomor silsilah, lalu
// pasangan (dan siapa pun yang belum terhubung ke keturunan) menurut nama.
// Hanya silsilah utama; orang di pohon keluarga asal tidak ikut.
import { keteranganDaftar, labelKartu } from './kartu.js'

const angka = (nomor) => nomor.split('.').map(Number)

// "1.2" < "1.10" (urutan angka, bukan urutan huruf).
export function bandingkanNomor(a, b) {
  const x = angka(a)
  const y = angka(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const selisih = (x[i] ?? -1) - (y[i] ?? -1)
    if (selisih) return selisih
  }
  return 0
}

const bandingkanNama = (a, b) => a.nama.localeCompare(b.nama, 'id')

export function susunDaftar(s) {
  const keturunan = []
  const pasangan = []
  for (const [id, orang] of s.graf.orang) {
    if ((orang.tree_id ?? null) !== null) continue
    const k = labelKartu(s, id)
    const { tahun, keterangan } = keteranganDaftar(s, id)
    const baris = {
      id,
      nama: k.nama,
      panggilan: k.panggilan,
      tahun,
      gen: k.gen,
      labelGen: k.labelGen,
      istilahGen: k.istilahGen,
      keterangan,
      nomor: s.nomor.get(id) ?? null,
    }
    ;(k.jenis === 'pasangan' ? pasangan : keturunan).push(baris)
  }
  keturunan.sort((a, b) => bandingkanNomor(a.nomor ?? '', b.nomor ?? '') || bandingkanNama(a, b))
  pasangan.sort(bandingkanNama)
  return { keturunan, pasangan }
}

// Huruf besar/kecil dan tanda aksen tidak dibedakan.
export const polos = (teks) => teks.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('id')

export function cariDaftar(daftar, kata) {
  const cari = polos(kata.trim())
  if (!cari) return daftar
  const cocok = (b) => polos(`${b.nama} ${b.panggilan ?? ''}`).includes(cari)
  return { keturunan: daftar.keturunan.filter(cocok), pasangan: daftar.pasangan.filter(cocok) }
}
