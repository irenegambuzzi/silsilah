// Daftar orang untuk layar Daftar: keturunan menurut nomor silsilah, lalu
// pasangan (dan siapa pun yang belum terhubung ke keturunan) menurut nama.
// Hanya silsilah utama; orang di pohon keluarga asal tidak ikut. Nomor
// silsilah hanya dipakai di belakang layar untuk mengurutkan; tidak ada di
// baris yang dikembalikan, jadi tidak pernah tampil (putaran ketiga tinjauan).
import { cocokOrang, siapkanPencarian } from './cari.js'
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
    }
    ;(k.jenis === 'pasangan' ? pasangan : keturunan).push(baris)
  }
  const nomor = (b) => s.nomor.get(b.id) ?? ''
  keturunan.sort((a, b) => bandingkanNomor(nomor(a), nomor(b)) || bandingkanNama(a, b))
  pasangan.sort(bandingkanNama)
  return { keturunan, pasangan }
}

// Pencarian nama dan nama panggilan (cari.js). Baris yang cocok lewat nama
// panggilan diberi `lewat: 'panggilan'` supaya layar bisa menjelaskan kenapa
// orang itu muncul. Tanpa kata yang bisa dicari, daftar apa adanya.
export function cariDaftar(daftar, kata) {
  const pencarian = siapkanPencarian(kata)
  if (!pencarian) return daftar
  const saring = (baris) =>
    baris.flatMap((b) => {
      const cocok = cocokOrang(pencarian, b)
      return cocok ? [{ ...b, lewat: cocok.lewat }] : []
    })
  return { keturunan: saring(daftar.keturunan), pasangan: saring(daftar.pasangan) }
}
