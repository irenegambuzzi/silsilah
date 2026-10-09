import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { susunSilsilah } from './silsilah.js'
import { namaTampil } from './nama.js'
import { cariDaftar, susunDaftar } from './daftar.js'
import { cariOrang, cocokOrang, pecahKata, siapkanPencarian } from './cari.js'

const orang = (nama, panggilan = null) => ({ nama, panggilan })
const cari = (daftar, kata) => (cariOrang(daftar, kata) ?? []).map((o) => o.nama)

describe('pecahKata: tanda baca, gelar, ejaan', () => {
  it('tanda baca dibuang, gelar ditandai, ejaan diseragamkan', () => {
    expect(pecahKata("Alm. KH. Ma'ravel Djarwo-Tjandrawi, S.Kom.")).toEqual([
      { kata: 'alm', gelar: true }, { kata: 'kh', gelar: true }, { kata: 'maravel', gelar: false },
      { kata: 'jarwo', gelar: false }, { kata: 'candrawi', gelar: false }, { kata: 'skom', gelar: true },
    ])
  })
  it('gelar yang menempel dan gelar berderet', () => {
    expect(pecahKata('H.Halvin').map((k) => [k.kata, k.gelar])).toEqual([['h', true], ['halvin', false]])
    expect(pecahKata('Dr.Ir.').map((k) => k.gelar)).toEqual([true, true])
  })
  it('ejaan lama sesuai PLAN: oe→u, dj→j, tj→c, sj→sy, nj→ny, ch→kh, dl/dh→d, th→t, ts→s, huruf ganda satu', () => {
    const kata = (t) => pecahKata(t)[0].kata
    expect(kata('Soerbanu')).toBe(kata('Surbanu'))
    expect(kata('Djarwo')).toBe(kata('Jarwo'))
    expect(kata('Tjahya')).toBe(kata('Cahya'))
    expect(kata('Sjalendra')).toBe(kata('Syalendra'))
    expect(kata('Njarmo')).toBe(kata('Nyarmo'))
    expect(kata('Chalmira')).toBe(kata('Khalmira'))
    expect(kata('Dhamira')).toBe(kata('Damira'))
    expect(kata('Thalesa')).toBe(kata('Talesa'))
    expect(kata('Tsarena')).toBe(kata('Sarena'))
    expect(kata('Hassara')).toBe(kata('Hasara'))
  })
})

describe('cariOrang: nama lengkap, sebagian, satu kata, panggilan', () => {
  const daftar = [
    orang('Alm. KH. Barnala Sumeru Tarisha, S.Ag.', 'Gus Barnala'),
    orang('Hj. Lunara Kestrel', 'Ibu Pipi'),
    orang('Torvan Melik'),
    orang('Ferdana Lisbet', 'Ovi'),
  ]
  it.each([
    ['Barnala Sumeru Tarisha', 1], // nama lengkap tanpa gelar
    ['Alm. KH. Barnala Sumeru Tarisha, S.Ag.', 1], // persis seperti tampil
    ['sumeru', 1], // satu kata di tengah
    ['tarisha barnala', 1], // urutan bebas
    ['meru', 1], // sebagian kata
    ['LUNA', 1],
    ['torvan', 1],
    ['melik', 1],
  ])('"%s" menemukan %i orang', (kata, jumlah) => {
    expect(cari(daftar, kata)).toHaveLength(jumlah)
  })

  it('tidak membedakan huruf besar/kecil, tanda baca, dan aksen', () => {
    for (const kata of ['TORVAN MELIK', 'torvan, melik!', '  t.o.r.v.a.n   melik  ', 'Tórván Mélik', 'torvan-melik']) {
      expect(cari(daftar, kata), kata).toEqual(['Torvan Melik'])
    }
  })

  it('gelar diabaikan, di pencarian maupun di nama', () => {
    for (const kata of ['H. Lunara', 'Hj Lunara', 'hj. lunara kestrel', 'KH Barnala', 'Gus Sumeru', 'S.Ag. Barnala', 'Alm Barnala', 'Lunara S.Kom.']) {
      expect(cari(daftar, kata).length, kata).toBeGreaterThan(0)
    }
    expect(cari(daftar, 'H. Lunara')).toEqual(['Hj. Lunara Kestrel'])
    // gelar yang bukan milik orang itu tidak menolak (gelar dibuang dari pencarian)
    expect(cari(daftar, 'Dr. Torvan')).toEqual(['Torvan Melik'])
  })

  it('hanya gelar yang diketik: dicocokkan dengan gelar dan nama', () => {
    expect(cari(daftar, 'Hj.')).toEqual(['Hj. Lunara Kestrel'])
    expect(cari(daftar, 'S.Ag')).toEqual(['Alm. KH. Barnala Sumeru Tarisha, S.Ag.'])
  })

  it('ejaan lama: Soeharto = Suharto, Tjahya = Cahya, Chalid = Khalid', () => {
    const lama = [orang('Soerbanu Djarwo'), orang('Cahya Wiratama'), orang('Khalmira Tsarena'), orang('Sjalendra Thalesa')]
    expect(cari(lama, 'Surbanu Jarwo')).toEqual(['Soerbanu Djarwo'])
    expect(cari(lama, 'Tjahya')).toEqual(['Cahya Wiratama'])
    expect(cari(lama, 'Chalmira Sarena')).toEqual(['Khalmira Tsarena'])
    expect(cari(lama, 'Kholmira')).toEqual([])
    const baru = [orang('Surbanu'), orang('Cahya'), orang('Khalmira')]
    expect(cari(baru, 'Soerbanu Tjahya Chalmira')).toEqual([]) // semua kata harus ketemu di satu orang
    expect(cari(baru, 'Soerbanu')).toEqual(['Surbanu'])
    expect(cari(baru, 'Chalmira')).toEqual(['Khalmira'])
    expect(cari(lama, 'Syalendra Talesa')).toEqual(['Sjalendra Thalesa'])
  })

  it('nama panggilan: ditemukan, dan ditandai lewat: "panggilan" hanya kalau kata itu tidak ada di nama', () => {
    expect(cariOrang(daftar, 'ovi')).toEqual([{ ...daftar[3], lewat: 'panggilan' }])
    expect(cariOrang(daftar, 'Ibu Pipi')).toEqual([{ ...daftar[1], lewat: 'panggilan' }])
    expect(cariOrang(daftar, 'barnala')[0].lewat).toBe('nama') // ada di nama dan di panggilan: nama
    expect(cariOrang(daftar, 'gus')[0].lewat).toBe('panggilan') // "Gus" ada di panggilannya ("Gus Barnala"), bukan di namanya
    expect(cariOrang(daftar, 'ferdana ovi')[0].lewat).toBe('panggilan') // sebagian dari nama, sebagian dari panggilan
    expect(cariOrang(daftar, 'ferdana')[0].lewat).toBe('nama')
  })

  it('tanpa kata yang bisa dicari: null', () => {
    expect(cariOrang(daftar, '')).toBeNull()
    expect(cariOrang(daftar, '  ')).toBeNull()
    expect(cariOrang(daftar, '..., !?')).toBeNull()
    expect(siapkanPencarian(undefined)).toBeNull()
    expect(cocokOrang(null, orang('A'))).toBeNull()
  })

  it('setiap kata harus ketemu: sebagian yang tidak ada → tidak cocok', () => {
    expect(cari(daftar, 'torvan lisbet')).toEqual([])
  })
})

describe('pencarian di keluarga contoh', () => {
  const s = susunSilsilah(bangunKeluargaFiktif())
  const daftar = susunDaftar(s)
  const hasil = (kata) => {
    const h = cariDaftar(daftar, kata)
    return [...h.keturunan, ...h.pasangan].map((b) => [b.nama, b.lewat])
  }

  it('nama panggilan yang sangat berbeda dari nama lengkap menemukan orangnya, dengan tanda "panggilan"', () => {
    expect(hasil('Ovi')).toEqual([['Elvina', 'panggilan']])
    expect(hasil('abah')).toEqual([['Bima', 'panggilan']])
    expect(hasil('JOJO')).toEqual([['Fajrin', 'panggilan']])
    expect(hasil('titi')).toEqual([['Wati', 'panggilan']])
    expect(hasil('Kiki')).toEqual([['Rangga', 'panggilan']])
    expect(hasil('nana')).toEqual([['Kirana', 'panggilan']])
  })

  it('panggilan dengan sapaan: "Pak Halvin", "Mbak Dara"', () => {
    expect(hasil('pak')).toEqual([['H. Halvin', 'panggilan']].map(([n, l]) => [`Alm. ${n}`, l]))
    expect(hasil('mbak dara')).toEqual([['Hj. Dara', 'panggilan']])
  })

  it('nama dengan gelar dan tanda baca; ejaan lama', () => {
    expect(hasil('H. Halvin').map(([n]) => n)).toEqual(['Alm. H. Halvin'])
    expect(hasil('Halvin')).toEqual([['Alm. H. Halvin', 'nama']])
    expect(hasil('dorvi s.kom')).toEqual([['Dorvi, S.Kom.', 'nama']])
    expect(hasil('Tjahya')).toEqual([['Cahya', 'nama']])
    expect(hasil('Oemar')).toEqual([['Umar', 'nama']])
    expect(hasil('Djoval')).toEqual([['Joval, S.E.', 'nama']])
  })

  it('pasangan ikut: Umar, Harvel, dan Joval ditemukan di bagian Pasangan', () => {
    const h = cariDaftar(daftar, 'harvel')
    expect(h.keturunan).toEqual([])
    expect(h.pasangan.map((b) => b.nama)).toEqual(['Harvel'])
  })

  it('pohon keluarga asal: hanya kalau datanya sampai (hak akses), dan tidak ada di Daftar', () => {
    const semua = (graf) => [...graf.orang.values()].map((o) => ({ nama: namaTampil(o), panggilan: o.nickname }))
    // Pengguna dengan akses: datanya ada, jadi ditemukan.
    expect(cari(semua(s.graf), 'karto')).toEqual(['Karto'])
    // Pengguna tanpa akses: server tidak mengirim barisnya; tidak ada yang bisa ditemukan.
    const tanpaAkses = bangunKeluargaFiktif()
    tanpaAkses.people = tanpaAkses.people.filter((p) => p.tree_id !== 'T1')
    const t = susunSilsilah(tanpaAkses)
    expect(cari(semua(t.graf), 'karto')).toEqual([])
    // Bagan dan Daftar belum menampilkan pohon keluarga asal (kelompok 9).
    expect(hasil('karto')).toEqual([])
  })
})
