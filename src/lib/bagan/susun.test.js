import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { susunBagan } from './susun.js'

const data = bangunKeluargaFiktif()
const s = susunSilsilah(data)
const bagan = susunBagan(s)
const nama = (n) => n.kartu.nama
const semuaSimpul = (n) => [n, ...n.anak.flatMap(semuaSimpul)]

describe('susunBagan', () => {
  it('tanpa pangkal → null', () => {
    expect(susunBagan(susunSilsilah({ ...data, root_union_id: null }))).toBeNull()
  })

  it('akar: pasangan pangkal; anak mereka menurut urutan lahir', () => {
    expect(nama(bagan.akar)).toBe('Alm. Raksa')
    expect(bagan.akar.pasangan.map((p) => p.kartu.nama)).toEqual(['Almh. Selara'])
    expect(bagan.akar.anak.map(nama)).toEqual(['Bima', 'Cahya', 'Lorvan'])
  })

  it('setiap keturunan punya tepat satu simpul (tidak ada yang ganda atau hilang)', () => {
    const id = semuaSimpul(bagan.akar).map((n) => n.id)
    expect(new Set(id).size).toBe(id.length)
    // Keturunan tanpa orang tua di silsilah (pasangan pangkal kedua) hanya tampil sebagai kartu pasangan.
    const sebagaiPasangan = semuaSimpul(bagan.akar).flatMap((n) => n.pasangan.map((p) => p.id)).filter((x) => s.gen.has(x))
    expect([...s.gen.keys()].sort()).toEqual([...new Set([...id, ...sebagaiPasangan])].sort())
  })

  it('pernikahan berulang: dari kiri ke kanan menurut waktu, menikah kembali tampil sebagai pernikahan tersendiri', () => {
    const bima = bagan.simpul.get('bima')
    // Membaca dari kiri ke kanan = urutan kelahiran.
    expect(bima.anak.map(nama)).toEqual([
      'Tamran', 'Ika', 'Alm. Tirwan', 'Kirana', 'Lintang', 'Mega', 'Nanda', 'Oka', 'Putri', 'Qori', 'Rangga',
    ])
    // istri ke-1 → istri ke-2 → istri ke-1 (menikah kembali) → istri ke-3.
    expect(bima.pasangan.map((p) => [p.kartu.nama, p.label, p.ulang])).toEqual([
      ['Eka', 'Istri ke-1', false], ['Fitri', 'Istri ke-2', false], ['Eka', 'Istri ke-1', true], ['Gita', 'Istri ke-3', false],
    ])
    expect(bima.pasangan.map((p) => p.unionId)).toEqual(['u1', 'u2', 'u3', 'u4'])
  })

  it('nomor urut di kartu: hanya anak kandung, sama dengan "Putra/Putri ke-n"', () => {
    expect(bagan.simpul.get('bima').anak.map((a) => a.kartu.urut)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(bagan.simpul.get('vino').kartu.urut).toBeNull() // anak sambung
    expect(bagan.simpul.get('yoga').kartu.urut).toBeNull() // anak angkat
    expect(bagan.simpul.get('wati').kartu.urut).toBe(1)
    expect(bagan.akar.kartu.urut).toBeNull() // pangkal
  })

  it('di bawah setiap pernikahan semua anak menurut umur: anak sambung yang lebih tua di kiri, anak angkat yang lebih muda di kanan', () => {
    expect(bagan.simpul.get('cahya').pasangan[0].anak.map(nama)).toEqual(['Vino', 'Wati'])
    expect(bagan.simpul.get('lorvan').pasangan[0].anak.map(nama)).toEqual(['Kelvan', 'Yoga'])
  })

  it('anak sambung/angkat tanpa tanggal lahir di paling kanan; anak kandung tanpa tanggal tetap menurut nomornya', () => {
    const d = structuredClone(data)
    d.people.find((p) => p.id === 'vino').birth_y = null
    const c = susunBagan(susunSilsilah(d)).simpul.get('cahya')
    expect(c.pasangan[0].anak.map(nama)).toEqual(['Wati', 'Vino'])
  })

  it('pasangan tunggal tidak diberi label urutan', () => {
    expect(bagan.simpul.get('cahya').pasangan.map((p) => p.label)).toEqual([null])
  })

  it('anak sambung dan angkat memakai kartu yang sama persis tanpa label khusus', () => {
    const sambung = bagan.simpul.get('vino').kartu
    const kandung = bagan.simpul.get('wati').kartu
    expect(Object.keys(sambung).sort()).toEqual(Object.keys(kandung).sort())
    expect(JSON.stringify(sambung)).not.toMatch(/sambung|angkat/i)
    expect(JSON.stringify(bagan.simpul.get('yoga').kartu)).not.toMatch(/sambung|angkat/i)
    expect(sambung.label).toBe(kandung.label)
  })

  it('pasangan yang bukan keturunan tidak punya simpul sendiri tetapi ada tempatnya', () => {
    expect(bagan.simpul.has('eka')).toBe(false)
    expect(bagan.tempat.get('eka')).toBe('bima')
    expect(bagan.tempat.get('tamran')).toBe('tamran')
  })

  it('pernikahan antarsepupu: anak muncul SEKALI, di bawah orang tua di jalur terdekat', () => {
    const jumlah = (id) => semuaSimpul(bagan.akar).filter((n) => n.id === id).length
    expect(jumlah('nirvo')).toBe(1)
    expect(jumlah('hasna')).toBe(1)
    // Hasna: Rangga (GEN.2) lebih dekat daripada Gendis (GEN.3)
    expect(bagan.induk.get('hasna')).toBe('rangga')
    expect(bagan.simpul.get('rangga').anak.map(nama)).toEqual(['Hasna'])
    expect(bagan.simpul.get('gendis').anak).toEqual([])
    // Sama dekat: pihak partner1 (Tamran) yang memilikinya
    expect(bagan.induk.get('nirvo')).toBe('tamran')
  })

  it('kartu pasangan yang juga keturunan mencatat di mana anak mereka berada', () => {
    const gendis = bagan.simpul.get('rangga').pasangan.find((p) => p.id === 'gendis')
    expect(gendis.anakDi).toBeNull() // anak ada di bawah Rangga sendiri
    const rangga = bagan.simpul.get('gendis').pasangan.find((p) => p.id === 'rangga')
    expect(rangga.anakDi).toEqual({ id: 'rangga', nama: 'Rangga' })
    const wati = bagan.simpul.get('tamran').pasangan.find((p) => p.id === 'wati')
    expect(wati.anakDi).toBeNull()
    expect(bagan.simpul.get('wati').pasangan.find((p) => p.id === 'tamran').anakDi).toEqual({ id: 'tamran', nama: 'Tamran' })
  })

  it('anak di bawah hati pernikahannya masing-masing', () => {
    const bima = bagan.simpul.get('bima')
    expect(bima.pasangan.map((k) => [k.id, k.anak.map(nama)])).toEqual([
      ['eka', ['Tamran', 'Ika', 'Alm. Tirwan']],
      ['fitri', ['Kirana', 'Lintang']],
      ['eka', ['Mega', 'Nanda']],
      ['gita', ['Oka', 'Putri', 'Qori', 'Rangga']],
    ])
  })

  it('status berpisah per pernikahan', () => {
    expect(bagan.simpul.get('bima').pasangan.map((k) => k.berpisah)).toEqual([true, true, true, false])
    expect(bagan.simpul.get('cahya').pasangan[0].berpisah).toBe(false)
  })

  it('pasangan yang juga keturunan (antarsepupu) ditandai; pasangan pangkal tidak', () => {
    expect(bagan.simpul.get('rangga').pasangan[0].keturunan).toBe(true)
    expect(bagan.simpul.get('bima').pasangan[0].keturunan).toBe(false)
    expect(bagan.akar.pasangan[0].keturunan).toBe(false)
  })

  it('kartu keturunan: istilah Jawa sebagai label dan GEN di pojok', () => {
    expect(bagan.simpul.get('mega').kartu).toMatchObject({ label: 'Putu', pojok: 'GEN.2' })
  })

  it('pohon keluarga asal tidak ikut', () => {
    expect(bagan.simpul.has('karto')).toBe(false)
    expect(semuaSimpul(bagan.akar).flatMap((n) => n.pasangan).some((p) => p.id === 'karto')).toBe(false)
  })

  it('data rusak (siklus) tidak membuat putaran tanpa henti', () => {
    const rusak = structuredClone(data)
    rusak.children.push({ id: 'siklus', tree_id: null, union_id: 'u8', child_id: 'raksa', kind: 'kandung', deleted_at: null })
    expect(() => susunBagan(susunSilsilah(rusak))).not.toThrow()
  })
})
