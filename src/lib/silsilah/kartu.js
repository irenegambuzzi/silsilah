// Label untuk kartu di Bagan dan panel Detail (PLAN.md bagian 15.1).
//
// Kartu: nama (dengan Alm./Almh.), nama panggilan, tahun lahir–wafat, GEN
// beserta istilah Jawanya, dan keterangan kecil seperti
// "Anak ke-6 · dari istri ke-1". Anak sambung dan anak angkat tampil SAMA
// PERSIS dengan saudaranya; keterangan "Anak sambung"/"Anak angkat" hanya
// ada di Detail.
import { teks } from '../../teks/id.js'
import { namaTampil } from './nama.js'
import { formatTanggal, tahunHidup, tanggalDari, teksPeristiwa } from './tanggal.js'
import { istilahGenerasi, labelGen, teksGenerasi } from './generasi.js'
import { jenisPasangan, pasanganBerurutan, teksAnakKe, teksPasanganKe } from './urutan.js'
import { pasanganDi, urutanLahir } from './graf.js'

const KATA = teks.silsilah

const hurufBesarAwal = (teks) => teks.charAt(0).toUpperCase() + teks.slice(1)

// "Anak ke-6 · dari istri ke-1". Bagian "dari …" hanya muncul kalau orang
// tua itu pernah punya lebih dari satu pasangan.
export function teksJalur(jalur) {
  const bagian = []
  if (jalur.anakKe != null) bagian.push(teksAnakKe(jalur.anakKe))
  if (jalur.pasanganKe && jalur.pasanganKe.jumlah > 1) {
    bagian.push(`${KATA.dari} ${teksPasanganKe(jalur.pasanganKe.jenis, jalur.pasanganKe.ke)}`)
  }
  return hurufBesarAwal(bagian.join(' · '))
}

const gabungNama = (nama) =>
  nama.length < 2 ? nama.join('') : `${nama.slice(0, -1).join(', ')} ${KATA.dan} ${nama.at(-1)}`

// "Pasangan dari [nama]" untuk orang yang bukan keturunan; "· bercerai" kalau
// pernikahan terakhirnya dengan setiap keturunan itu berakhir cerai.
function keteranganPasangan(s, id) {
  const terakhir = new Map() // keturunan → pernikahan terakhir dengan orang ini
  for (const u of s.graf.pernikahan.get(id) ?? []) {
    const pasangan = pasanganDi(u, id)
    if (pasangan && s.gen.has(pasangan)) {
      terakhir.delete(pasangan) // supaya urutan nama mengikuti pernikahan terakhir
      terakhir.set(pasangan, u)
    }
  }
  if (terakhir.size === 0) return ''
  const nama = [...terakhir.keys()].map((p) => namaTampil(s.graf.orang.get(p)))
  const bercerai = [...terakhir.values()].every((u) => u.status === 'cerai')
  return `${KATA.pasanganDari} ${gabungNama(nama)}${bercerai ? ` · ${KATA.bercerai}` : ''}`
}

export function labelKartu(s, id) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const utama = s.jalur.get(id)?.[0]
  return {
    id,
    nama: namaTampil(orang),
    panggilan: orang.nickname ?? null,
    tahun: tahunHidup(orang),
    jenis: gen === null ? 'pasangan' : 'keturunan',
    gen,
    labelGen: gen === null ? null : labelGen(gen),
    istilahGen: gen === null ? null : istilahGenerasi(gen, s.daftarGenerasi),
    keterangan: gen === null ? keteranganPasangan(s, id) : utama ? teksJalur(utama) : '',
  }
}

// Panel Detail. Kalau kedua orang tua keturunan, `jalur` berisi KEDUA jalur
// (yang terdekat ke pangkal dulu), masing-masing dengan "Anak ke-n" dari orang
// tua di jalur itu.
export function labelDetail(s, id) {
  const orang = s.graf.orang.get(id)
  if (!orang) return null
  const gen = s.gen.get(id) ?? null
  const nama = (pid) => namaTampil(s.graf.orang.get(pid))

  const jalur = (s.jalur.get(id) ?? []).map((j, i) => ({
    orangTuaId: j.orangTuaId,
    orangTua: nama(j.orangTuaId),
    gen: j.gen,
    terdekat: i === 0,
    keterangan: teksJalur(j),
    jenis: KATA.jenisAnak[j.kind] ?? null,
  }))

  const unions = s.graf.pernikahan.get(id) ?? []
  const pasangan = pasanganBerurutan(unions, id)
  const pernikahan = unions.map((u, i) => {
    const pid = pasanganDi(u, id)
    const indeks = pasangan.findIndex((x) => x.unionIds.includes(u.id))
    const urutan = (c) => urutanLahir(s.graf, id, c.child_id)
    const anak = (s.graf.anakUnion.get(u.id) ?? [])
      .map((c) => ({
        id: c.child_id,
        nama: nama(c.child_id),
        jenis: KATA.jenisAnak[c.kind] ?? null,
        anakKe: urutan(c),
      }))
      .sort((a, b) => (a.anakKe ?? Infinity) - (b.anakKe ?? Infinity))
    return {
      ke: i + 1,
      unionId: u.id,
      pasanganId: pid,
      pasangan: pid ? nama(pid) : null,
      pasanganKe:
        pasangan.length > 1
          ? teksPasanganKe(jenisPasangan(pid ? s.graf.orang.get(pid) : null), indeks + 1)
          : null,
      status: KATA.statusPernikahan[u.status] ?? '',
      menikah: formatTanggal(tanggalDari(u, 'marriage')),
      berakhir: formatTanggal(tanggalDari(u, 'end')),
      anak,
    }
  })

  return {
    id,
    nama: namaTampil(orang),
    panggilan: orang.nickname ?? null,
    lahir: teksPeristiwa(orang, 'birth'),
    wafat: teksPeristiwa(orang, 'death'),
    generasi: gen === null ? null : teksGenerasi(gen, s.daftarGenerasi),
    nomor: s.nomor.get(id) ?? null,
    keteranganPasangan: gen === null ? keteranganPasangan(s, id) : '',
    jalur,
    pernikahan,
  }
}
