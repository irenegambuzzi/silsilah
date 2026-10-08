// Memuat semua data silsilah: per halaman, hanya kolom yang diizinkan,
// tanpa isi tempat sampah, dan tanpa menulis apa pun. Data FIKTIF.
import { describe, expect, it } from 'vitest'
import { buatKlienTiruan, GALAT } from '../../test/klienTiruan.js'
import { UKURAN_HALAMAN, ambilSemua, muatSemua } from './muat.js'

const orangFiktif = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `orang-${String(i).padStart(5, '0')}`, tree_id: null, full_name: `Orang Contoh ${i}`, deleted_at: null }))

describe('ambilSemua', () => {
  it('memuat lebih dari 1.000 orang per halaman sampai lengkap', async () => {
    const klien = buatKlienTiruan({ tabel: { people: orangFiktif(2500) }, batasBaris: UKURAN_HALAMAN })
    const r = await ambilSemua(klien, 'people')
    expect(r).toHaveLength(2500)
    expect(new Set(r.map((p) => p.id)).size).toBe(2500)
    expect(klien.panggilanKe('tabel', 'people').map((p) => p.isi.dari)).toEqual([0, 1000, 2000])
  })

  it('server membatasi lebih kecil dari halaman (misalnya 300 baris): tetap lengkap', async () => {
    const klien = buatKlienTiruan({ tabel: { people: orangFiktif(1250) }, batasBaris: 300 })
    expect(await ambilSemua(klien, 'people')).toHaveLength(1250)
  })

  it('yang ada di tempat sampah tidak ikut', async () => {
    const people = [...orangFiktif(3), { id: 'dibuang', tree_id: null, full_name: 'Dibuang Contoh', deleted_at: '2026-10-01T00:00:00Z' }]
    const r = await ambilSemua(buatKlienTiruan({ tabel: { people } }), 'people')
    expect(r.map((p) => p.id)).not.toContain('dibuang')
    expect(r).toHaveLength(3)
  })

  it('kolom lain dari server (misalnya kolom kontak) dibuang', async () => {
    const klien = buatKlienTiruan({ tabel: { people: [{ id: 'a', tree_id: null, full_name: 'A', deleted_at: null, phone_enc: 'x', alamat: 'Jalan Contoh' }] } })
    const [a] = await ambilSemua(klien, 'people')
    expect(a).toEqual({ id: 'a', tree_id: null, full_name: 'A', deleted_at: null })
  })

  it('galat server dilempar apa adanya', async () => {
    const klien = buatKlienTiruan({ gagalTabel: { people: async () => GALAT('PGRST205', 'not found', 404).error } })
    await expect(ambilSemua(klien, 'people')).rejects.toMatchObject({ code: 'PGRST205' })
  })
})

describe('muatSemua', () => {
  it('semua tabel silsilah + pangkal + istilah generasi; hanya membaca', async () => {
    const klien = buatKlienTiruan({
      tabel: {
        people: orangFiktif(2),
        unions: [{ id: 'u', tree_id: null, partner1_id: 'orang-00000', partner2_id: 'orang-00001', deleted_at: null }],
        settings: [{ root_union_id: 'u', generation_terms: ['Pangkal', 'Anak'], contact_quota_member: 20 }],
      },
    })
    const d = await muatSemua(klien)
    expect(d.people).toHaveLength(2)
    expect(d.unions).toHaveLength(1)
    expect(d.root_union_id).toBe('u')
    expect(d.generation_terms).toEqual(['Pangkal', 'Anak'])
    expect(d).not.toHaveProperty('contact_quota_member')
    expect(klien.tulisan()).toEqual([])
    expect(klien.panggilan.filter((p) => p.jenis !== 'tabel')).toEqual([])
  })
})
