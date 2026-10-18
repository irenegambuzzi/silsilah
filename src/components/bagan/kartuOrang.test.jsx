// @vitest-environment jsdom
// Nama di kartu yang tidak muat dengan aturan biasa (putaran 7c-2): gelar
// dikecilkan, gelar belakang pindah baris, atau ukuran hitungan; semuanya
// tetap utuh. Semua nama FIKTIF.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { KartuOrang } from './KartuOrang.jsx'
import { barisNamaKartu } from '../../lib/bagan/barisNama.js'

afterEach(cleanup)

const kartu = (namaKartu) => ({ id: 'x', nama: '', namaKartu, sex: 'L', jenis: 'keturunan', label: 'Putu', pojok: 'GEN.2' })
const gambar = (n) => {
  const { container } = render(<KartuOrang kartu={kartu(n)} letak={{ x: 0, y: 0 }} saatKetuk={() => {}} />)
  return container.querySelector('.kartu-nama')
}
const baris = (nama) => [...nama.querySelectorAll('.kartu-nama-baris')].map((b) => b.textContent.trim())

// Cari nama buatan yang memakai langkah tertentu pada ukuran bawaan.
const KATA = ['Kusumaningtyas', 'Purbanegara', 'Sastrawikencana', 'Wijayakusuma', 'Adiwangsa', 'Larasati']
function cari(syarat) {
  for (const a of KATA) for (const b of KATA) for (const c of [null, ...KATA]) {
    const kata = [a, b, c].filter(Boolean)
    for (const depan of [null, 'Prof. Dr. Ir. K.H.']) {
      const n = { depan, kata, belakang: 'S.Kom., M.Pd., S.Ag.', jumlahKata: kata.length }
      if (syarat(barisNamaKartu(n))) return n
    }
  }
  throw new Error('tidak ada contoh')
}

describe('KartuOrang: nama yang tidak muat dengan aturan biasa', () => {
  it('gelar pindah baris: gelar utuh di baris sendiri, koma ikut kata terakhir', () => {
    const n = cari((h) => h.gelarPindah)
    const nama = gambar(n)
    expect(nama.dataset.gelarPindah).toBe('true')
    expect(baris(nama).join(' ')).toBe(`${n.depan ? `${n.depan} ` : ''}${n.kata.join(' ')}, S.Kom., M.Pd., S.Ag.`)
    expect(baris(nama).some((b) => b.startsWith('S.Kom.,') || b.startsWith('M.Pd.,') || b.startsWith('S.Ag.'))).toBe(true)
    expect(nama.textContent).not.toContain('…')
  })

  it('gelar dikecilkan: --skala-gelar lebih kecil dari 0,8', () => {
    const n = cari((h) => h.skalaGelar < 0.8 && !h.gelarPindah)
    const nama = gambar(n)
    expect(nama.dataset.gelarKecil).toBe('true')
    expect(Number(nama.style.getPropertyValue('--skala-gelar'))).toBeLessThan(0.8)
  })

  it('nama yang muat biasa: tanpa tanda dan tanpa --skala-gelar (tampilan tidak berubah)', () => {
    const nama = gambar({ depan: 'H.', kata: ['Bima', 'Larasati'], belakang: 'S.T.', jumlahKata: 2 })
    expect(nama.dataset.gelarKecil).toBeUndefined()
    expect(nama.dataset.gelarPindah).toBeUndefined()
    expect(nama.dataset.dihitung).toBeUndefined()
    expect(nama.style.getPropertyValue('--skala-gelar')).toBe('')
  })

  it('ukuran hitungan: ditandai, nama utuh', () => {
    const nama = gambar({ depan: null, kata: ['Kusumaningtyaswardhaniprameswari'], belakang: null, jumlahKata: 1 })
    expect(nama.dataset.dihitung).toBe('true')
    expect(nama.textContent).toBe('Kusumaningtyaswardhaniprameswari')
  })
})
