// @vitest-environment jsdom
// Bagan (langkah 1.22) di aplikasi UTUH dengan keluarga FIKTIF: kartu,
// ketuk kartu, fokus cabang, dan geser/zoom dengan jari. jsdom tidak punya
// tata letak, jadi garis penghubung dan ukuran sungguhan dilihat lewat mode
// contoh; di sini yang diuji perilaku dan isinya.
import 'fake-indexeddb/auto'
import fs from 'node:fs'
import path from 'node:path'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { configure, fireEvent, screen, within } from '@testing-library/react'
import { pasang } from '../test/pembantu.jsx'
import { keluargaFiktif, klienKeluarga, tabelKeluarga } from '../test/klienKeluarga.js'

configure({ asyncUtilTimeout: 5000 })
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

// Kartu menurut id orang (nama bisa muncul juga di keterangan kartu pasangan).
const k = (id) => document.querySelector(`[data-orang="${id}"]`)
const tunggu = () => screen.findByRole('button', { name: /Hasna/ })
const semuaKartu = () => document.querySelectorAll('[data-orang]')
const isiBagan = () => document.querySelector('[role="group"] > div')
const transform = () => isiBagan().style.transform

describe('Bagan: isi kartu', () => {
  it('kartu keturunan: GEN di pojok, nama, dan istilah Jawa', async () => {
    pasang('/bagan', klienKeluarga())
    await screen.findByRole('heading', { name: 'Silsilah Keluarga', level: 1 })
    await tunggu()
    const mega = k('mega')
    expect(mega.querySelector('.kartu-gen').textContent).toBe('GEN.2')
    expect(mega.querySelector('.kartu-nama').textContent).toBe('Mega')
    expect(mega.querySelector('.kartu-label').textContent).toBe('Putu')
  })

  it('kartu pangkal: nama dengan Alm./Almh. dan label "Pangkal"', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('raksa').textContent).toContain('Alm. Raksa')
    expect(k('raksa').textContent).toContain('Pangkal')
    expect(k('selara').textContent).toContain('Almh. Selara')
    expect(k('selara').textContent).toContain('Pangkal')
  })

  it('anak sambung/angkat tampil sama persis dengan saudaranya, tanpa label khusus', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.body.textContent).not.toMatch(/\bsambung\b|\bangkat\b/i)
    expect(k('vino').querySelector('.kartu-label').textContent).toBe('Putu')
  })

  it('pasangan yang bukan keturunan: tanpa GEN, dengan "Istri ke-n" di atas kartunya', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('eka').textContent).not.toContain('GEN')
    expect(screen.getAllByText('Istri ke-1')).toHaveLength(3) // Eka, Eka lagi (menikah kembali), dan istri ke-1 Qori
    expect(screen.getByText('Istri ke-3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Istri ke-2: Fitri' })).toBe(k('fitri'))
  })

  it('pernikahan kembali: kartu pasangan muncul lagi dengan "menikah kembali"; mengetuknya memilih orang yang sama', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const ulang = document.querySelector('[data-orang-ulang="eka"]')
    expect(ulang).toBeTruthy()
    expect(ulang.getAttribute('aria-label')).toBe('Istri ke-1: Eka (menikah kembali)')
    expect(screen.getByText('menikah kembali')).toBeTruthy()
    await aksi.click(ulang)
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Eka', level: 2 })).toBeTruthy()
  })

  it('nomor urut kecil di pojok kartu anak kandung; anak sambung/angkat tanpa nomor', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('mega').querySelector('.kartu-urut').textContent).toBe('6')
    expect(k('mega').textContent).toContain('Putri ke-6') // untuk pembaca layar
    expect(k('rangga').querySelector('.kartu-urut').textContent).toBe('11')
    expect(k('wati').querySelector('.kartu-urut').textContent).toBe('1')
    for (const id of ['vino', 'yoga', 'raksa', 'eka']) expect(k(id).querySelector('.kartu-urut'), id).toBeNull()
    // Pojok berbeda dari GEN.n (kelas dan letak sendiri).
    expect(k('mega').querySelector('.kartu-gen').textContent).toBe('GEN.2')
  })

  it('tunas daun di pojok kartu anak di bawah umur; tidak untuk yang dewasa atau tanpa tanggal lahir', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const id of ['bayu', 'nala', 'hasna']) expect(k(id).querySelector('[data-tunas]'), id).toBeTruthy()
    for (const id of ['bima', 'dorvi', 'sekar']) expect(k(id).querySelector('[data-tunas]'), id).toBeNull()
    const legenda = screen.getByRole('region', { name: 'Keterangan warna' })
    expect(within(legenda).getByText('Belum dewasa (di bawah 18 tahun)')).toBeTruthy()
  })

  it('legenda "Jenis kelamin tidak diketahui" hanya selama masih ada yang belum diketahui', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(within(screen.getByRole('region', { name: 'Keterangan warna' })).getByText('Jenis kelamin tidak diketahui')).toBeTruthy()
  })

  it('setelah semua jenis kelamin diisi, baris legenda itu hilang sendiri', async () => {
    const lengkap = tabelKeluarga()
    for (const p of lengkap.people) if (!p.sex) p.sex = 'L'
    pasang('/bagan', klienKeluarga({ tabel: lengkap }))
    await tunggu()
    expect(within(screen.getByRole('region', { name: 'Keterangan warna' })).queryByText('Jenis kelamin tidak diketahui')).toBeNull()
    expect(keluargaFiktif.people.some((p) => !p.sex)).toBe(true) // data asal tidak berubah
  })

  it('kartu tidak memuat tahun atau "Anak ke-n"; kartu pasangan: simbol, nama, dan label "Pasangan" tanpa GEN', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const kartu of semuaKartu()) {
      expect(kartu.textContent, kartu.dataset.orang).not.toMatch(/\d{4}|anak ke-|pasangan dari|dari istri|dari suami/i)
    }
    for (const id of ['eka', 'fitri', 'gita', 'umar', 'sinta', 'laila']) {
      expect(k(id).querySelector('.kartu-label').textContent, id).toBe('Pasangan')
      expect(k(id).querySelectorAll('.kartu-label'), id).toHaveLength(1)
      expect(k(id).querySelector('.kartu-gen'), id).toBeNull()
      expect(k(id).querySelector('.kartu-simbol')).toBeTruthy()
    }
  })

  it('pernikahan antarsepupu: anak tampil sekali', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.querySelectorAll('[data-orang="hasna"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-orang="nirvo"]')).toHaveLength(1)
  })


  it('pohon keluarga asal tidak muncul di bagan', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('karto')).toBeNull()
  })

  it('struktur daftar bersarang (pembaca layar) dan semua kartu bernama', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.querySelectorAll('[role="group"] ul ul').length).toBeGreaterThan(3)
    expect(screen.getByRole('list', { name: 'Anak Bima dan Gita' })).toBeTruthy()
    for (const k of semuaKartu()) expect(k.textContent.trim()).not.toBe('')
  })

  it('warna kartu: keturunan, pasangan, pangkal (lengkap dengan tanda wafat)', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('bima').dataset.warna).toBe('keturunan-l')
    expect(k('cahya').dataset.warna).toBe('keturunan-p')
    expect(k('umar').dataset.warna).toBe('pasangan-l')
    expect(k('eka').dataset.warna).toBe('pasangan-p')
    expect(k('raksa').dataset.warna).toBe('pangkal')
    expect(k('raksa').dataset.wafat).toBe('true')
    const legenda = screen.getByRole('region', { name: 'Keterangan warna' })
    for (const nama of ['Keturunan laki-laki', 'Keturunan perempuan', 'Pasangan laki-laki', 'Pasangan perempuan', 'Pangkal', 'Wafat (keturunan)', 'Wafat (pasangan)', 'Berpisah']) {
      expect(within(legenda).getByText(nama)).toBeTruthy()
    }
  })

  it('ikon hati untuk setiap pasangan dan garis berpisah putus-putus', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.querySelector('[data-hati="h:cahya:0"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-hati^="h:bima:"]')).toHaveLength(4)
    // Hati patah hanya untuk pernikahan yang berakhir karena berpisah; ditinggal wafat tetap utuh.
    expect([...document.querySelectorAll('[data-hati^="h:bima:"]')].map((h) => Boolean(h.dataset.patah))).toEqual([true, true, true, false])
    expect(document.querySelector('[data-hati="h:tirwan:0"]').dataset.patah).toBeUndefined()
    expect(document.querySelectorAll('path[data-putus]').length).toBeGreaterThan(0)
    for (const p of document.querySelectorAll('path[data-putus]')) expect(p.getAttribute('data-garis')).toBe('nikah')
    // pembaca layar tetap mendengar bahwa pernikahan itu berakhir karena berpisah
    expect(screen.getAllByText(/^Pasangan Bima \(berpisah\)/)).toHaveLength(3)
    expect(document.body.textContent).not.toMatch(/cerai/i)
  })
})

describe('Bagan: pernikahan antarsepupu', () => {
  const rujukan = (id) => [...document.querySelectorAll(`[data-rujukan="${id}"]`)]

  it('pasangan yang juga keturunan tampil sebagai kartu rujukan berwarna keturunan, dihubungkan hati', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    // Rangga (GEN.2) ♥ Gendis (GEN.3), juga Tamran ♥ Wati: masing-masing satu kartu utama dan satu rujukan.
    for (const id of ['gendis', 'rangga', 'tamran', 'wati']) {
      expect(document.querySelectorAll(`[data-orang="${id}"]`), id).toHaveLength(1)
      expect(rujukan(id), id).toHaveLength(1)
    }
    const gendis = rujukan('gendis')[0]
    expect(gendis.dataset.warna).toBe('keturunan-p')
    expect(gendis.textContent).toContain('Dari cabang lain')
    expect(gendis.textContent).not.toContain('GEN')
    expect(gendis.getAttribute('aria-label')).toBe('Gendis, keturunan dari cabang lain. Ketuk untuk ke kartu utamanya.')
    expect(document.querySelector('[data-hati="h:rangga:0"]')).toBeTruthy()
  })

  it('anak mereka tampil sekali, dengan garis dari hati pasangan itu; di cabang lain ada catatan', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.querySelectorAll('path[data-garis="anak"]').length).toBeGreaterThan(10)
    expect(screen.getByRole('list', { name: 'Anak Rangga dan Gendis' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anak mereka ada di cabang Rangga' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anak mereka ada di cabang Tamran' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Anak Gendis dan Rangga' })).toBeNull()
  })

  it('mengetuk kartu rujukan melompat ke kartu utamanya (terpilih, panel terbuka)', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(rujukan('gendis')[0])
    expect(k('gendis').getAttribute('aria-pressed')).toBe('true')
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Gendis' })).toBeTruthy()
  })

  it('mengetuk catatan "Anak mereka ada di cabang …" memilih orang tua di cabang itu', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Tamran' }))
    expect(k('tamran').getAttribute('aria-pressed')).toBe('true')
  })

  it('anak antarsepupu SELALU di bawah pihak laki-laki, juga kalau jalur ibu lebih dekat ke pangkal; GEN ikut ayah', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    // Arum (GEN.2, ibu) ♥ Dorvi (GEN.3, ayah): Bintang GEN.4 · Canggah, di bawah Dorvi.
    expect(screen.getByRole('list', { name: 'Anak Dorvi, S.Kom. dan Arum' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Anak Arum dan Dorvi, S.Kom.' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Anak mereka ada di cabang Dorvi, S.Kom.' })).toBeTruthy()
    expect(k('bintang').querySelector('.kartu-gen').textContent).toBe('GEN.4')
    expect(k('bintang').querySelector('.kartu-label').textContent).toBe('Canggah')
  })

  it('dari cabang yang difokuskan: kartu utama di luar cabang → seluruh bagan ditampilkan lagi', async () => {
    const { aksi } = pasang('/bagan?fokus=kelvan', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Kelvan')).toBeTruthy()
    expect(k('rangga')).toBeNull()
    await aksi.click(rujukan('rangga')[0])
    expect(screen.queryByText(/Menampilkan satu cabang/)).toBeNull()
    expect(k('rangga').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Bagan: bilah atas dan legenda', () => {
  it('bilah atas: judul, status, cari, perbesar/perkecil, Pusatkan; bisa disembunyikan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(screen.getByText('Arsip Warisan & Sejarah')).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Cari nama' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pusatkan' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lihat seluruh bagan' })).toBeTruthy()
    // fitur yang belum ada tidak ditampilkan
    expect(screen.queryByRole('button', { name: /Tambah Anggota|Unduh PDF/i })).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Sembunyikan menu bagan' }))
    expect(screen.queryByRole('searchbox')).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Tampilkan menu bagan' }))
    expect(screen.getByRole('searchbox', { name: 'Cari nama' })).toBeTruthy()
  })

  it('cari nama: kartu yang cocok terpilih; Cari lagi ke hasil berikutnya', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(screen.getByRole('searchbox', { name: 'Cari nama' }), 'ga{Enter}')
    // "ga" cocok dengan beberapa nama (Mega, Rangga, Yoga)
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    const pertama = within(panel).getByRole('heading', { level: 2 }).textContent
    await aksi.click(screen.getByRole('button', { name: 'Cari nama' }))
    const kedua = within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('heading', { level: 2 }).textContent
    expect(kedua).not.toBe(pertama)
    expect(screen.getByText(/^2 dari \d+: /)).toBeTruthy()
  })

  it('cari nama yang tidak ada: pesan jelas', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(screen.getByRole('searchbox', { name: 'Cari nama' }), 'zzz{Enter}')
    expect(screen.getByText('Tidak ada nama yang cocok.')).toBeTruthy()
  })

  it('legenda di kiri bawah bisa ditutup dan dibuka lagi', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const legenda = screen.getByRole('region', { name: 'Keterangan warna' })
    expect(within(legenda).getByText('Berpisah')).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Sembunyikan keterangan' }))
    expect(screen.queryByRole('region', { name: 'Keterangan warna' })).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Tampilkan keterangan warna' }))
    expect(screen.getByRole('region', { name: 'Keterangan warna' })).toBeTruthy()
  })
})

describe('Bagan: ketuk kartu dan fokus cabang', () => {
  it('ketuk kartu → panel keterangan (format aplikasi lama); tombol Tutup menutup', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('cahya'))
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Cahya', level: 2 })).toBeTruthy()
    expect(within(panel).getByText('Anak · Generasi ke-1')).toBeTruthy()
    expect(within(panel).getByRole('heading', { name: 'Keterangan Pribadi' })).toBeTruthy()
    expect(within(panel).getByRole('heading', { name: 'Riwayat Hidup' })).toBeTruthy()
    expect(panel.textContent).toContain('Menikah tahun 1974')
    expect(panel.textContent).not.toMatch(/Nomor silsilah|No\. \d/)
    for (const kartu of semuaKartu()) expect(kartu.textContent).not.toMatch(/\b1\.\d+/)
    await aksi.click(within(panel).getByRole('button', { name: 'Tutup' }))
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
  })

  it('di panel, nama orang tua/pasangan/anak bisa diketuk: kartunya terpilih', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('cahya'))
    await aksi.click(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('button', { name: 'Wati' }))
    expect(k('wati').getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('heading', { name: 'Wati', level: 2 })).toBeTruthy()
  })

  it('panel anak sambung dan anak angkat: orang tua sambung/angkat tetap tertulis dan bisa diketuk', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('vino'))
    let panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(panel.textContent).toContain('Orang tua: Umar & Cahya (ibu sambung)')
    expect(panel.textContent).toContain('Anak sambung Cahya')
    await aksi.click(k('yoga'))
    panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(panel.textContent).toContain('Orang tua angkat: Lorvan & Sinta')
    expect(panel.textContent).toContain('Anak angkat Lorvan & Sinta')
    await aksi.click(within(panel).getByRole('button', { name: 'Sinta' }))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('heading', { name: 'Sinta', level: 2 })).toBeTruthy()
  })

  it('fokus cabang: hanya orang itu dan keturunannya; "Tampilkan semua" mengembalikan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const semua = semuaKartu().length
    await aksi.click(k('lorvan'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari pangkal utama' }))
    expect(screen.getByText('Menampilkan satu cabang: Lorvan')).toBeTruthy()
    expect(k('kelvan').querySelector('.kartu-gen').textContent).toBe('GEN.2') // tetap dari pangkal utama
    expect(screen.queryByText(/Generasi dihitung dari/)).toBeNull()
    expect(k('cahya')).toBeNull()
    expect(k('hasna')).toBeNull() // cabang Bima
    expect(k('kelvan')).toBeTruthy()
    expect(k('gendis')).toBeTruthy()
    expect(semuaKartu().length).toBeLessThan(semua)
    await aksi.click(screen.getByRole('button', { name: 'Tampilkan semua' }))
    expect(semuaKartu().length).toBe(semua)
  })

  it('di cabang, "Naik ke …" ke cabang orang tuanya', async () => {
    const { aksi } = pasang('/bagan?fokus=gendis', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Gendis')).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Naik ke Kelvan' }))
    expect(screen.getByText('Menampilkan satu cabang: Kelvan')).toBeTruthy()
  })

  it('pasangan yang bukan keturunan: fokus ke cabang pasangannya', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('sinta'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Lorvan' }))
    expect(screen.getByText('Menampilkan satu cabang: Lorvan')).toBeTruthy()
  })

  it('"Hitung dari [nama]": orang itu PANGKAL CABANG GEN.0, keturunannya dihitung ulang, dengan pita keterangan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('bima'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    expect(screen.getByRole('button', { name: 'Hitung dari pangkal utama' })).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Bima' }))
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Pangkal cabang')
    expect(k('bima').querySelector('.kartu-gen').textContent).toBe('GEN.0')
    expect(k('mega').querySelector('.kartu-label').textContent).toBe('Anak')
    expect(k('mega').querySelector('.kartu-gen').textContent).toBe('GEN.1')
    expect(k('hasna').querySelector('.kartu-label').textContent).toBe('Putu')
    expect(screen.getByText('Generasi dihitung dari Bima')).toBeTruthy()
    // Panel ikut dihitung ulang.
    await aksi.click(k('mega'))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByText('Anak · Generasi ke-1')).toBeTruthy()
    // Kembali ke pangkal utama: tetap di cabang yang sama, GEN seperti biasa.
    await aksi.click(screen.getByRole('button', { name: 'Kembali ke pangkal utama' }))
    expect(screen.queryByText('Generasi dihitung dari Bima')).toBeNull()
    expect(screen.getByText('Menampilkan satu cabang: Bima')).toBeTruthy()
    expect(k('mega').querySelector('.kartu-gen').textContent).toBe('GEN.2')
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Anak')
  })

  it('dibuka langsung dari alamat (?fokus=…&hitung=cabang)', async () => {
    pasang('/bagan?fokus=kelvan&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Kelvan')).toBeTruthy()
    expect(k('gendis').querySelector('.kartu-gen').textContent).toBe('GEN.1')
  })

  it('"hitung=cabang" tanpa fokus diabaikan', async () => {
    pasang('/bagan?hitung=cabang', klienKeluarga())
    await tunggu()
    expect(screen.queryByText(/Generasi dihitung dari/)).toBeNull()
  })

  it('dibuka dari Detail ("Lihat di bagan"): kartu itu sudah terpilih', async () => {
    const { aksi } = pasang('/orang/mega', klienKeluarga())
    await aksi.click(await screen.findByRole('link', { name: 'Lihat di bagan' }))
    const panel = await screen.findByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Mega' })).toBeTruthy()
    expect(k('mega').getAttribute('aria-pressed')).toBe('true')
  })

  it('parameter fokus yang tidak dikenal diabaikan (bagan penuh)', async () => {
    pasang('/bagan?fokus=tidak-ada', klienKeluarga())
    expect(await tunggu()).toBeTruthy()
  })
})

describe('Bagan: geser dan zoom', () => {
  const jari = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, pointerType: 'touch', isPrimary: id === 1 })

  it('tombol Perbesar dan Perkecil mengubah skala', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(transform()).toContain('scale(1)')
    await aksi.click(screen.getByRole('button', { name: 'Perbesar' }))
    expect(transform()).toContain('scale(1.25)')
    await aksi.click(screen.getByRole('button', { name: 'Perkecil' }))
    await aksi.click(screen.getByRole('button', { name: 'Perkecil' }))
    expect(transform()).toContain('scale(0.8)')
  })

  it('satu jari menyeret: bagan bergeser', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    const bingkai = screen.getByRole('group', { name: /Bagan silsilah/ })
    fireEvent.pointerDown(bingkai, jari(1, 100, 100))
    fireEvent.pointerMove(bingkai, jari(1, 140, 130))
    fireEvent.pointerUp(bingkai, jari(1, 140, 130))
    expect(transform()).toContain('translate(40px, 30px)')
  })

  it('dua jari menjauh: memperbesar; mendekat: memperkecil', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    const bingkai = screen.getByRole('group', { name: /Bagan silsilah/ })
    fireEvent.pointerDown(bingkai, jari(1, 100, 100))
    fireEvent.pointerDown(bingkai, jari(2, 200, 100))
    fireEvent.pointerMove(bingkai, jari(2, 300, 100)) // jarak 100 → 200
    const skala = (t) => Number(/scale\(([\d.]+)\)/.exec(t)[1])
    expect(skala(transform())).toBeCloseTo(2)
    fireEvent.pointerMove(bingkai, jari(2, 250, 100)) // jarak 200 → 150
    expect(skala(transform())).toBeCloseTo(1.5)
    fireEvent.pointerUp(bingkai, jari(2, 250, 100))
    fireEvent.pointerUp(bingkai, jari(1, 100, 100))
  })

  it('ketukan sesudah menyeret tidak membuka kartu; ketukan biasa membuka', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const mega = k('mega')
    const bingkai = screen.getByRole('group', { name: /Bagan silsilah/ })
    fireEvent.pointerDown(mega, jari(1, 100, 100))
    fireEvent.pointerMove(mega, jari(1, 160, 100))
    fireEvent.pointerUp(mega, jari(1, 160, 100))
    fireEvent.click(mega)
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
    await new Promise((r) => setTimeout(r, 80))
    // ketukan biasa (gerak < 6px)
    fireEvent.pointerDown(mega, jari(1, 100, 100))
    fireEvent.pointerMove(mega, jari(1, 102, 101))
    fireEvent.pointerUp(mega, jari(1, 102, 101))
    await aksi.click(mega)
    expect(screen.getByRole('region', { name: 'Orang terpilih' })).toBeTruthy()
    expect(bingkai).toBeTruthy()
  })

  it('papan ketik: panah menggeser, + dan − memperbesar/memperkecil', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const bingkai = screen.getByRole('group', { name: /Bagan silsilah/ })
    bingkai.focus()
    await aksi.keyboard('{ArrowLeft}')
    expect(transform()).toContain('translate(80px, 0px)')
    await aksi.keyboard('+')
    expect(transform()).toContain('scale(1.25)')
    await aksi.keyboard('-')
    expect(transform()).toContain('scale(1)')
  })

  it('bingkai punya petunjuk papan ketik dan bisa difokuskan', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    const bingkai = screen.getByRole('group', { name: /tombol panah/ })
    expect(bingkai.tabIndex).toBe(0)
  })
})

describe('Bagan: ukuran huruf dan kontras', () => {
  const sumber = ['components/bagan/KartuOrang.jsx', 'components/bagan/GambarBagan.jsx', 'components/bagan/Legenda.jsx', 'pages/Bagan.jsx']
    .map((f) => fs.readFileSync(path.join(import.meta.dirname, '..', f), 'utf8'))
    .join('\n')

  it('ukuran huruf hanya dari satuan rem/kelas Tailwind (ikut pengaturan Saya)', () => {
    expect(sumber).not.toMatch(/font-?size|text-\[\d+px\]/i)
  })
  it('warna hanya dari token tema (ikut kontras tinggi)', () => {
    expect(sumber).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|bg-(white|black|gray|slate|zinc|neutral)|text-(white|black|gray|slate)|border-(white|black|gray|slate)/i)
  })
  it('garis penghubung dan hati memakai warna tema', () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8')
    expect(css).toMatch(/\.bagan-garis-anak\s*\{\s*stroke:\s*var\(--c-garis-bagan\)/)
    expect(css).toMatch(/\.bagan-garis-nikah\s*\{\s*stroke:\s*var\(--c-hati\)/)
  })
})
