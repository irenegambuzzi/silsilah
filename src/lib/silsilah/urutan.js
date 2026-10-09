// Urutan: "ke-n", urutan anak kandung ("Putra ke-2", "Putri ke-3 dari 11
// bersaudara"), urutan pernikahan seseorang, dan urutan pasangan
// ("istri ke-2", "suami ke-1").
import { bandingkanKabur, tanggalDari } from './tanggal.js'
import { isiTeks, teks } from '../../teks/id.js'

const KATA = teks.silsilah

export const keN = (n) => `ke-${n}`
const kunciSex = (sex) => (sex === 'L' || sex === 'P' ? sex : 'x')
// "Putra ke-2" / "Putri ke-2" / "Putra/Putri ke-2" (jenis kelamin belum diketahui).
export const teksUrutanKe = (sex, n) => isiTeks(KATA.urutanKe[kunciSex(sex)], { n })
// "Putri ke-3 dari 11 bersaudara"; satu-satunya anak kandung: "Putri tunggal".
export const teksBersaudara = (sex, n, jumlah) =>
  jumlah === 1 && n === 1
    ? KATA.tunggal[kunciSex(sex)]
    : isiTeks(KATA.bersaudara, { urutan: teksUrutanKe(sex, n), n: jumlah })
export const teksPasanganKe = (jenis, n) => `${jenis} ${keN(n)}`

const bandingkanTeks = (a, b) => ((a ?? '') < (b ?? '') ? -1 : (a ?? '') > (b ?? '') ? 1 : 0)

// Pernikahan seseorang berurutan: menurut tanggal menikah (yang tidak
// diketahui di akhir), kecuali `sort_order` diisi untuk pernikahan yang
// pihak garis keturunannya (partner1) adalah orang itu: nomor itu menang.
export function urutkanPernikahan(unions, orangId) {
  const dasar = [...unions].sort(
    (a, b) =>
      bandingkanKabur(tanggalDari(a, 'marriage'), tanggalDari(b, 'marriage')) ||
      bandingkanTeks(a.created_at, b.created_at) ||
      bandingkanTeks(a.id, b.id)
  )
  const hasil = new Array(dasar.length).fill(null)
  const bebas = []
  for (const u of dasar) {
    const slot = u.partner1_id === orangId && u.sort_order ? u.sort_order - 1 : null
    if (slot != null && slot < dasar.length && hasil[slot] === null) hasil[slot] = u
    else bebas.push(u)
  }
  let i = 0
  return hasil.map((u) => u ?? bebas[i++])
}

// Pasangan yang BERBEDA menurut pernikahan pertama dengan masing-masing.
// Menikah lagi dengan pasangan yang sama tidak menambah nomor. Pasangan yang
// tidak diketahui (kosong) dihitung satu per pernikahan.
// `unionsUrut` harus sudah berurutan (urutkanPernikahan).
export function pasanganBerurutan(unionsUrut, orangId) {
  const peta = new Map()
  for (const u of unionsUrut) {
    const pasangan = (u.partner1_id === orangId ? u.partner2_id : u.partner1_id) ?? null
    const kunci = pasangan ?? `?${u.id}`
    if (!peta.has(kunci)) peta.set(kunci, { pasanganId: pasangan, unionIds: [] })
    peta.get(kunci).unionIds.push(u.id)
  }
  return [...peta.values()]
}

// 'istri' / 'suami' menurut jenis kelamin pasangan; 'pasangan' kalau belum diketahui.
export function jenisPasangan(pasanganOrang) {
  if (pasanganOrang?.sex === 'P') return KATA.jenisPasangan.istri
  if (pasanganOrang?.sex === 'L') return KATA.jenisPasangan.suami
  return KATA.jenisPasangan.pasangan
}
