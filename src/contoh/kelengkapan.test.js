// Mode contoh harus selalu lengkap (PLAN.md, aturan tetap): setiap kasus yang
// sudah didukung aplikasi wajib punya contoh di data fiktif, supaya bisa
// ditinjau di layar. Kalau tes ini gagal setelah data contoh diubah, tambahkan
// kembali contohnya; jangan hapus pemeriksaannya.
import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../lib/silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../lib/silsilah/silsilah.js'
import { kontakContoh } from './kontakContoh.js'

const data = bangunKeluargaFiktif()
const s = susunSilsilah(data)
const orang = new Map(data.people.map((p) => [p.id, p]))
const utama = data.people.filter((p) => p.tree_id === null)
const nikahUtama = data.unions.filter((u) => u.tree_id === null)
const keturunan = (id) => s.gen.has(id) && s.gen.get(id) > 0
const pasanganSaja = (id) => !s.gen.has(id)
const pangkal = data.unions.find((u) => u.id === data.root_union_id)
const TAHUN_INI = new Date().getFullYear()

describe('data contoh memuat semua kasus yang didukung', () => {
  it('pasangan pangkal, keduanya wafat', () => {
    expect(orang.get(pangkal.partner1_id).is_deceased).toBe(true)
    expect(orang.get(pangkal.partner2_id).is_deceased).toBe(true)
  })

  it('banyak pernikahan, termasuk menikah lagi dengan pasangan yang sama', () => {
    const per = new Map()
    for (const u of nikahUtama) for (const p of [u.partner1_id, u.partner2_id].filter(Boolean)) {
      per.set(p, [...(per.get(p) ?? []), u])
    }
    const banyak = [...per.entries()].filter(([, us]) => us.length > 2)
    expect(banyak.length).toBeGreaterThan(0)
    const berulang = [...per.entries()].some(([p, us]) => {
      const pasangan = us.map((u) => (u.partner1_id === p ? u.partner2_id : u.partner1_id))
      return new Set(pasangan).size < pasangan.length
    })
    expect(berulang).toBe(true)
  })

  it('cerai, dan ditinggal wafat lalu menikah lagi', () => {
    expect(nikahUtama.some((u) => u.status === 'cerai')).toBe(true)
    const ditinggal = nikahUtama.filter((u) => u.status === 'menikah' && u.partner2_id && orang.get(u.partner2_id).is_deceased && !orang.get(u.partner1_id).is_deceased)
    expect(ditinggal.some((u) => nikahUtama.some((v) => v !== u && v.partner1_id === u.partner1_id && (v.marriage_y ?? 0) > (u.marriage_y ?? 0)))).toBe(true)
  })

  it('keturunan wafat dan pasangan wafat', () => {
    expect(utama.some((p) => p.is_deceased && keturunan(p.id))).toBe(true)
    expect(utama.some((p) => p.is_deceased && pasanganSaja(p.id))).toBe(true)
  })

  it('anak sambung, anak angkat, dan anak wafat saat bayi', () => {
    const jenis = new Set(data.children.filter((c) => c.tree_id === null).map((c) => c.kind))
    expect(jenis).toEqual(new Set(['kandung', 'sambung', 'angkat']))
    expect(utama.some((p) => p.is_deceased && p.death_y - p.birth_y <= 1)).toBe(true)
  })

  it('pernikahan antarsepupu: GEN sama dan GEN berbeda', () => {
    const sepupu = nikahUtama.filter((u) => u !== pangkal && keturunan(u.partner1_id) && keturunan(u.partner2_id))
    expect(sepupu.some((u) => s.gen.get(u.partner1_id) === s.gen.get(u.partner2_id))).toBe(true)
    expect(sepupu.some((u) => s.gen.get(u.partner1_id) !== s.gen.get(u.partner2_id))).toBe(true)
  })

  it('pasangan tidak diketahui dan jenis kelamin tidak diketahui', () => {
    expect(nikahUtama.some((u) => u.partner2_id === null)).toBe(true)
    expect(utama.some((p) => p.sex === null)).toBe(true)
  })

  it('gelar religius dan pendidikan, nama panggilan, pekerjaan, catatan', () => {
    for (const kolom of ['religious_title', 'academic_title', 'nickname', 'occupation', 'notes']) {
      expect(utama.some((p) => p[kolom]), kolom).toBe(true)
    }
  })

  it('tanggal kabur (tahun saja, perkiraan) dan tanggal lengkap', () => {
    expect(utama.some((p) => p.birth_y && !p.birth_m)).toBe(true)
    expect(utama.some((p) => p.birth_approx)).toBe(true)
    expect(utama.some((p) => p.birth_y && p.birth_m && !p.birth_d)).toBe(true)
    expect(utama.some((p) => p.birth_y && p.birth_m && p.birth_d)).toBe(true)
  })

  it('anak di bawah umur', () => {
    expect(utama.filter((p) => !p.is_deceased && TAHUN_INI - p.birth_y < 18).length).toBeGreaterThan(1)
  })

  it('kedua pohon keluarga asal (pasangan khusus A dan B)', () => {
    expect(data.origin_trees.filter((t) => t.is_active)).toHaveLength(2)
    for (const t of data.origin_trees) {
      expect(data.people.filter((p) => p.tree_id === t.id).length, t.id).toBeGreaterThan(3)
      expect(data.children.some((c) => c.tree_id === t.id && c.child_id === t.anchor_person_id), t.id).toBe(true)
    }
  })
})

describe('kontak fiktif (alamat dan nomor HP)', () => {
  it('banyak anggota punya kontak, dan setiap orangnya ada di silsilah utama dan masih hidup', () => {
    expect(kontakContoh.length).toBeGreaterThanOrEqual(20)
    expect(new Set(kontakContoh.map((k) => k.person_id)).size).toBe(kontakContoh.length)
    for (const k of kontakContoh) {
      const p = orang.get(k.person_id)
      expect(p, k.person_id).toBeTruthy()
      expect(p.tree_id, k.person_id).toBeNull()
      expect(p.is_deceased, k.person_id).toBe(false)
      expect(k.alamat || k.hp, k.person_id).toBeTruthy()
    }
  })

  it('nomor HP jelas fiktif dan alamat jelas rekaan', () => {
    for (const k of kontakContoh) {
      if (k.hp) expect(k.hp).toMatch(/^(0812-0000-00\d\d|\+39 333 000 00\d\d)$/)
      if (k.alamat) expect(k.alamat).toMatch(/Contoh|Esempio/)
    }
  })

  it('ada anak di bawah umur yang hanya punya alamat, tanpa nomor HP', () => {
    expect(kontakContoh.some((k) => !k.hp && TAHUN_INI - orang.get(k.person_id).birth_y < 18)).toBe(true)
  })
})
