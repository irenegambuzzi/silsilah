import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../silsilah/silsilah.js'
import { keturunanCabang, susunBagan } from './susun.js'

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

  it('di bawah setiap pernikahan semua anak menurut umur: anak sambung yang lebih tua di kiri, anak angkat di antara anak kandung menurut umur', () => {
    expect(bagan.simpul.get('cahya').pasangan[0].anak.map(nama)).toEqual(['Vino', 'Wati'])
    expect(bagan.simpul.get('lorvan').pasangan[0].anak.map(nama)).toEqual(['Kelvan', 'Yoga', 'Arum'])
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
    // Anak angkat: label sama dengan saudara kandungnya. Anak sambung bawaan
    // pasangan (Vino): tanpa GEN dan istilah (putaran keenam).
    expect(bagan.simpul.get('yoga').kartu.label).toBe(bagan.simpul.get('kelvan').kartu.label)
    expect(sambung.label).toBeNull()
    expect(kandung.label).toBe('Putu')
  })

  it('pasangan yang bukan keturunan tidak punya simpul sendiri tetapi ada tempatnya', () => {
    expect(bagan.simpul.has('eka')).toBe(false)
    expect(bagan.tempat.get('eka')).toBe('bima')
    expect(bagan.tempat.get('tamran')).toBe('tamran')
  })

  it('pernikahan antarsepupu: anak muncul SEKALI, SELALU di bawah pihak laki-laki', () => {
    const jumlah = (id) => semuaSimpul(bagan.akar).filter((n) => n.id === id).length
    expect(jumlah('nirvo')).toBe(1)
    expect(jumlah('hasna')).toBe(1)
    expect(jumlah('bintang')).toBe(1)
    // Hasna: di bawah Rangga (ayah)
    expect(bagan.induk.get('hasna')).toBe('rangga')
    expect(bagan.simpul.get('rangga').anak.map(nama)).toEqual(['Hasna'])
    expect(bagan.simpul.get('gendis').anak).toEqual([])
    // Generasi sama: di bawah Tamran (ayah)
    expect(bagan.induk.get('nirvo')).toBe('tamran')
    // Jalur ibu (Arum GEN.2) lebih dekat daripada jalur ayah (Dorvi GEN.3): tetap di bawah Dorvi
    expect(bagan.induk.get('bintang')).toBe('dorvi')
    expect(bagan.simpul.get('dorvi').anak.map(nama)).toEqual(['Bintang'])
    expect(bagan.simpul.get('arum').anak).toEqual([])
    expect(bagan.simpul.get('arum').pasangan.find((p) => p.id === 'dorvi').anakDi).toEqual({ id: 'dorvi', nama: 'Dorvi' })
    // Posisi di bagan cocok dengan GEN: kedalaman simpul = GEN.
    const kedalaman = (id) => { let d = 0; for (let x = id; bagan.induk.has(x); x = bagan.induk.get(x)) d++; return d }
    for (const id of ['nirvo', 'hasna', 'bintang']) expect(kedalaman(id), id).toBe(s.gen.get(id))
    expect(bagan.simpul.get('bintang').kartu).toMatchObject({ pojok: 'GEN.4', label: 'Canggah' })
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

// Putaran ketujuh, bagian 1: mode fokus memuat SEMUA keturunan orang itu.
describe('susunBagan dengan fokus', () => {
  const fokus = (id, sx = s) => susunBagan(sx, { fokus: id })
  const kelompok = (b, id, pasangan) => b.simpul.get(id).pasangan.find((p) => p.id === pasangan)

  it('akar: orang yang difokuskan', () => {
    expect(fokus('cahya').akar.id).toBe('cahya')
  })

  it('anak perempuan yang menikah dengan laki-laki dari cabang lain: anaknya di bawah pernikahan itu, beserta keturunannya', () => {
    const b = fokus('cahya')
    const k = kelompok(b, 'wati', 'tamran')
    expect(k.anak.map(nama)).toEqual(['Nirvo'])
    expect(k.keturunan).toBe(true) // kartu Tamran tetap "Dari cabang lain"
    expect(k.anakDi).toBeNull()
    expect(b.induk.get('nirvo')).toBe('wati')
    const l = fokus('lorvan')
    expect(kelompok(l, 'arum', 'dorvi').anak.map(nama)).toEqual(['Bintang'])
    expect(kelompok(l, 'gendis', 'rangga').anak.map(nama)).toEqual(['Hasna'])
    // Nomor urut di kartu dari sudut pandang ibunya.
    expect(l.simpul.get('bintang').kartu.urut).toBe(1)
  })

  it('anak laki-laki itu dari pernikahan lain tidak ditampilkan', () => {
    const d = structuredClone(data)
    d.people.push({ ...d.people.find((p) => p.id === 'nirvo'), id: 'anak-melvira', full_name: 'Anak Melvira' })
    d.children.push({ ...d.children.find((c) => c.child_id === 'nirvo'), id: 'c-u22-x', union_id: 'u22', child_id: 'anak-melvira' })
    const b = fokus('cahya', susunSilsilah(d))
    expect(b.simpul.has('anak-melvira')).toBe(false)
    expect(susunBagan(susunSilsilah(d)).simpul.has('anak-melvira')).toBe(true)
  })

  it('tidak ada yang ganda; yang sudah tampil tidak hilang (Vino di bawah Umar & Cahya)', () => {
    for (const id of ['cahya', 'lorvan', 'bima', 'kirana', 'raksa']) {
      const ids = semuaSimpul(fokus(id).akar).map((n) => n.id)
      expect(new Set(ids).size, id).toBe(ids.length)
      expect(new Set(ids), id).toEqual(keturunanCabang(s, id))
      const lama = semuaSimpul(bagan.simpul.get(id)).map((n) => n.id)
      for (const x of lama) expect(ids, `${id}: ${x}`).toContain(x)
    }
    expect(kelompok(fokus('cahya'), 'cahya', 'umar').anak.map(nama)).toEqual(['Vino', 'Wati'])
  })

  it('kedua orang tua di cabang: anak sekali di sisi ayah, seperti bagan lengkap', () => {
    const b = fokus('raksa')
    expect(b.induk.get('hasna')).toBe('rangga')
    expect(b.induk.get('bintang')).toBe('dorvi')
    expect(b.induk.get('nirvo')).toBe('tamran')
    // Mode fokus: tanpa catatan "Anak mereka ada di cabang …".
    expect(kelompok(b, 'gendis', 'rangga').anak).toEqual([])
    expect(kelompok(b, 'gendis', 'rangga').anakDi).toBeNull()
  })

  it('tanpa fokus: bagan lengkap tidak berubah', () => {
    expect(bagan.akar.id).toBe('raksa')
    expect(bagan.induk.get('nirvo')).toBe('tamran')
    expect(kelompok(bagan, 'wati', 'tamran').anak).toEqual([])
    expect(kelompok(bagan, 'wati', 'tamran').anakDi).toEqual({ id: 'tamran', nama: 'Tamran' })
  })
})
