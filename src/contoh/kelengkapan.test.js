// Mode contoh harus selalu lengkap (PLAN.md, aturan tetap): setiap kasus yang
// sudah didukung aplikasi wajib punya contoh di data fiktif, supaya bisa
// ditinjau di layar. Kalau tes ini gagal setelah data contoh diubah, tambahkan
// kembali contohnya; jangan hapus pemeriksaannya.
import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from '../lib/silsilah/keluargaFiktif.js'
import { susunSilsilah } from '../lib/silsilah/silsilah.js'
import { labelDetail } from '../lib/silsilah/kartu.js'
import { anakOrangTua } from '../lib/silsilah/anak.js'
import { statusPernikahan } from '../lib/silsilah/status.js'
import { belumDewasa } from '../lib/silsilah/umur.js'
import { susunBagan } from '../lib/bagan/susun.js'
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

  it('pernikahan berulang dengan urutan anak 1–11 lintas pernikahan, kiri ke kanan di bagan', () => {
    const bagan = susunBagan(s)
    const banyak = [...bagan.simpul.values()].find((n) => n.pasangan.some((k) => k.ulang))
    expect(banyak).toBeTruthy()
    expect(banyak.anak.map((a) => a.kartu.urut)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('berpisah (juga tanpa jalur resmi) lalu menikah lagi, dan ditinggal wafat lalu menikah lagi', () => {
    expect(nikahUtama.some((u) => u.status === 'cerai')).toBe(true)
    const tanpaResmi = nikahUtama.find((u) => u.status === 'cerai' && /tanpa jalur resmi/i.test(u.notes ?? ''))
    expect(tanpaResmi).toBeTruthy()
    expect(nikahUtama.some((v) => v !== tanpaResmi && v.partner1_id === tanpaResmi.partner1_id && v.marriage_y > tanpaResmi.marriage_y)).toBe(true)
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

  it('anak sambung yang LEBIH TUA dari anak kandung, dan yang LEBIH MUDA dari anak kandung', () => {
    let lebihTua = false
    let lebihMuda = false
    for (const p of s.graf.orang.keys()) {
      const { semua } = anakOrangTua(s.graf, p)
      semua.forEach((a, i) => {
        if (a.kind !== 'sambung' || a.kandung) return
        if (semua.slice(i + 1).some((b) => b.kandung)) lebihTua = true
        if (semua.slice(0, i).some((b) => b.kandung)) lebihMuda = true
      })
    }
    expect(lebihTua).toBe(true)
    expect(lebihMuda).toBe(true)
  })

  it('pasangan (bukan keturunan) dengan anak dari pernikahan sebelumnya dan anak bersama keturunan', () => {
    const ada = [...s.graf.orang.keys()].some((id) => {
      if (s.gen.has(id)) return false
      const { semua } = anakOrangTua(s.graf, id)
      return semua.some((a) => a.lain) && semua.some((a) => a.kandung && !a.lain)
    })
    expect(ada).toBe(true)
  })

  it('anak sambung dari sisi pasangan: pasangan keturunan DAN pasangan bukan keturunan punya anak sambung dari hubungan lain', () => {
    const punya = (id) => labelDetail(s, id).anak.some((a) => a.jenis === 'anak sambung')
    expect(utama.some((p) => keturunan(p.id) && punya(p.id))).toBe(true)
    expect(utama.some((p) => pasanganSaja(p.id) && punya(p.id))).toBe(true)
    // ... termasuk anak yang dicatat di pernikahan lain, bukan di pernikahan pasangan itu (Celvia bagi Harvel).
    const celvia = labelDetail(s, 'celvia')
    expect(celvia.orangTua[0].orang.some((o) => o.sambung)).toBe(true)
  })

  it('nama panggilan yang sangat berbeda dari nama lengkap (untuk menguji pencarian)', () => {
    const huruf = (teks) => teks.toLowerCase().replace(/[^a-z]/g, '')
    const beda = utama.filter((p) => p.nickname && !huruf(p.full_name).includes(huruf(p.nickname)) && !huruf(p.nickname).includes(huruf(p.full_name)))
    expect(beda.length).toBeGreaterThanOrEqual(5)
  })

  it('pernikahan baru sementara pernikahan sebelumnya belum ditandai berakhir', () => {
    expect([...s.graf.pernikahan.entries()].some(([id, us]) =>
      s.gen.has(id) && us.filter((u) => u.status === 'menikah' && u.partner2_id && !orang.get(u.partner2_id).is_deceased).length > 1)).toBe(true)
  })

  it('status pernikahan: dewasa tanpa data pernikahan ("-") dan yang memilih "Belum menikah" sendiri', () => {
    const dewasa = utama.filter((p) => !p.is_deceased && p.birth_y && TAHUN_INI - p.birth_y >= 18)
    expect(dewasa.some((p) => statusPernikahan(s, p.id) === null && !p.marital_choice)).toBe(true)
    expect(utama.some((p) => p.marital_choice === 'belum_menikah' && statusPernikahan(s, p.id) === 'belum_menikah')).toBe(true)
    for (const st of ['menikah', 'berpisah', 'ditinggal_wafat']) expect(utama.some((p) => statusPernikahan(s, p.id) === st), st).toBe(true)
  })

  it('kolom kosong supaya terlihat "-"', () => {
    const d = labelDetail(s, utama.find((p) => !p.nickname && !p.occupation && !p.notes && !p.birth_place && s.gen.has(p.id)).id)
    expect([d.panggilan, d.pekerjaan, d.catatan]).toEqual([null, null, null])
  })

  it('pernikahan antarsepupu: GEN sama dan GEN berbeda', () => {
    const sepupu = nikahUtama.filter((u) => u !== pangkal && keturunan(u.partner1_id) && keturunan(u.partner2_id))
    expect(sepupu.some((u) => s.gen.get(u.partner1_id) === s.gen.get(u.partner2_id))).toBe(true)
    expect(sepupu.some((u) => s.gen.get(u.partner1_id) !== s.gen.get(u.partner2_id))).toBe(true)
  })

  it('pernikahan antarsepupu dengan jalur IBU lebih dekat ke pangkal daripada jalur ayah (aturan pihak laki-laki terlihat)', () => {
    const sepupu = nikahUtama.filter((u) => u !== pangkal && keturunan(u.partner1_id) && keturunan(u.partner2_id))
    const ada = sepupu.some((u) => {
      const [ayah, ibu] = [u.partner1_id, u.partner2_id].sort((a) => (orang.get(a).sex === 'L' ? -1 : 1))
      return orang.get(ayah).sex === 'L' && orang.get(ibu).sex === 'P' && s.gen.get(ibu) < s.gen.get(ayah) &&
        data.children.some((c) => c.union_id === u.id)
    })
    expect(ada).toBe(true)
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

  it('anak di bawah umur, termasuk dengan tanggal lahir lengkap', () => {
    expect(utama.filter((p) => !p.is_deceased && TAHUN_INI - p.birth_y < 18).length).toBeGreaterThan(1)
    expect(utama.some((p) => belumDewasa(p) && p.birth_m && p.birth_d)).toBe(true)
  })

  it('nama depan yang sama di cabang berbeda: sesama keturunan, dan keturunan + pasangan', () => {
    // Cabang = anak pasangan pangkal (GEN.1) yang menurunkan orang itu; pasangan ikut cabang suami/istrinya.
    const cabang = (id) => {
      if (!s.gen.has(id)) {
        const u = s.graf.pernikahan.get(id)?.find((x) => keturunan(x.partner1_id === id ? x.partner2_id : x.partner1_id))
        return u ? cabang(u.partner1_id === id ? u.partner2_id : u.partner1_id) : null
      }
      if (s.gen.get(id) <= 1) return id
      const u = s.graf.unions.get(s.graf.tautan.get(id)[0].union_id)
      return cabang([u.partner1_id, u.partner2_id].find((p) => p && keturunan(p)) ?? u.partner1_id)
    }
    const depan = (p) => p.full_name.split(' ')[0]
    const pasangan = []
    for (const [i, a] of utama.entries()) for (const b of utama.slice(i + 1)) {
      if (depan(a) === depan(b) && cabang(a.id) && cabang(b.id) && cabang(a.id) !== cabang(b.id)) pasangan.push([a.id, b.id])
    }
    expect(pasangan.some(([a, b]) => keturunan(a) && keturunan(b))).toBe(true)
    expect(pasangan.some(([a, b]) => keturunan(a) !== keturunan(b))).toBe(true)
  })

  it('nama 2, 3, dan 4 kata (masing-masing minimal dua orang), sebagian dengan gelar dan panggilan', () => {
    for (const n of [2, 3, 4]) {
      const ini = utama.filter((p) => p.full_name.trim().split(/\s+/).length === n)
      expect(ini.length, `${n} kata`).toBeGreaterThanOrEqual(2)
      if (n > 2) {
        expect(ini.some((p) => p.religious_title || p.academic_title), `${n} kata, gelar`).toBe(true)
        expect(ini.some((p) => p.nickname), `${n} kata, panggilan`).toBe(true)
      }
    }
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
