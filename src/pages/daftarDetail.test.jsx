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
  it('menampilkan keturunan dan pasangan, dengan GEN, tanpa nomor silsilah', async () => {
    pasang('/daftar', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Daftar', level: 1 })).toBeTruthy()
    const tamran = (await screen.findByRole('link', { name: /^Tamran/ })).textContent
    expect(tamran).toContain('GEN.2')
    expect(tamran).toContain('Putu')
    expect(tamran).toContain('Putra ke-1')
    expect(tamran).not.toContain('Anak ke-')
    expect(tamran).not.toMatch(/No\.|1\.1\.1|Nomor silsilah/)
    expect(document.body.textContent).not.toMatch(/No\. \d|Nomor silsilah|\b1\.\d+\.\d+\b/)
    expect(screen.getByRole('heading', { name: 'Pasangan' })).toBeTruthy()
  })

  it('anak bawaan pasangan dan keturunannya tanpa GEN dan istilah (putaran keenam)', async () => {
    pasang('/daftar', klienKeluarga())
    await screen.findByRole('heading', { name: 'Daftar', level: 1 })
    for (const nama of [/^Galen/, /^Elvina/, /^Vino/, /^Sadevan Bramasta/, /^Alm\. H\. Bagaskara/]) {
      expect((await screen.findByRole('link', { name: nama })).textContent, String(nama)).not.toMatch(/GEN|Anak|Putu|Buyut/)
    }
    expect(screen.getByRole('link', { name: /^Celvia/ }).textContent).toContain('GEN.3 · Buyut')
    expect(screen.getByRole('link', { name: /^Yoga/ }).textContent).toContain('GEN.2 · Putu')
    expect(screen.getByRole('link', { name: /^Ratrisa Anindya/ }).textContent).toContain('GEN.3 · Buyut')
  })

  it('pencarian menyaring nama dan mengumumkan jumlahnya', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    const kotak = await screen.findByRole('searchbox', { name: 'Cari nama' })
    await aksi.type(kotak, 'tamran')
    expect(screen.getAllByRole('link', { name: /Tamran/ }).length).toBe(1)
    expect(screen.queryByRole('link', { name: /Cahya/ })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('1 orang')
    await aksi.clear(kotak)
    await aksi.type(kotak, 'xqvj')
    expect(screen.getByRole('status').textContent).toBe('Tidak ada nama yang cocok.')
  })

  it('pencarian menemukan nama panggilan dan menyebut kenapa: "panggilan: Ovi"', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    const kotak = await screen.findByRole('searchbox', { name: 'Cari nama' })
    await aksi.type(kotak, 'ovi')
    const tautan = screen.getAllByRole('link')
    expect(tautan.filter((a) => a.textContent.includes('Elvina'))).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Elvina/ }).textContent).toContain('panggilan: Ovi')
    expect(screen.getByRole('status').textContent).toBe('1 orang')
    // Cocok lewat nama: tidak ada keterangan "panggilan:" (nama panggilan tetap tampil dalam tanda kutip).
    await aksi.clear(kotak)
    await aksi.type(kotak, 'elvina')
    expect(screen.getByRole('link', { name: /Elvina/ }).textContent).not.toContain('panggilan:')
    expect(screen.getByRole('link', { name: /Elvina/ }).textContent).toContain('“Ovi”')
  })

  it('pencarian tahan gelar, tanda baca, huruf besar, ejaan lama, dan menemukan pasangan', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    const kotak = await screen.findByRole('searchbox', { name: 'Cari nama' })
    for (const [kata, nama] of [['H. HALVIN!', /Halvin/], ['dorvi s.kom.', /Dorvi/], ['Tjahya', /Cahya/], ['oemar', /Umar/], ['mbak dara', /Dara/]]) {
      await aksi.clear(kotak)
      await aksi.type(kotak, kata)
      expect(screen.getByRole('link', { name: nama }), kata).toBeTruthy()
      expect(screen.getByRole('status').textContent, kata).toBe('1 orang')
    }
  })

  it('orang di pohon keluarga asal tidak tampil, walaupun datanya sampai', async () => {
    pasang('/daftar', klienKeluarga())
    await screen.findByRole('link', { name: /^Tamran/ })
    expect(screen.queryByRole('link', { name: /Karto/ })).toBeNull()
  })
})

describe('Keterangan orang (halaman sendiri)', () => {
  const bagian = (judul) => screen.getByRole('heading', { name: judul, level: 2 }).closest('section')
  // Baris orang tua di KETERANGAN PRIBADI, masing-masing persis seperti tampil.
  const barisOrangTua = () =>
    [...bagian('Keterangan Pribadi').querySelectorAll('dl > div')]
      .map((b) => b.textContent)
      .filter((t) => /^(Orang tua|Ayah sambung|Ibu sambung|Orang tua sambung|Orang tua angkat):/.test(t))

  it('dibuka dari Daftar: avatar, nama, "Anak · Generasi ke-1", KETERANGAN PRIBADI, anak', async () => {
    const { aksi } = pasang('/daftar', klienKeluarga())
    await aksi.click(await screen.findByRole('link', { name: /^Bima/ }))
    expect(await screen.findByRole('heading', { name: 'Bima', level: 1 })).toBeTruthy()
    expect(screen.getByText('Anak · Generasi ke-1')).toBeTruthy()
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Putra ke-1 dari 3 bersaudara')
    expect(info.textContent).not.toContain('Urutan lahir')
    expect(info.textContent).toContain('Jenis kelamin: Laki-laki')
    expect(info.textContent).toContain('Orang tua: Alm. Raksa & Almh. Selara')
    expect(info.textContent).toContain('Status pernikahan: Menikah')
    // pasangan: daftar "Istri ke-n", menikah lagi dengan istri ke-1 tetap satu baris
    expect(within(info).getAllByRole('listitem').map((li) => li.textContent.split('Menikah')[0])).toEqual([
      'Istri ke-1: Eka (berpisah)', 'Istri ke-2: Fitri (berpisah)', 'Istri ke-3: Gita',
    ])
    expect(info.textContent).toContain('menikah lagi tahun 1982')
    expect(within(bagian('Anak')).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Tamran', 'Ika', 'Alm. Tirwan', 'Kirana', 'Lintang', 'Mega', 'Nanda', 'Oka', 'Putri', 'Qori', 'Rangga',
    ])
    // Daftar anak bernomor 1–11, dengan "· dari istri ke-n" (Bima menikah dengan lebih dari satu orang).
    const anak = within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)
    expect(anak[0]).toBe('1.Tamran · dari istri ke-1')
    expect(anak[5]).toBe('6.Mega · dari istri ke-1')
    expect(anak[10]).toBe('11.Rangga · dari istri ke-3')
    expect(document.body.textContent).not.toMatch(/cerai|Anak ke-/i)
    expect(screen.queryByText(/Pernikahan ke-/)).toBeNull()
  })

  it('satu pernikahan: tanpa "ke-1" dan tanpa kata ganda', async () => {
    pasang('/orang/cahya', klienKeluarga())
    await screen.findByRole('heading', { name: 'Cahya', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Pasangan: UmarMenikah tahun 1974')
    expect(document.body.textContent).not.toMatch(/(Istri|Suami|Pasangan|Pernikahan) ke-1|Menikah · Menikah/)
  })

  it('anak sambung: "Orang tua: Umar" lalu "Ibu sambung: Cahya" di baris sendiri (keduanya bisa diketuk) dan "Anak sambung Cahya", tanpa nomor urut', async () => {
    pasang('/orang/vino', klienKeluarga())
    await screen.findByRole('heading', { name: 'Vino', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(barisOrangTua()).toEqual(['Orang tua: Umar', 'Ibu sambung: Cahya'])
    expect(info.textContent).toContain('Anak sambung Cahya')
    expect(within(info).getByRole('link', { name: 'Umar' })).toBeTruthy()
    expect(within(info).getByRole('link', { name: 'Cahya' })).toBeTruthy()
    expect(info.textContent).not.toMatch(/Putra ke-|bersaudara|\((ayah|ibu) sambung\)/)
  })

  it('anak angkat: "Orang tua angkat: Lorvan & Sinta" (keduanya bisa diketuk) dan "Anak angkat Lorvan & Sinta"', async () => {
    pasang('/orang/yoga', klienKeluarga())
    await screen.findByRole('heading', { name: 'Yoga', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Orang tua angkat: Lorvan & Sinta')
    expect(info.textContent).toContain('Anak angkat Lorvan & Sinta')
    expect(info.textContent).not.toContain('Orang tua: ')
    expect(within(info).getByRole('link', { name: 'Lorvan' })).toBeTruthy()
    expect(within(info).getByRole('link', { name: 'Sinta' })).toBeTruthy()
  })

  it('di keterangan orang tua: anak kandung bernomor, anak sambung/angkat tanpa nomor dengan keterangan kecil', async () => {
    pasang('/orang/cahya', klienKeluarga())
    await screen.findByRole('heading', { name: 'Cahya', level: 1 })
    expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Vino · anak sambung', '1.Wati',
    ])
  })

  it('anak angkat di keterangan orang tuanya: tanpa nomor, "anak angkat"', async () => {
    pasang('/orang/lorvan', klienKeluarga())
    await screen.findByRole('heading', { name: 'Lorvan', level: 1 })
    expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1.Kelvan', 'Yoga · anak angkat', '2.Arum',
    ])
  })

  it('pernikahan antarsepupu: orang tua satu baris, urutan sekali kalau sama bagi kedua pihak, tanpa kalimat teknis', async () => {
    pasang('/orang/hasna', klienKeluarga())
    expect(await screen.findByRole('heading', { name: 'Hasna', level: 1 })).toBeTruthy()
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Orang tua: Rangga & Gendis')
    expect(info.textContent).toContain('Putri tunggal')
    expect(info.textContent).not.toContain('(pihak')
    expect(within(info).getByRole('link', { name: 'Rangga' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Kedua orang tua adalah keturunan|Jalur terdekat|Lewat jalur ini/)
  })

  it('pasangan yang bukan keturunan: "Pasangan dari …" di bawah nama', async () => {
    pasang('/orang/umar', klienKeluarga())
    await screen.findByRole('heading', { name: 'Umar', level: 1 })
    expect(screen.getByText('Pasangan dari Cahya')).toBeTruthy()
  })

  it('dewasa tanpa data pernikahan: "Status pernikahan: -", tanpa baris Pasangan; isian kosong ditulis "-"', async () => {
    pasang('/orang/oka', klienKeluarga())
    await screen.findByRole('heading', { name: 'Oka', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Status pernikahan: -')
    expect(info.textContent).not.toMatch(/Pasangan:/)
    for (const baris of ['Panggilan: -', 'Pekerjaan: -']) expect(info.textContent).toContain(baris)
    expect(bagian('Riwayat Hidup').textContent).toContain('Catatan: -')
    // Masih hidup: tidak ada baris Wafat sama sekali.
    expect(bagian('Riwayat Hidup').textContent).not.toMatch(/Wafat/)
    expect(document.body.textContent).not.toMatch(/Belum menikah/)
  })

  it('berpisah lalu menikah lagi: anak menurut umur, anak sambung tanpa nomor di antara anak kandung', async () => {
    pasang('/orang/kirana', klienKeluarga())
    await screen.findByRole('heading', { name: 'Kirana', level: 1 })
    expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1.Celvia · dari suami ke-1', 'Galen · anak sambung · dari suami ke-2', 'Elvina · anak sambung · dari suami ke-2', '2.Fajrin · dari suami ke-2',
    ])
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Status pernikahan: Menikah')
    expect(info.textContent).toContain('Suami ke-1: Danuarta (berpisah)')
  })

  it('pasangan (bukan keturunan): SEMUA anaknya, bernomor dari sudut pandangnya, anak dari pernikahan sebelumnya ditandai', async () => {
    pasang('/orang/harvel', klienKeluarga())
    await screen.findByRole('heading', { name: 'Harvel', level: 1 })
    expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Celvia · anak sambung', '1.Galen · dari pernikahan sebelumnya', '2.Elvina · dari pernikahan sebelumnya', '3.Fajrin',
    ])
  })

  // Anak sambung dari sisi pasangan, persis seperti yang tampil di layar.
  it.each([
    ['kirana', 'Kirana', ['1.Celvia · dari suami ke-1', 'Galen · anak sambung · dari suami ke-2', 'Elvina · anak sambung · dari suami ke-2', '2.Fajrin · dari suami ke-2']],
    ['umar', 'Umar', ['1.Vino · dari pernikahan sebelumnya', '2.Wati']],
    ['cahya', 'Cahya', ['Vino · anak sambung', '1.Wati']],
  ])('daftar Anak %s', async (id, nama, harapan) => {
    pasang(`/orang/${id}`, klienKeluarga())
    await screen.findByRole('heading', { name: nama, level: 1 })
    expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(harapan)
  })

  it.each([
    ['celvia', 'Celvia', ['Orang tua: Danuarta & Kirana', 'Ayah sambung: Harvel'], 'Anak sambung Harvel'],
    ['galen', 'Galen', ['Orang tua: Harvel', 'Ibu sambung: Kirana'], 'Anak sambung Kirana'],
    ['elvina', 'Elvina', ['Orang tua: Harvel', 'Ibu sambung: Kirana'], 'Anak sambung Kirana'],
    ['vino', 'Vino', ['Orang tua: Umar', 'Ibu sambung: Cahya'], 'Anak sambung Cahya'],
  ])('%s: orang tua sambung di baris sendiri dan "Anak sambung …"', async (id, nama, orangTua, kalimat) => {
    pasang(`/orang/${id}`, klienKeluarga())
    await screen.findByRole('heading', { name: nama, level: 1 })
    expect(barisOrangTua()).toEqual(orangTua)
    expect(bagian('Keterangan Pribadi').textContent).toContain(kalimat)
  })

  // Putaran kelima, bagian B: baris orang tua dipisah.
  describe('baris orang tua: kandung, ayah sambung, ibu sambung, angkat', () => {
    const buka = async (id, nama) => {
      pasang(`/orang/${id}`, klienKeluarga())
      await screen.findByRole('heading', { name: nama, level: 1 })
      return barisOrangTua()
    }
    it('anak Danuarta & Kirana yang menjadi anak sambung Harvel (Celvia): "Orang tua: Danuarta & Kirana", "Ayah sambung: Harvel"', async () => {
      expect(await buka('celvia', 'Celvia')).toEqual(['Orang tua: Danuarta & Kirana', 'Ayah sambung: Harvel'])
    })
    it('anak Bima & Eka: "Orang tua: Bima & Eka", "Ibu sambung: Fitri, Gita"', async () => {
      for (const [id, nama] of [['tamran', 'Tamran'], ['ika', 'Ika']]) {
        expect(await buka(id, nama), id).toEqual(['Orang tua: Bima & Eka', 'Ibu sambung: Fitri, Gita'])
        document.body.innerHTML = ''
      }
    })
    it('Fajrin (lahir sesudah Kirana berpisah dari Danuarta): TIDAK ada "Ayah sambung: Danuarta"', async () => {
      const baris = await buka('fajrin', 'Fajrin')
      expect(baris).toEqual(['Orang tua: Harvel & Kirana'])
      expect(document.body.textContent).not.toMatch(/Ayah sambung|Danuarta/)
    })
    it('panel Harvel tidak berubah: empat anak, Celvia anak sambung, lalu Galen, Elvina, Fajrin', async () => {
      await buka('harvel', 'Harvel')
      expect(within(bagian('Anak')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Celvia · anak sambung', '1.Galen · dari pernikahan sebelumnya', '2.Elvina · dari pernikahan sebelumnya', '3.Fajrin',
      ])
    })
    it('1. ayah selalu lebih dulu, juga kalau ibu yang dicatat sebagai partner1; hanya satu yang tercatat: satu nama tanpa "&"', async () => {
      expect(await buka('wati', 'Wati')).toEqual(['Orang tua: Umar & Cahya'])
      document.body.innerHTML = ''
      expect(await buka('arya', 'Arya')).toEqual(['Orang tua: Lintang'])
    })
    it('2. label menurut jenis kelamin; lebih dari satu dipisah koma, urut waktu pernikahan (paling awal di kiri)', async () => {
      expect(await buka('tamran', 'Tamran')).toEqual(['Orang tua: Bima & Eka', 'Ibu sambung: Fitri, Gita'])
      document.body.innerHTML = ''
      expect(await buka('dorvi', 'Dorvi, S.Kom.')).toEqual(['Orang tua: Alm. H. Halvin & Ika', 'Ayah sambung: Joval, S.E.'])
    })
    it('3. punya keduanya: "Ayah sambung" dulu, lalu "Ibu sambung"', async () => {
      expect(await buka('nirvo', 'Nirvo')).toEqual(['Orang tua: Tamran & Wati', 'Ayah sambung: Tedrik', 'Ibu sambung: Melvira'])
    })
    it('4. batas waktu sama dengan anak sambung: lahir sesudah berpisah atau wafat sebelum menikah bukan anak sambung', async () => {
      // Mega (1983) lahir sesudah Bima dan Fitri berpisah (1981): hanya Gita.
      expect(await buka('mega', 'Mega')).toEqual(['Orang tua: Bima & Eka', 'Ibu sambung: Gita'])
      document.body.innerHTML = ''
      // Almh. Sekar wafat 1998, sebelum Ika menikah dengan Joval (2012).
      expect(await buka('sekar', 'Almh. Sekar')).toEqual(['Orang tua: Alm. H. Halvin & Ika'])
      document.body.innerHTML = ''
      // Bayu lahir 2013, sesudah Alm. H. Halvin wafat (2008).
      expect(await buka('bayu', 'Bayu')).toEqual(['Orang tua: Joval, S.E. & Ika'])
    })
    it('5. "Orang tua angkat" di barisnya sendiri; tanpa data orang tua kandung tidak ada baris "Orang tua"', async () => {
      expect(await buka('yoga', 'Yoga')).toEqual(['Orang tua angkat: Lorvan & Sinta'])
    })
  })

  it('"Belum menikah" yang dipilih sendiri', async () => {
    pasang('/orang/putri', klienKeluarga())
    await screen.findByRole('heading', { name: 'Putri', level: 1 })
    expect(bagian('Keterangan Pribadi').textContent).toContain('Status pernikahan: Belum menikah')
  })

  it('pernikahan baru tanpa pernikahan sebelumnya ditandai berakhir: keduanya tercatat, status Menikah', async () => {
    pasang('/orang/qori', klienKeluarga())
    await screen.findByRole('heading', { name: 'Qori', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Status pernikahan: Menikah')
    expect(within(info).getAllByRole('listitem').map((li) => li.textContent.split('Menikah')[0])).toEqual([
      'Istri ke-1: Nadira', 'Istri ke-2: Ravela',
    ])
  })

  it('pasangan (bukan keturunan): "Orang tua: -"; tidak ada baris "Nomor silsilah"', async () => {
    pasang('/orang/gita', klienKeluarga())
    await screen.findByRole('heading', { name: 'Gita', level: 1 })
    const info = bagian('Keterangan Pribadi')
    expect(info.textContent).toContain('Orang tua: -')
    expect(info.textContent).not.toContain('Nomor silsilah')
  })

  it('sudah wafat: baris Wafat tampil', async () => {
    pasang('/orang/tirwan', klienKeluarga())
    await screen.findByRole('heading', { name: 'Alm. Tirwan', level: 1 })
    expect(bagian('Riwayat Hidup').textContent).toContain('Wafat: Kota Contoh, 2015')
  })

  it.each([['bayu', 'Bayu'], ['sekar', 'Almh. Sekar']])('anak di bawah umur atau wafat semasa kecil (%s): tanpa Status pernikahan dan Pasangan', async (id, nama) => {
    pasang(`/orang/${id}`, klienKeluarga())
    await screen.findByRole('heading', { name: nama, level: 1 })
    expect(bagian('Keterangan Pribadi').textContent).not.toMatch(/Pasangan|Status pernikahan/)
  })

  it('orang yang tidak ada atau dari pohon keluarga asal → keterangan, bukan galat', async () => {
    pasang('/orang/tidak-ada', klienKeluarga())
    expect(await screen.findByText('Orang ini tidak ditemukan di silsilah.')).toBeTruthy()
    pasang('/orang/karto', klienKeluarga())
    expect((await screen.findAllByText('Orang ini tidak ditemukan di silsilah.')).length).toBeGreaterThan(0)
  })
})
