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
import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { lokasiSaatIni, pasang, riwayat } from '../test/pembantu.jsx'
import { keluargaFiktif, klienKeluarga, tabelKeluarga } from '../test/klienKeluarga.js'
import { cariOrang } from '../lib/silsilah/cari.js'
import { namaTampil } from '../lib/silsilah/nama.js'
import { BERAT } from '../test/batasWaktu.js'

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
// Baris orang tua di panel, masing-masing persis seperti tampil.
const barisOrangTua = (panel) =>
  [...panel.querySelectorAll('dl > div')]
    .map((b) => b.textContent)
    .filter((t) => /^(Orang tua|Ayah sambung|Ibu sambung|Orang tua sambung|Orang tua angkat):/.test(t))

describe('Bagan: isi kartu', () => {
  it('kartu keturunan: GEN di pojok, nama, dan istilah Jawa', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await screen.findByRole('heading', { name: 'Silsilah Keluarga', level: 1 })
    await tunggu()
    const mega = k('mega')
    expect(mega.querySelector('.kartu-gen').textContent).toBe('GEN.2')
    expect(mega.querySelector('.kartu-nama').textContent).toBe('Mega')
    expect(mega.querySelector('.kartu-label').textContent).toBe('Putu')
  })

  // Putaran 7b, bagian B: ukuran TERBESAR yang muat (menggantikan ukuran menurut jumlah kata).
  it('ukuran nama: yang terbesar yang muat; tanpa gelar paling banyak 2 baris, bergelar 3; gelar menempel; nama selalu utuh', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    const nama = (id) => k(id).querySelector('.kartu-nama')
    const ukuran = (id) => nama(id).dataset.ukuran
    for (const id of ['ratrisa-k', 'sadevan-a', 'ayundra', 'mega', 'tirwan', 'dorvi', 'halvin', 'sadevan-b', 'bagaskara', 'selvarani']) expect(ukuran(id), id).toBe('besar')
    // Tanpa gelar: dua baris pun tidak muat pada ukuran besar, jadi sedang.
    expect(ukuran('ratrisa-a')).toBe('sedang')
    // Gelar terpisah; teksnya tetap utuh.
    const bagas = nama('bagaskara')
    expect(bagas.textContent).toBe('Alm. H. Bagaskara Wiryawan Adinata Mahardika, S.H.')
    expect([...bagas.querySelectorAll('.kartu-gelar')].map((g) => g.textContent)).toEqual(['Alm. H. ', ', S.H.'])
    const baris = (id) => [...nama(id).querySelectorAll('.kartu-nama-baris')].map((b) => b.textContent.trim())
    expect(baris('bagaskara')).toEqual(['Alm. H. Bagaskara', 'Wiryawan Adinata', 'Mahardika, S.H.'])
    expect(baris('selvarani')).toEqual(['Hj. Selvarani', 'Kusumaningtyas', 'Prameswari, S.Pd.'])
    expect(baris('sadevan-b')).toEqual(['Sadevan Bramasta', 'Wiratmaja, S.T.'])
    expect(baris('ratrisa-a')).toEqual(['Ratrisa Anindya', 'Maharsi Wijayakusuma'])
    expect(baris('ratrisa-k')).toEqual(['Ratrisa Kemuntari'])
    expect(baris('mega')).toEqual(['Mega'])
    for (const kartu of semuaKartu()) {
      const unsur = kartu.querySelector('.kartu-nama')
      const bergelar = unsur.querySelector('.kartu-gelar') !== null
      expect(unsur.querySelectorAll('.kartu-nama-baris').length, kartu.dataset.orang).toBeLessThanOrEqual(bergelar ? 3 : 2)
    }
    // Ukuran huruf dari tingkat yang dipakai (pilihan A).
    const rem = (id) => nama(id).style.getPropertyValue('--ukuran-nama')
    expect([rem('mega'), rem('bagaskara'), rem('ratrisa-a')]).toEqual(['0.85rem', '0.85rem', '0.75rem'])
  })

  it('nama tidak pernah dipotong: tanpa line-clamp, tanpa overflow tersembunyi, tanpa ellipsis pada nama; huruf Lora tebal sedang, huruf besar-kecil', () => {
    const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8')
    const aturanNama = [...css.matchAll(/\.kartu-(nama|nama-baris|nama-utuh|gelar)[^{]*\{([^}]*)\}/g)].map((m) => m[2]).join('\n')
    expect(aturanNama).not.toMatch(/line-clamp|overflow:\s*hidden|text-overflow/)
    expect(aturanNama).not.toMatch(/text-transform:\s*uppercase/)
    expect(css).toMatch(/@import '@fontsource\/lora\/600\.css'/)
    expect(css).toMatch(/--font-nama: 'Lora'/)
    expect(css).toMatch(/\.kartu-nama \{[^}]*font-family: var\(--font-nama\);[^}]*font-weight: 600;[^}]*font-size: var\(--ukuran-nama, 0\.85rem\);/)
    // Gelar: Plus Jakarta Sans, lebih kecil dan tipis.
    expect(css).toMatch(/\.kartu-gelar \{[^}]*font-family: var\(--font-sans\);[^}]*font-weight: 400;[^}]*font-size: calc\(var\(--skala-gelar, 0\.8\) \* 1em\);/)
    expect(css).not.toMatch(/https?:\/\/fonts|googleapis/)
  })

  it('kartu pangkal: nama dengan Alm./Almh. dan label "Leluhur"', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('raksa').textContent).toContain('Alm. Raksa')
    expect(k('raksa').textContent).toContain('Leluhur')
    expect(k('selara').textContent).toContain('Almh. Selara')
    expect(k('selara').textContent).toContain('Leluhur')
  })

  it('anak sambung/angkat tampil sama persis dengan saudaranya, tanpa label khusus', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(document.body.textContent).not.toMatch(/\bsambung\b|\bangkat\b/i)
    expect(k('yoga').querySelector('.kartu-label').textContent).toBe('Putu')
    // Vino (anak bawaan Umar) tanpa istilah dan GEN (putaran keenam).
    expect(k('vino').querySelector('.kartu-label')).toBeNull()
  })

  it('anak bawaan pasangan dan keturunannya: kartu tanpa GEN dan istilah, panel tanpa baris generasi (putaran keenam)', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const id of ['galen', 'elvina', 'vino', 'sadevan-b', 'bagaskara']) {
      expect(k(id).querySelector('.kartu-gen'), id).toBeNull()
      expect(k(id).querySelector('.kartu-label'), id).toBeNull()
      expect(k(id).textContent, id).not.toMatch(/GEN|Anak|Putu|Buyut/)
    }
    for (const [id, label, gen] of [['celvia', 'Buyut', 'GEN.3'], ['fajrin', 'Buyut', 'GEN.3'], ['yoga', 'Putu', 'GEN.2'], ['ratrisa-a', 'Buyut', 'GEN.3']]) {
      expect(k(id).querySelector('.kartu-label').textContent, id).toBe(label)
      expect(k(id).querySelector('.kartu-gen').textContent, id).toBe(gen)
    }
    await aksi.click(k('galen'))
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Galen', level: 2 })).toBeTruthy()
    expect(panel.textContent).not.toMatch(/Generasi ke-|GEN\./)
    await aksi.click(k('celvia'))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByText('Buyut · Generasi ke-3')).toBeTruthy()
  })

  it('pasangan yang bukan keturunan: tanpa GEN, dengan "Istri ke-n" di atas kartunya', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('eka').textContent).not.toContain('GEN')
    expect(screen.getAllByText('Istri ke-1')).toHaveLength(4) // Eka, Eka lagi (menikah kembali), istri ke-1 Qori, dan Wati (istri ke-1 Tamran)
    expect(screen.getByText('Istri ke-3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Istri ke-2: Fitri' })).toBe(k('fitri'))
  })

  it('pernikahan kembali: kartu pasangan muncul lagi dengan "menikah kembali"; mengetuknya memilih orang yang sama', BERAT, async () => {
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

  it('nomor urut kecil di pojok kartu anak kandung; anak sambung/angkat tanpa nomor', BERAT, async () => {
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

  it('tunas daun di pojok kartu anak di bawah umur; tidak untuk yang dewasa atau tanpa tanggal lahir', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const id of ['bayu', 'nala', 'hasna']) expect(k(id).querySelector('[data-tunas]'), id).toBeTruthy()
    for (const id of ['bima', 'dorvi', 'sekar']) expect(k(id).querySelector('[data-tunas]'), id).toBeNull()
    const legenda = screen.getByRole('region', { name: 'Keterangan warna' })
    expect(within(legenda).getByText('Belum dewasa (di bawah 18 tahun)')).toBeTruthy()
  })

  it('legenda "Jenis kelamin tidak diketahui" hanya selama masih ada yang belum diketahui', BERAT, async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(within(screen.getByRole('region', { name: 'Keterangan warna' })).getByText('Jenis kelamin tidak diketahui')).toBeTruthy()
  })

  it('setelah semua jenis kelamin diisi, baris legenda itu hilang sendiri', BERAT, async () => {
    const lengkap = tabelKeluarga()
    for (const p of lengkap.people) if (!p.sex) p.sex = 'L'
    pasang('/bagan', klienKeluarga({ tabel: lengkap }))
    await tunggu()
    expect(within(screen.getByRole('region', { name: 'Keterangan warna' })).queryByText('Jenis kelamin tidak diketahui')).toBeNull()
    expect(keluargaFiktif.people.some((p) => !p.sex)).toBe(true) // data asal tidak berubah
  })

  it('kartu tidak memuat tahun atau "Anak ke-n"; kartu pasangan: simbol, nama, dan label "Pasangan" tanpa GEN', BERAT, async () => {
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
    for (const nama of ['Keturunan laki-laki', 'Keturunan perempuan', 'Pasangan laki-laki', 'Pasangan perempuan', 'Leluhur', 'Wafat (keturunan)', 'Wafat (pasangan)', 'Berpisah']) {
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

  const sorotan = () => [...document.querySelectorAll('[data-sorot]')].map((x) => x.dataset.orang)
  // Putaran 7b, bagian A: seperti memilih hasil pencarian, juga tanpa fokus.
  it('mengetuk catatan "Anak mereka ada di cabang …" menyorot anak-anak pasangan itu, tanpa memilih kartu orang tuanya dan tanpa panel', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Tamran' }))
    expect(sorotan()).toEqual(['nirvo'])
    expect(k('tamran').getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector('[aria-pressed="true"]')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
    expect(lokasiSaatIni.search).toBe('')
  })

  it('catatan "Anak mereka ada di cabang …": SEMUA anak pasangan itu disorot, di bagan lengkap dan saat fokus', BERAT, async () => {
    // Adik Nirvo hanya di tes ini (data contoh tidak diubah).
    const tabel = tabelKeluarga()
    const nirvo = tabel.people.find((p) => p.id === 'nirvo')
    tabel.people.push({ ...nirvo, id: 'nirvo-2', full_name: 'Nirvana', birth_y: 2001 })
    tabel.children.push({ ...tabel.children.find((c) => c.child_id === 'nirvo'), id: 'c-u9-nirvo-2', child_id: 'nirvo-2' })
    const { aksi } = pasang('/bagan', klienKeluarga({ tabel }))
    await tunggu()
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Tamran' }))
    expect(sorotan().sort()).toEqual(['nirvo', 'nirvo-2'])
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
  })

  it('anak antarsepupu SELALU di bawah pihak laki-laki, juga kalau jalur ibu lebih dekat ke pangkal; GEN ikut ayah', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    // Arum (GEN.2, ibu) ♥ Dorvi (GEN.3, ayah): Bintang GEN.4 · Canggah, di bawah Dorvi.
    expect(screen.getByRole('list', { name: 'Anak Dorvi, S.Kom. dan Arum' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Anak Arum dan Dorvi, S.Kom.' })).toBeNull()
    // Nama di tautan ditulis singkat tanpa gelar (putaran ketujuh).
    expect(screen.getByRole('button', { name: 'Anak mereka ada di cabang Dorvi' })).toBeTruthy()
    expect(k('bintang').querySelector('.kartu-gen').textContent).toBe('GEN.4')
    expect(k('bintang').querySelector('.kartu-label').textContent).toBe('Canggah')
  })

  // Putaran ketujuh, bagian 3: fokus terisolasi.
  it('saat fokus: kartu "Dari cabang lain" tanpa ↗; mengetuknya hanya membuka panelnya, tetap di cabang', async () => {
    const { aksi } = pasang('/bagan?fokus=kelvan', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Kelvan')).toBeTruthy()
    expect(k('rangga')).toBeNull()
    const kartuRangga = rujukan('rangga')[0]
    expect(kartuRangga.textContent).toContain('Dari cabang lain')
    expect(kartuRangga.textContent).not.toContain('↗')
    expect(document.body.textContent).not.toContain('↗')
    expect(kartuRangga.getAttribute('aria-label')).toBe('Rangga, keturunan dari cabang lain. Ketuk untuk melihat keterangannya.')
    await aksi.click(kartuRangga)
    expect(screen.getByText('Menampilkan satu cabang: Kelvan')).toBeTruthy()
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getByRole('heading', { name: 'Rangga' })).toBeTruthy()
    // Orang tuanya di luar cabang: tertulis, tetapi tidak bisa diketuk; tanpa "Fokus pada cabang ini".
    expect(barisOrangTua(panel)).toEqual(['Orang tua: Bima & Gita'])
    expect(within(panel).queryByRole('button', { name: 'Bima' })).toBeNull()
    expect(within(panel).queryByRole('button', { name: 'Fokus pada cabang ini' })).toBeNull()
    // Anaknya (di cabang ini) tetap bisa diketuk.
    await aksi.click(within(panel).getByRole('button', { name: 'Hasna' }))
    expect(k('hasna').getAttribute('aria-pressed')).toBe('true')
  })

  it('saat fokus: catatan "Anak mereka ada di cabang …" yang tujuannya di luar cabang tidak ada, juga tombol ke luar cabang', async () => {
    pasang('/bagan?fokus=cahya', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Cahya')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Anak mereka ada di cabang/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Naik ke/ })).toBeNull()
    expect(document.querySelector('[data-catatan]')).toBeNull()
  })

  it('saat fokus: catatan "Anak mereka ada di cabang …" yang tujuannya di dalam cabang tetap ada; mengetuknya menggeser bagan ke anak-anak itu dan menyorotnya, tetap di fokus', async () => {
    const { aksi } = pasang('/bagan?fokus=raksa', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Alm. Raksa')).toBeTruthy()
    for (const nama of ['Tamran', 'Rangga', 'Dorvi']) expect(screen.getByRole('button', { name: `Anak mereka ada di cabang ${nama}` })).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Tamran' }))
    expect(sorotan()).toEqual(['nirvo'])
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
    expect(screen.getByText('Menampilkan satu cabang: Alm. Raksa')).toBeTruthy()
    expect(lokasiSaatIni.search).toBe('?fokus=raksa')
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Rangga' }))
    expect(sorotan()).toEqual(['hasna'])
  })

  it('tanpa fokus: catatan "Anak mereka ada di cabang …" sama seperti saat fokus (sorot anak-anaknya, kartu orang tua tidak dipilih)', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(screen.getByRole('button', { name: 'Anak mereka ada di cabang Rangga' }))
    expect(k('rangga').getAttribute('aria-pressed')).toBe('false')
    expect(sorotan()).toEqual(['hasna'])
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
  })

  it('saat fokus: di panel, nama di luar cabang hanya teks biasa', async () => {
    const { aksi } = pasang('/bagan?fokus=wati', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Wati')).toBeTruthy()
    await aksi.click(k('wati'))
    const panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(barisOrangTua(panel)).toEqual(['Orang tua: Umar & Cahya'])
    expect(within(panel).queryByRole('button', { name: 'Cahya' })).toBeNull()
    expect(panel.querySelector('[data-luar-cabang="cahya"]').textContent).toBe('Cahya')
    // Pasangan dan anak di cabang ini tetap bisa diketuk.
    await aksi.click(within(panel).getByRole('button', { name: 'Nirvo' }))
    expect(k('nirvo').getAttribute('aria-pressed')).toBe('true')
  })
})

// Putaran kelima, bagian C: daftar hasil langsung saat mengetik, keterangan
// pembeda, Enter berputar, papan ketik, tanpa jaringan.
describe('Bagan: pencarian dengan daftar hasil', () => {
  const kolom = () => screen.getByRole('combobox', { name: 'Cari nama' })
  const hasil = () => within(screen.getByRole('listbox', { name: 'Hasil pencarian' })).getAllByRole('option')
  const namaHasil = () => hasil().map((o) => o.querySelector('span').textContent)
  const ketHasil = () => hasil().map((o) => o.querySelectorAll('span')[1].textContent)
  const status = () => document.getElementById('cari-status').textContent
  const disorot = () => [...document.querySelectorAll('[data-sorot]')].map((x) => x.dataset.orang)
  const terpilih = () => [...semuaKartu()].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.orang)

  // Aturan pencocokan tidak diubah (potongan huruf yang berurutan), jadi "ka"
  // TIDAK memuat Kirana dan Raksa (keputusan Anda, putaran kelima); keduanya
  // ketemu lewat "kir" dan "rak".
  it('"ka": daftar langsung muncul saat mengetik dan memuat SEMUA yang cocok (Eka, Ika, Oka, Almh. Sekar, …)', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'ka')
    expect(kolom().getAttribute('aria-expanded')).toBe('true')
    for (const nama of ['Eka', 'Ika', 'Oka', 'Almh. Sekar', 'Alm. H. Bagaskara Wiryawan Adinata Mahardika, S.H.', 'Sadevan Arkanata']) expect(namaHasil(), nama).toContain(nama)
    expect(namaHasil()).not.toContain('Kirana')
    // Semua orang silsilah utama yang namanya/panggilannya cocok, tidak ada yang tertinggal.
    const utama = keluargaFiktif.people.filter((p) => p.tree_id === null)
    const harapan = cariOrang(utama.map((p) => ({ nama: namaTampil(p), panggilan: p.nickname })), 'ka').map((o) => o.nama)
    expect([...namaHasil()].sort()).toEqual([...harapan].sort())
    expect(status()).toBe(`${harapan.length} nama cocok. Pilih dari daftar, atau tekan Enter.`)
  })

  it('Kirana dan Raksa ketemu lewat potongan nama yang berurutan ("kir", "rak")', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'kir')
    expect(namaHasil()).toEqual(['Kirana'])
    await aksi.clear(kolom())
    await aksi.type(kolom(), 'rak')
    expect(namaHasil()).toEqual(['Alm. Raksa'])
  })

  it('"sadevan": dua hasil dengan keterangan pembeda "putra Vino" dan "putra Nanda"', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'sadevan')
    expect(hasil()).toHaveLength(2)
    const ket = ketHasil()
    expect(ket.some((k) => k.includes('putra Vino'))).toBe(true)
    expect(ket.some((k) => k.includes('putra Nanda'))).toBe(true)
    expect(ket[0]).not.toBe(ket[1])
  })

  it('"ratrisa": dua hasil, "istri Vino" dan "putri Yoga"', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'ratrisa')
    expect(hasil()).toHaveLength(2)
    expect(ketHasil().sort()).toEqual(['Buyut · putri Yoga & Selvarani · panggilan: Anin', 'istri Vino (putra Umar)'])
  })

  it('memilih hasil: kartunya disorot, daftar tertutup, panel tidak menutupi bagan; mengetuk kartu itu membuka panelnya', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('mega'))
    expect(screen.getByRole('region', { name: 'Orang terpilih' })).toBeTruthy()
    await aksi.type(kolom(), 'ratrisa')
    const putri = hasil().find((o) => o.textContent.includes('putri Yoga'))
    await aksi.click(putri)
    expect(disorot()).toEqual(['ratrisa-a'])
    expect(k('ratrisa-a').getAttribute('aria-current')).toBe('true')
    expect(screen.queryByRole('listbox')).toBeNull()
    // Panel orang lain (Mega) ditutup; panel tidak dibuka otomatis.
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
    expect(document.activeElement).toBe(kolom())
    await aksi.click(k('ratrisa-a'))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('heading', { level: 2 }).textContent).toBe('Ratrisa Anindya Maharsi Wijayakusuma')
    expect(disorot()).toEqual(['ratrisa-a'])
    expect(status()).toMatch(/^\d dari 2: Ratrisa Anindya Maharsi Wijayakusuma · Buyut · putri Yoga & Selvarani · panggilan: Anin$/)
  })

  it('Enter dan tombol cari berulang: "n dari m" berputar, sorotan ikut pindah, sesudah yang terakhir kembali ke "1 dari m"', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'ka')
    const m = hasil().length
    expect(m).toBeGreaterThan(3)
    const urutan = []
    for (let i = 1; i <= m + 1; i++) {
      if (i % 2) await aksi.keyboard('{Enter}')
      else await aksi.click(screen.getByRole('button', { name: 'Cari nama' }))
      expect(status(), `tekan ke-${i}`).toMatch(new RegExp(`^${i > m ? 1 : i} dari ${m}: `))
      expect(disorot(), `tekan ke-${i}`).toHaveLength(1)
      urutan.push(disorot()[0])
    }
    expect(new Set(urutan.slice(0, m)).size).toBe(m) // setiap hasil sekali
    expect(urutan[m]).toBe(urutan[0]) // kembali ke yang pertama
  })

  it('papan ketik: panah bawah/atas memilih di daftar (berputar), Enter memilihnya, Esc menutup lalu mengosongkan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'sadevan')
    const ids = hasil().map((o) => o.dataset.hasil)
    await aksi.keyboard('{ArrowDown}{ArrowDown}')
    expect(kolom().getAttribute('aria-activedescendant')).toBe('cari-hasil-1')
    expect(hasil()[1].getAttribute('aria-selected')).toBe('true')
    await aksi.keyboard('{ArrowDown}')
    expect(kolom().getAttribute('aria-activedescendant')).toBe('cari-hasil-0')
    await aksi.keyboard('{ArrowUp}')
    expect(kolom().getAttribute('aria-activedescendant')).toBe('cari-hasil-1')
    await aksi.keyboard('{Enter}')
    expect(disorot()).toEqual([ids[1]])
    expect(status()).toMatch(/^2 dari 2: /)
    // Daftar dibuka lagi dengan panah; Esc menutupnya, Esc berikutnya mengosongkan kolom dan sorotan.
    await aksi.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeTruthy()
    await aksi.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(kolom().value).toBe('sadevan')
    await aksi.keyboard('{Escape}')
    expect(kolom().value).toBe('')
    expect(disorot()).toEqual([])
    expect(status()).toBe('')
  })

  it('mengosongkan kolom: daftar dan sorotan hilang', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'sadevan{Enter}')
    expect(disorot()).toHaveLength(1)
    await aksi.clear(kolom())
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(disorot()).toEqual([])
    expect(screen.queryByRole('region', { name: 'Orang terpilih' })).toBeNull()
    expect(status()).toBe('')
  })

  it('kartu yang diketuk sendiri tetap terpilih walaupun kolom cari dikosongkan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'sad{Enter}')
    await aksi.click(k('mega'))
    await aksi.clear(kolom())
    expect(disorot()).toEqual([])
    expect(terpilih()).toEqual(['mega'])
  })

  // Putaran keenam, bagian D.
  // Putaran ketujuh, bagian 3: fokus terisolasi, pencarian hanya di cabang itu.
  it('saat fokus cabang: tidak ada yang cocok di cabang → hanya pesan tidak ditemukan', async () => {
    const { aksi } = pasang('/bagan?fokus=lorvan', klienKeluarga())
    await screen.findByText('Menampilkan satu cabang: Lorvan')
    await aksi.type(kolom(), 'sadevan')
    expect(screen.queryByRole('listbox', { name: 'Hasil pencarian' })).toBeNull()
    expect(status()).toBe('Nama ini tidak ditemukan di cabang Lorvan. Untuk mencari di seluruh silsilah, keluar dari fokus terlebih dahulu.')
    expect(screen.queryByText(/hasil lain di luar cabang/)).toBeNull()
    await aksi.keyboard('{Enter}')
    expect(screen.getByText('Menampilkan satu cabang: Lorvan')).toBeTruthy()
  })

  it('saat fokus cabang: hanya hasil di cabang, tanpa baris tambahan; Enter berputar di cabang saja', async () => {
    const { aksi } = pasang('/bagan?fokus=lorvan', klienKeluarga())
    await screen.findByText('Menampilkan satu cabang: Lorvan')
    await aksi.type(kolom(), 'ratrisa')
    expect(hasil().map((o) => o.dataset.hasil)).toEqual(['ratrisa-a'])
    expect(document.querySelector('[data-hasil-luar]')).toBeNull()
    await aksi.keyboard('{Enter}')
    expect(status()).toBe('1 dari 1: Ratrisa Anindya Maharsi Wijayakusuma · Buyut · putri Yoga & Selvarani · panggilan: Anin')
    await aksi.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(status()).toMatch(/^1 dari 1: /)
    expect(screen.getByText('Menampilkan satu cabang: Lorvan')).toBeTruthy()
  })

  it('saat fokus cabang: nama panggilan juga hanya di cabang itu', async () => {
    const { aksi } = pasang('/bagan?fokus=kirana', klienKeluarga())
    await screen.findByText('Menampilkan satu cabang: Kirana')
    await aksi.type(kolom(), 'ovi')
    expect(hasil().map((o) => o.dataset.hasil)).toEqual(['elvina'])
    await aksi.clear(kolom())
    await aksi.type(kolom(), 'abah') // Bima, di luar cabang Kirana
    expect(status()).toMatch(/^Nama ini tidak ditemukan di cabang Kirana\./)
  })

  it('"Hitung dari Lorvan": istilah generasi di hasil pencarian sama dengan di kartu (Ratrisa Anindya: Putu)', async () => {
    const { aksi } = pasang('/bagan?fokus=lorvan&hitung=cabang', klienKeluarga())
    await screen.findByText('Generasi dihitung dari Lorvan')
    expect(k('ratrisa-a').querySelector('.kartu-label').textContent).toBe('Putu')
    await aksi.type(kolom(), 'ratrisa')
    expect(hasil()[0].textContent).toContain('Putu')
    expect(hasil()[0].textContent).not.toContain('Buyut')
  })

  it('tanpa fokus cabang: tidak ada baris hasil lain', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(kolom(), 'sadevan')
    expect(hasil()).toHaveLength(2)
    expect(document.querySelector('[data-hasil-luar]')).toBeNull()
  })

  it('nama panggilan SELALU disebut kalau orangnya punya, apa pun yang diketik', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const kata of ['bram', 'sadevan']) {
      await aksi.clear(kolom())
      await aksi.type(kolom(), kata)
      const o = hasil().find((x) => x.dataset.hasil === 'sadevan-b')
      expect(o.textContent, kata).toBe('Sadevan Bramasta Wiratmaja, S.T.putra Vino & Ratrisa Kemuntari · panggilan: Bram')
    }
    // Tanpa panggilan: tanpa keterangan itu.
    expect(hasil().find((x) => x.dataset.hasil === 'sadevan-a').textContent).toBe('Sadevan ArkanataBuyut · putra Nanda & Ayundra')
    await aksi.keyboard('{Enter}{Enter}')
    expect(status()).toBe('2 dari 2: Sadevan Bramasta Wiratmaja, S.T. · putra Vino & Ratrisa Kemuntari · panggilan: Bram')
    for (const kata of ['anin', 'ratrisa']) {
      await aksi.clear(kolom())
      await aksi.type(kolom(), kata)
      expect(hasil().find((x) => x.dataset.hasil === 'ratrisa-a').textContent, kata).toContain('Buyut · putri Yoga & Selvarani · panggilan: Anin')
    }
    expect(hasil().find((x) => x.dataset.hasil === 'ratrisa-k').textContent).not.toMatch(/panggilan/)
  })

  it('tanpa jaringan dan tanpa data kontak: mengetik dan memilih tidak memanggil server sama sekali', BERAT, async () => {
    const klien = klienKeluarga()
    const { aksi } = pasang('/bagan', klien)
    await tunggu()
    const sebelum = klien.panggilan.length
    await aksi.type(kolom(), 'ka{Enter}{Enter}')
    await aksi.click(screen.getByRole('button', { name: 'Cari nama' }))
    await aksi.clear(kolom())
    await aksi.type(kolom(), 'ratrisa')
    await aksi.click(hasil()[0])
    expect(klien.panggilan.slice(sebelum)).toEqual([])
    expect(klien.panggilan.some((p) => /kontak|contact/i.test(`${p.nama}`))).toBe(false)
  })

  it('di HP: kolom cari selebar bilah, setiap hasil cukup besar untuk diketuk', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(kolom().className).toContain('w-full')
    expect(kolom().getAttribute('enterkeyhint')).toBe('search')
    await aksi.type(kolom(), 'ka')
    for (const o of hasil()) expect(o.className).toContain('min-h-12')
  })
})

describe('Bagan: bilah atas dan legenda', () => {
  it('bilah atas: judul, status, cari, perbesar/perkecil, Pusatkan; bisa disembunyikan', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(screen.getByText('Arsip Warisan & Sejarah')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Cari nama' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pusatkan' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lihat seluruh bagan' })).toBeTruthy()
    // fitur yang belum ada tidak ditampilkan
    expect(screen.queryByRole('button', { name: /Tambah Anggota|Unduh PDF/i })).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Sembunyikan menu bagan' }))
    expect(screen.queryByRole('combobox')).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Tampilkan menu bagan' }))
    expect(screen.getByRole('combobox', { name: 'Cari nama' })).toBeTruthy()
  })

  it('cari nama: kartu yang cocok disorot; Cari lagi ke hasil berikutnya', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(screen.getByRole('combobox', { name: 'Cari nama' }), 'ga{Enter}')
    // "ga" cocok dengan beberapa nama (Mega, Rangga, Yoga)
    const pertama = document.querySelector('[data-sorot]').dataset.orang
    await aksi.click(screen.getByRole('button', { name: 'Cari nama' }))
    const kedua = document.querySelector('[data-sorot]').dataset.orang
    expect(kedua).not.toBe(pertama)
    expect(document.querySelectorAll('[data-sorot]')).toHaveLength(1)
    expect(screen.getByText(/^2 dari \d+: /)).toBeTruthy()
  })

  it('cari nama panggilan: kartunya disorot dan hasilnya menyebut "panggilan: Ovi"', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(screen.getByRole('combobox', { name: 'Cari nama' }), 'Ovi{Enter}')
    expect(screen.getByText('1 dari 1: Elvina · putri Harvel (suami Kirana) · panggilan: Ovi')).toBeTruthy()
    expect(k('elvina').hasAttribute('data-sorot')).toBe(true)
  })

  it('cari: tahan gelar, tanda baca, ejaan lama; menemukan pasangan', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const kotak = screen.getByRole('combobox', { name: 'Cari nama' })
    for (const [kata, id, hasil] of [
      ['H. halvin', 'halvin', '1 dari 1: Alm. H. Halvin · suami Ika (putri Bima & Eka) · panggilan: Pak Halvin'],
      ['Tjahya', 'cahya', '1 dari 1: Cahya · Anak · putri Raksa & Selara'],
      ['oemar', 'umar', '1 dari 1: Umar · suami Cahya (putri Raksa & Selara)'],
      ['harvel', 'harvel', '1 dari 1: Harvel · suami Kirana (putri Bima & Fitri)'],
    ]) {
      await aksi.clear(kotak)
      await aksi.type(kotak, `${kata}{Enter}`)
      expect(screen.getByText(hasil), kata).toBeTruthy()
      expect(k(id).hasAttribute('data-sorot'), kata).toBe(true)
    }
  })

  it('cari nama yang tidak ada: pesan jelas, langsung saat mengetik, tanpa daftar', async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.type(screen.getByRole('combobox', { name: 'Cari nama' }), 'xqvj')
    expect(screen.getByText('Tidak ada nama yang cocok. Periksa ejaannya, atau coba nama panggilan.')).toBeTruthy()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('legenda menjelaskan dari mana GEN dihitung', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    const legenda = screen.getByRole('region', { name: 'Keterangan warna' })
    expect(within(legenda).getByText('Nomor generasi (GEN) dihitung dari leluhur utama, atau dari orang yang dipilih saat memakai Hitung dari …')).toBeTruthy()
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
    expect(barisOrangTua(panel)).toEqual(['Orang tua: Umar', 'Ibu sambung: Cahya'])
    expect(panel.textContent).not.toContain('Anak sambung') // putaran keenam
    expect(within(panel).getByRole('button', { name: 'Cahya' })).toBeTruthy()
    await aksi.click(k('yoga'))
    panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(panel.textContent).toContain('Orang tua angkat: Lorvan & Sinta')
    expect(panel.textContent).not.toContain('Anak angkat')
    await aksi.click(within(panel).getByRole('button', { name: 'Sinta' }))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByRole('heading', { name: 'Sinta', level: 2 })).toBeTruthy()
  })

  it('panel anak sambung dari sisi pasangan: Harvel punya empat anak (Celvia anak sambung), Celvia menyebut "Ayah sambung: Harvel"', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('harvel'))
    let panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(within(panel).getAllByRole('listitem').map((li) => li.textContent).filter((x) => /Celvia|Galen|Elvina|Fajrin/.test(x))).toEqual([
      'Celvia · anak sambung', '1.Galen · dari pernikahan sebelumnya', '2.Elvina · dari pernikahan sebelumnya', '3.Fajrin',
    ])
    await aksi.click(k('celvia'))
    panel = screen.getByRole('region', { name: 'Orang terpilih' })
    expect(barisOrangTua(panel)).toEqual(['Orang tua: Danuarta & Kirana', 'Ayah sambung: Harvel'])
    expect(panel.textContent).not.toContain('Anak sambung Harvel')
  })

  it('fokus cabang: hanya orang itu dan keturunannya; "Keluar dari fokus" mengembalikan', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const semua = semuaKartu().length
    await aksi.click(k('lorvan'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari leluhur utama' }))
    expect(screen.getByText('Menampilkan satu cabang: Lorvan')).toBeTruthy()
    expect(k('kelvan').querySelector('.kartu-gen').textContent).toBe('GEN.2') // tetap dari pangkal utama
    expect(screen.queryByText(/Generasi dihitung dari/)).toBeNull()
    expect(k('cahya')).toBeNull()
    expect(k('mega')).toBeNull() // cabang Bima
    expect(k('kelvan')).toBeTruthy()
    expect(k('gendis')).toBeTruthy()
    expect(semuaKartu().length).toBeLessThan(semua)
    // Tombol keluar ada di pita dan di bilah atas.
    expect(screen.getAllByRole('button', { name: 'Keluar dari fokus' })).toHaveLength(2)
    await aksi.click(screen.getAllByRole('button', { name: 'Keluar dari fokus' })[1])
    expect(semuaKartu().length).toBe(semua)
    expect(screen.queryByRole('button', { name: 'Keluar dari fokus' })).toBeNull()
  })

  // Putaran ketujuh, bagian 1: SEMUA keturunan orang yang difokuskan, juga
  // anak dari perempuan di cabang itu yang menikah dengan laki-laki dari
  // cabang lain (di bawah pernikahan itu).
  it('fokus: semua keturunan tampil, juga lewat anak perempuan yang menikah dengan laki-laki dari cabang lain', async () => {
    pasang('/bagan?fokus=cahya&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Cahya')).toBeTruthy()
    // Nirvo (anak Tamran & Wati) di bawah Wati–Tamran, GEN.2 · Putu.
    const anakWati = screen.getByRole('list', { name: 'Anak Wati dan Tamran' })
    expect(within(anakWati).getByRole('button', { name: /Nirvo/ })).toBe(k('nirvo'))
    expect(k('nirvo').querySelector('.kartu-gen').textContent).toBe('GEN.2')
    expect(k('nirvo').querySelector('.kartu-label').textContent).toBe('Putu')
    // Tamran tetap "Dari cabang lain"; yang sudah tampil tidak hilang (Vino di bawah Umar & Cahya).
    expect(document.querySelector('[data-rujukan="tamran"]').textContent).toContain('Dari cabang lain')
    expect(within(screen.getByRole('list', { name: 'Anak Cahya dan Umar' })).getByRole('button', { name: /Vino/ })).toBe(k('vino'))
    expect(screen.queryByRole('button', { name: /Anak mereka ada di cabang/ })).toBeNull()
  })

  // Putaran ketujuh, bagian 2: X diperlakukan seperti leluhur.
  it('"Hitung dari Vino": Vino dan Ratrisa Kemuntari GEN.0 · Awal cabang, anak-anaknya GEN.1 · Anak', async () => {
    pasang('/bagan?fokus=vino&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Vino')).toBeTruthy()
    for (const [id, gen, label] of [['vino', 'GEN.0', 'Awal cabang'], ['ratrisa-k', 'GEN.0', 'Awal cabang'], ['sadevan-b', 'GEN.1', 'Anak'], ['bagaskara', 'GEN.1', 'Anak']]) {
      expect(k(id).querySelector('.kartu-gen')?.textContent, id).toBe(gen)
      expect(k(id).querySelector('.kartu-label').textContent, id).toBe(label)
    }
  })

  it('"Hitung dari Cahya": Vino tetap tanpa GEN, Wati GEN.1 · Anak', async () => {
    pasang('/bagan?fokus=cahya&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Cahya')).toBeTruthy()
    expect(k('vino').querySelector('.kartu-gen')).toBeNull()
    expect(k('vino').querySelector('.kartu-label')).toBeNull()
    expect(k('wati').querySelector('.kartu-gen').textContent).toBe('GEN.1')
    expect(k('wati').querySelector('.kartu-label').textContent).toBe('Anak')
  })

  it('"Hitung dari Galen": Galen GEN.0 · Awal cabang; tampilan utama tanpa GEN', async () => {
    pasang('/bagan?fokus=galen&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Galen')).toBeTruthy()
    expect(k('galen').querySelector('.kartu-gen').textContent).toBe('GEN.0')
    expect(k('galen').querySelector('.kartu-label').textContent).toBe('Awal cabang')
  })

  it('tampilan utama: Vino, Galen, Elvina, Sadevan Bramasta, Bagaskara tetap tanpa GEN', async () => {
    pasang('/bagan', klienKeluarga())
    await tunggu()
    for (const id of ['vino', 'galen', 'elvina', 'sadevan-b', 'bagaskara']) expect(k(id).querySelector('.kartu-gen'), id).toBeNull()
  })

  it('fokus Lorvan: anak Arum & Dorvi dan anak Gendis & Rangga tampil, masing-masing sekali', async () => {
    pasang('/bagan?fokus=lorvan&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Lorvan')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Anak Arum dan Dorvi, S.Kom.' })).getByRole('button', { name: /Bintang/ })).toBe(k('bintang'))
    expect(within(screen.getByRole('list', { name: 'Anak Gendis dan Rangga' })).getByRole('button', { name: /Hasna/ })).toBe(k('hasna'))
    for (const id of ['bintang', 'hasna']) expect(document.querySelectorAll(`[data-orang="${id}"]`), id).toHaveLength(1)
    // Laki-laki dari cabang lain tidak punya kartu utama di sini.
    expect(k('dorvi')).toBeNull()
    expect(k('rangga')).toBeNull()
  })

  it('"Keluar dari fokus" selalu terlihat di pita selama mode fokus, juga saat bilah atas disembunyikan; kembali ke bagan lengkap dan hitungan pangkal utama', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const semua = semuaKartu().length
    await aksi.click(k('bima'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Bima' }))
    await aksi.click(screen.getByRole('button', { name: 'Sembunyikan menu bagan' }))
    const tombol = screen.getAllByRole('button', { name: 'Keluar dari fokus' })
    expect(tombol).toHaveLength(1)
    await aksi.click(tombol[0])
    expect(semuaKartu().length).toBe(semua)
    expect(screen.queryByText(/Generasi dihitung dari|Menampilkan satu cabang/)).toBeNull()
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Anak')
    expect(k('mega').querySelector('.kartu-gen').textContent).toBe('GEN.2')
    expect(lokasiSaatIni.search).toBe('')
  })

  it('tombol Kembali di browser keluar dari fokus (juga dari "Hitung dari [nama]")', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    const semua = semuaKartu().length
    await aksi.click(k('bima'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Bima' }))
    expect(screen.getByText('Generasi dihitung dari Bima')).toBeTruthy()
    // Berpindah di dalam mode fokus tidak menambah langkah: satu kali Kembali tetap keluar.
    await aksi.click(screen.getByRole('button', { name: 'Kembali ke leluhur utama' }))
    expect(screen.getByText('Menampilkan satu cabang: Bima')).toBeTruthy()
    act(() => riwayat.kembali())
    expect(await screen.findByRole('button', { name: /Hasna/ })).toBeTruthy()
    expect(screen.queryByText(/Generasi dihitung dari|Menampilkan satu cabang/)).toBeNull()
    expect(semuaKartu().length).toBe(semua)
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Anak')
  })

  it('dibuka dari alamat yang berisi fokus: tombol Kembali di browser juga keluar dari fokus', async () => {
    pasang('/bagan?fokus=kelvan&hitung=cabang', klienKeluarga())
    expect(await screen.findByText('Generasi dihitung dari Kelvan')).toBeTruthy()
    act(() => riwayat.kembali())
    expect(await screen.findByRole('button', { name: /Hasna/ })).toBeTruthy()
    expect(screen.queryByText(/Generasi dihitung dari|Menampilkan satu cabang/)).toBeNull()
    expect(k('kelvan').querySelector('.kartu-gen').textContent).toBe('GEN.2')
  })

  it('di cabang tidak ada "Naik ke …": jalan keluar hanya "Keluar dari fokus" atau "Kembali ke leluhur utama"', async () => {
    pasang('/bagan?fokus=gendis', klienKeluarga())
    expect(await screen.findByText('Menampilkan satu cabang: Gendis')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Naik ke/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Keluar dari fokus' }).length).toBeGreaterThan(0)
  })

  it('pasangan yang bukan keturunan: fokus ke cabang pasangannya', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('sinta'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Lorvan' }))
    expect(screen.getByText('Generasi dihitung dari Lorvan')).toBeTruthy()
    expect(k('sinta').querySelector('.kartu-label').textContent).toBe('Awal cabang')
  })

  it('"Hitung dari [nama]": orang itu AWAL CABANG GEN.0, keturunannya dihitung ulang, dengan pita keterangan', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    await aksi.click(k('bima'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    expect(screen.getByRole('button', { name: 'Hitung dari leluhur utama' })).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Bima' }))
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Awal cabang')
    expect(k('bima').querySelector('.kartu-gen').textContent).toBe('GEN.0')
    expect(k('mega').querySelector('.kartu-label').textContent).toBe('Anak')
    expect(k('mega').querySelector('.kartu-gen').textContent).toBe('GEN.1')
    expect(k('hasna').querySelector('.kartu-label').textContent).toBe('Putu')
    expect(screen.getByText('Generasi dihitung dari Bima')).toBeTruthy()
    // Pasangan Bima juga AWAL CABANG GEN.0 (warna tetap warna pasangan).
    for (const id of ['eka', 'fitri', 'gita']) {
      expect(k(id).querySelector('.kartu-label').textContent, id).toBe('Awal cabang')
      expect(k(id).querySelector('.kartu-gen').textContent, id).toBe('GEN.0')
      expect(k(id).dataset.warna, id).toBe('pasangan-p')
    }
    // Panel ikut dihitung ulang.
    await aksi.click(k('mega'))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByText('Anak · Generasi ke-1')).toBeTruthy()
    // Kembali ke leluhur utama: tetap di cabang yang sama, GEN seperti biasa.
    await aksi.click(screen.getByRole('button', { name: 'Kembali ke leluhur utama' }))
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

  // Putaran keenam: kata "pangkal" tidak pernah tampil lagi ("Leluhur",
  // "Awal cabang", "Hitung dari leluhur utama", "Kembali ke leluhur utama").
  it('kata "pangkal" tidak tampil: kartu, legenda, panel, pilihan fokus, pita, dan pencarian', BERAT, async () => {
    const { aksi } = pasang('/bagan', klienKeluarga())
    await tunggu()
    expect(k('raksa').querySelector('.kartu-label').textContent).toBe('Leluhur')
    expect(within(screen.getByRole('region', { name: 'Keterangan warna' })).getByText('Leluhur')).toBeTruthy()
    await aksi.click(k('raksa'))
    expect(within(screen.getByRole('region', { name: 'Orang terpilih' })).getByText('Leluhur')).toBeTruthy()
    await aksi.click(k('bima'))
    await aksi.click(screen.getByRole('button', { name: 'Fokus pada cabang ini' }))
    expect(screen.getByRole('button', { name: 'Hitung dari leluhur utama' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/pangkal/i)
    await aksi.click(screen.getByRole('button', { name: 'Hitung dari Bima' }))
    expect(k('bima').querySelector('.kartu-label').textContent).toBe('Awal cabang')
    expect(screen.getByRole('button', { name: 'Kembali ke leluhur utama' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/pangkal/i)
    await aksi.click(screen.getAllByRole('button', { name: 'Keluar dari fokus' })[0])
    await aksi.type(screen.getByRole('combobox', { name: 'Cari nama' }), 'raksa{Enter}')
    expect(screen.getByText('1 dari 1: Alm. Raksa · Leluhur')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/pangkal/i)
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

  it('tombol Perbesar dan Perkecil mengubah skala', BERAT, async () => {
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
