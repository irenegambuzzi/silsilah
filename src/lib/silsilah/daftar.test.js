import { describe, expect, it } from 'vitest'
import { bandingkanNomor, cariDaftar, susunDaftar } from './daftar.js'
import { labelDetail } from './kartu.js'
import { orangTuaSambung } from './anak.js'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'

const s = susunSilsilah(bangunKeluargaFiktif())
const daftar = susunDaftar(s)
const nama = (b) => b.nama

describe('bandingkanNomor', () => {
  it('mengurutkan menurut angka, bukan huruf', () => {
    const urut = ['1.10', '1.2', '1', '1.2.1', '1.9'].sort(bandingkanNomor)
    expect(urut).toEqual(['1', '1.2', '1.2.1', '1.9', '1.10'])
  })
})

describe('susunDaftar', () => {
  it('keturunan menurut nomor silsilah: pangkal dulu, lalu cabang demi cabang', () => {
    const urut = daftar.keturunan.map(nama)
    expect(urut.slice(0, 2).sort()).toEqual(['Alm. Raksa', 'Almh. Selara'])
    const bima = urut.indexOf('Bima')
    expect(urut.slice(bima + 1, bima + 12)).toContain('Tamran')
    // putra ke-1 Bima (Tamran) sebelum anak ke-2 pangkal (Cahya)
    expect(urut.indexOf('Tamran')).toBeLessThan(urut.indexOf('Cahya'))
  })

  it('nomor silsilah hanya untuk mengurutkan: tidak ada di baris Daftar', () => {
    for (const b of [...daftar.keturunan, ...daftar.pasangan]) {
      expect(b, b.id).not.toHaveProperty('nomor')
      expect(JSON.stringify(b), b.id).not.toMatch(/\b1\.\d+(\.\d+)*\b/)
    }
  })

  it('pasangan yang bukan keturunan ada di bagian terpisah, menurut nama', () => {
    const pasangan = daftar.pasangan.map(nama)
    expect(pasangan).toEqual(expect.arrayContaining(['Eka', 'Fitri', 'Gita', 'Umar', 'Sinta', 'Laila']))
    expect(pasangan).toEqual([...pasangan].sort((a, b) => a.localeCompare(b, 'id')))
    expect(daftar.keturunan.map(nama)).not.toContain('Eka')
  })

  it('orang di pohon keluarga asal tidak ikut', () => {
    const semua = [...daftar.keturunan, ...daftar.pasangan].map(nama)
    expect(semua).not.toContain('Karto')
    expect(semua).not.toContain('Asing')
  })

  it('setiap baris membawa GEN, istilah Jawa, tahun, dan keterangan kartu', () => {
    const tamran = daftar.keturunan.find((b) => b.nama === 'Tamran')
    expect(tamran).toMatchObject({ labelGen: 'GEN.2', istilahGen: 'Putu', tahun: '1971' })
    expect(tamran.keterangan).toBe('Putra ke-1 · dari istri ke-1')
    expect(JSON.stringify(daftar)).not.toMatch(/Anak ke-/)
  })
})

describe('cariDaftar', () => {
  it('tanpa kata kunci mengembalikan semuanya', () => {
    expect(cariDaftar(daftar, '  ')).toBe(daftar)
  })
  it('tidak membedakan huruf besar/kecil dan memotong spasi', () => {
    const hasil = cariDaftar(daftar, '  TAMRAN ')
    expect(hasil.keturunan.map(nama)).toEqual(['Tamran'])
  })
  it('bisa mencari pasangan', () => {
    expect(cariDaftar(daftar, 'umar').pasangan.map(nama)).toEqual(['Umar'])
  })
  it('kata yang tidak ada → kosong', () => {
    expect(cariDaftar(daftar, 'xqvj')).toEqual({ keturunan: [], pasangan: [] })
  })
})

describe('labelDetail: orang tua', () => {
  const nama = (d) => d.orangTua.map((o) => o.orang.map((x) => x.nama).join(' & '))
  const baris = (d) => d.orangTua.map((o) => [o.jenis === 'sambung' ? `sambung ${o.sex}` : o.jenis, o.orang.map((x) => x.nama)])
  it('orang tua kandung satu baris (ayah dulu), orang tua sambung di baris sendiri', () => {
    expect(baris(labelDetail(s, 'tamran'))).toEqual([['kandung', ['Bima', 'Eka']], ['sambung P', ['Fitri', 'Gita']]])
  })
  it('anak sambung: orang tua kandungnya saja di baris "Orang tua", orang tua sambungnya di baris sendiri; tanpa kalimat "Anak sambung …"', () => {
    expect(labelDetail(s, 'vino').orangTua).toEqual([
      { jenis: 'kandung', orang: [{ id: 'umar', nama: 'Umar' }] },
      { jenis: 'sambung', sex: 'P', orang: [{ id: 'cahya', nama: 'Cahya' }] },
    ])
    expect(labelDetail(s, 'vino').urutan).toEqual([])
  })
  it('anak sambung dari ibu kandung: baris "Ayah sambung"; jenis kelamin belum diketahui: "Orang tua sambung"', () => {
    const d = bangunKeluargaFiktif()
    d.children.find((c) => c.id === 'c-u5-vino').biological_parent = 'partner1'
    const t = susunSilsilah(d)
    expect(baris(labelDetail(t, 'vino'))).toEqual([['kandung', ['Cahya']], ['sambung L', ['Umar']]])
    expect(labelDetail(t, 'vino').urutan.join(' ')).not.toMatch(/Anak sambung/)
    d.people.find((p) => p.id === 'umar').sex = null
    expect(baris(labelDetail(susunSilsilah(d), 'vino'))).toEqual([['kandung', ['Cahya']], ['sambung x', ['Umar']]])
  })
  // Putaran keenam: orang tua sambung TIDAK PERNAH di baris "Orang tua".
  // Data seperti ini ditolak database (children_biological_matches_kind);
  // kalau tetap sampai (data rusak), kedua orang tua di hubungan itu tidak
  // ditulis sebagai orang tua (dulu: "Orang tua: Umar & Cahya", padahal
  // salah satunya orang tua sambung).
  it('anak sambung yang orang tua kandungnya tidak tercatat: tidak ada yang ditulis sebagai orang tua', () => {
    const d = bangunKeluargaFiktif()
    d.children.find((c) => c.id === 'c-u5-vino').biological_parent = null
    const t = susunSilsilah(d)
    expect(baris(labelDetail(t, 'vino'))).toEqual([])
  })
  it('orang tua sambung tidak pernah di baris "Orang tua" (semua orang di data contoh)', () => {
    const sambung = orangTuaSambung(s.graf)
    for (const id of s.graf.orang.keys()) {
      const kandung = labelDetail(s, id).orangTua.filter((o) => o.jenis === 'kandung').flatMap((o) => o.orang.map((x) => x.id))
      for (const x of sambung.get(id) ?? []) expect(kandung, `${id}: ${x.id}`).not.toContain(x.id)
    }
  })
  it('anak angkat: baris "Orang tua angkat" dengan kedua orang tua angkatnya; tanpa kalimat "Anak angkat …"', () => {
    expect(labelDetail(s, 'yoga').orangTua).toEqual([
      { jenis: 'angkat', orang: [{ id: 'lorvan', nama: 'Lorvan' }, { id: 'sinta', nama: 'Sinta' }] },
    ])
    expect(labelDetail(s, 'yoga').urutan).toEqual([])
    expect(labelDetail(s, 'kelvan').orangTua[0].jenis).toBe('kandung')
  })
  it('pernikahan antarsepupu: kedua orang tua dalam satu baris', () => {
    expect(nama(labelDetail(s, 'nirvo'))[0]).toBe('Tamran & Wati')
    expect(nama(labelDetail(s, 'hasna'))).toEqual(['Rangga & Gendis'])
  })
})

// Putaran keenam tinjauan: keturunan tanpa GEN (generasi.js, tanpaGen).
describe('Daftar: keturunan tanpa GEN', () => {
  const tanpa = ['galen', 'elvina', 'vino', 'sadevan-b', 'bagaskara']
  it('baris tanpa GEN dan istilah, tetap di bagian keturunan', () => {
    for (const id of tanpa) {
      const b = daftar.keturunan.find((x) => x.id === id)
      expect(b, id).toBeTruthy()
      expect([b.gen, b.labelGen, b.istilahGen], id).toEqual([null, null, null])
    }
    for (const id of ['celvia', 'fajrin', 'yoga', 'ratrisa-a']) {
      expect(daftar.keturunan.find((x) => x.id === id).labelGen, id).toMatch(/^GEN\.\d$/)
    }
  })
  it('urutan Daftar tidak berubah', () => {
    const ids = daftar.keturunan.map((b) => b.id)
    expect(ids.slice(ids.indexOf('kirana'), ids.indexOf('kirana') + 5)).toEqual(['kirana', 'celvia', 'fajrin', 'galen', 'elvina'])
    expect(ids.slice(ids.indexOf('cahya'), ids.indexOf('cahya') + 5)).toEqual(['cahya', 'wati', 'vino', 'sadevan-b', 'bagaskara'])
  })
})
