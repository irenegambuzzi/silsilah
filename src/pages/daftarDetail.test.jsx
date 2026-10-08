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
    expect(screen.getByRole('heading', { name: 'Pasangan dan lainnya' })).toBeTruthy()
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

describe('Detail orang', () => {
  it('dibuka dari Daftar dan menampilkan keterangan serta pernikahan dengan anak', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    await aksi.click(await screen.findByRole('link', { name: /^Bima/ }))
    expect(await screen.findByRole('heading', { name: 'Bima', level: 1 })).toBeTruthy()
    expect(screen.getByText('Generasi ke-1 (Anak)')).toBeTruthy()
    // 4 pernikahan; yang ke-3 adalah pernikahan ulang dengan istri ke-1
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Pernikahan ke-1', 'Pernikahan ke-2', 'Pernikahan ke-3', 'Pernikahan ke-4',
    ])
    expect(screen.getAllByText(/istri ke-1/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('link', { name: 'Oka' })).toBeTruthy()
  })

  it('pernikahan antarsepupu: kedua jalur tampil, yang terdekat lebih dulu', async () => {
    pasang('/orang/hasna', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Hasna', level: 1 })).toBeTruthy()
    expect(screen.getByText(/Kedua orang tua adalah keturunan pangkal/)).toBeTruthy()
    const jalur = screen.getAllByRole('listitem').filter((li) => /Jalur/.test(li.textContent))
    expect(jalur.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Jalur terdekat ke pangkal'),
      expect.stringContaining('Jalur lain'),
    ])
    expect(within(jalur[0]).getByRole('link', { name: 'Rangga' })).toBeTruthy()
    expect(jalur[0].textContent).toContain('Lewat jalur ini: GEN.3')
    expect(within(jalur[1]).getByRole('link', { name: 'Gendis' })).toBeTruthy()
    expect(jalur[1].textContent).toContain('Lewat jalur ini: GEN.4')
  })

  it('sepupu sama dekat: jalur kedua ditandai "sama dekat"', async () => {
    pasang('/orang/nirvo', klienKeluarga())
    await screen.findByRole('heading', { name: 'Nirvo', level: 1 })
    expect(screen.getByText('Jalur terdekat ke pangkal')).toBeTruthy()
    expect(screen.getByText('Jalur lain (sama dekat)')).toBeTruthy()
  })

  it('orang tua yang bukan keturunan tampil sebagai "Orang tua lain"', async () => {
    pasang('/orang/vino', klienKeluarga())
    await screen.findByRole('heading', { name: 'Vino', level: 1 })
    expect(screen.getByText('Orang tua lain')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Umar' }).closest('li').textContent).toContain('Anak sambung')
  })

  it('pasangan yang bukan keturunan menampilkan "Pasangan dari …"', async () => {
    pasang('/orang/umar', klienKeluarga())
    await screen.findByRole('heading', { name: 'Umar', level: 1 })
    expect(screen.getByText(/Pasangan dari Cahya/)).toBeTruthy()
  })

  it('orang yang tidak ada atau dari pohon keluarga asal → keterangan, bukan galat', async () => {
    pasang('/orang/tidak-ada', klienKeluarga())
    expect(await screen.findByText('Orang ini tidak ditemukan di silsilah.')).toBeTruthy()
    pasang('/orang/karto', klienKeluarga())
    expect((await screen.findAllByText('Orang ini tidak ditemukan di silsilah.')).length).toBeGreaterThan(0)
  })
})
