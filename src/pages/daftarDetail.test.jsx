// @vitest-environment jsdom
// Layar Daftar dan Detail orang (langkah 1.21) di aplikasi UTUH dengan
// keluarga FIKTIF. Layar ini hanya membaca: tidak ada tulisan ke server.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { configure, screen, within } from '@testing-library/react'
import { pasang } from '../test/pembantu.jsx'
import { klienKeluarga } from '../test/klienKeluarga.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('Daftar', () => {
  it('menampilkan keturunan dan pasangan, dengan GEN dan nomor silsilah', async () => {
    pasang('/daftar', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Daftar', level: 1 })).toBeTruthy()
    const tamran = (await screen.findByRole('link', { name: /Tamran/ })).textContent
    expect(tamran).toContain('GEN.2')
    expect(tamran).toContain('Putu')
    expect(tamran).toContain('Anak ke-1')
    expect(tamran).toMatch(/No\. 1\.1\.1/)
    expect(screen.getByRole('heading', { name: 'Pasangan' })).toBeTruthy()
  })

  it('pencarian menyaring nama dan mengumumkan jumlahnya', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    const kotak = await screen.findByRole('searchbox', { name: 'Cari nama' })
    await aksi.type(kotak, 'tamran')
    expect(screen.getAllByRole('link', { name: /Tamran/ }).length).toBe(1)
    expect(screen.queryByRole('link', { name: /Cahya/ })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('1 orang')
    await aksi.clear(kotak)
    await aksi.type(kotak, 'zzzz')
    expect(screen.getByRole('status').textContent).toBe('Tidak ada nama yang cocok.')
  })

  it('orang di pohon keluarga asal tidak tampil, walaupun datanya sampai', async () => {
    pasang('/daftar', klienKeluarga())
    await screen.findByRole('link', { name: /Tamran/ })
    expect(screen.queryByRole('link', { name: /Karto/ })).toBeNull()
  })
})

describe('Keterangan orang (halaman sendiri)', () => {
  const bagian = (judul) => screen.getByRole('heading', { name: judul, level: 2 }).closest('section')

  it('dibuka dari Daftar: avatar, nama, "Anak · Generasi ke-1", INFORMASI ANGGOTA, anak', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    await aksi.click(await screen.findByRole('link', { name: /^Bima/ }))
    expect(await screen.findByRole('heading', { name: 'Bima', level: 1 })).toBeTruthy()
    expect(screen.getByText('Anak · Generasi ke-1')).toBeTruthy()
    const info = bagian('Informasi Anggota')
    expect(info.textContent).toContain('Jenis kelamin: Laki-laki')
    expect(info.textContent).toContain('Orang tua: Alm. Raksa & Almh. Selara')
    // pasangan: daftar "Istri ke-n", menikah lagi dengan istri ke-1 tetap satu baris
    expect(within(info).getAllByRole('listitem').map((li) => li.textContent.split('Menikah')[0])).toEqual([
      'Istri ke-1: Eka (bercerai)', 'Istri ke-2: Fitri (bercerai)', 'Istri ke-3: Gita',
    ])
    expect(info.textContent).toContain('menikah lagi tahun 1982')
    expect(within(bagian('Anak')).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Tamran', 'Ika', 'Alm. Tirwan', 'Kirana', 'Lintang', 'Mega', 'Nanda', 'Oka', 'Putri', 'Qori', 'Rangga',
    ])
    expect(screen.queryByText(/Pernikahan ke-/)).toBeNull()
  })

  it('satu pernikahan: tanpa "ke-1" dan tanpa kata ganda', async () => {
    pasang('/orang/cahya', klienKeluarga())
    await screen.findByRole('heading', { name: 'Cahya', level: 1 })
    const info = bagian('Informasi Anggota')
    expect(info.textContent).toContain('Pasangan: UmarMenikah tahun 1974')
    expect(document.body.textContent).not.toMatch(/(Istri|Suami|Pasangan|Pernikahan) ke-1|Menikah · Menikah/)
  })

  it('anak sambung: kata lembut hanya di keterangan anak itu', async () => {
    pasang('/orang/vino', klienKeluarga())
    await screen.findByRole('heading', { name: 'Vino', level: 1 })
    expect(bagian('Informasi Anggota').textContent).toContain('Anak sambung Cahya')
  })

  it('di keterangan orang tua anak sambung/angkat, daftar anak hanya berisi nama', async () => {
    pasang('/orang/lorvan', klienKeluarga())
    await screen.findByRole('heading', { name: 'Lorvan', level: 1 })
    expect(within(bagian('Anak')).getByRole('link', { name: 'Yoga' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/\bsambung\b|\bangkat\b/i)
  })

  it('pernikahan antarsepupu: orang tua satu baris, "Anak ke-n" untuk masing-masing, tanpa kalimat teknis', async () => {
    pasang('/orang/hasna', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Hasna', level: 1 })).toBeTruthy()
    const info = bagian('Informasi Anggota')
    expect(info.textContent).toContain('Orang tua: Rangga & Gendis')
    expect(info.textContent).toContain('Anak ke-1 dari Rangga')
    expect(info.textContent).toContain('Anak ke-1 dari Gendis')
    expect(within(info).getByRole('link', { name: 'Rangga' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Kedua orang tua adalah keturunan|Jalur terdekat|Lewat jalur ini/)
  })

  it('pasangan yang bukan keturunan: "Pasangan dari …" di bawah nama', async () => {
    pasang('/orang/umar', klienKeluarga())
    await screen.findByRole('heading', { name: 'Umar', level: 1 })
    expect(screen.getByText('Pasangan dari Cahya')).toBeTruthy()
  })

  it('tanpa pasangan: "Tidak ada"', async () => {
    pasang('/orang/oka', klienKeluarga())
    await screen.findByRole('heading', { name: 'Oka', level: 1 })
    expect(bagian('Informasi Anggota').textContent).toContain('Pasangan: Tidak ada')
  })

  it.each([['bayu', 'Bayu'], ['sekar', 'Almh. Sekar']])('anak di bawah umur atau wafat semasa kecil (%s): tanpa baris "Pasangan"', async (id, nama) => {
    pasang(`/orang/${id}`, klienKeluarga())
    await screen.findByRole('heading', { name: nama, level: 1 })
    expect(bagian('Informasi Anggota').textContent).not.toMatch(/Pasangan/)
  })

  it('orang yang tidak ada atau dari pohon keluarga asal → keterangan, bukan galat', async () => {
    pasang('/orang/tidak-ada', klienKeluarga())
    expect(await screen.findByText('Orang ini tidak ditemukan di silsilah.')).toBeTruthy()
    pasang('/orang/karto', klienKeluarga())
    expect((await screen.findAllByText('Orang ini tidak ditemukan di silsilah.')).length).toBeGreaterThan(0)
  })
})
