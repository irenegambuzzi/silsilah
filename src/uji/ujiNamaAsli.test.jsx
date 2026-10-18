// @vitest-environment jsdom
// Halaman uji nama asli dengan nama FIKTIF (tanpa server).
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UjiNamaAsli from './UjiNamaAsli.jsx'

const orang = [
  { nama: 'Zorvak Talindra', sex: 'L', sexDari: 'data', wafat: true, peran: 'keturunan' },
  { nama: 'Merila Osvat Kandari', sex: 'P', sexDari: 'perkiraan', wafat: false, peran: 'pasangan' },
  { nama: 'Pirun', sex: null, sexDari: null, wafat: false, peran: 'keturunan' },
]
const ambilContoh = (isi = { orang }, ok = true) => {
  const panggilan = []
  const ambil = async (url, opsi) => {
    panggilan.push([url, opsi])
    return { ok, json: async () => isi }
  }
  return { ambil, panggilan }
}

afterEach(cleanup)

describe('halaman uji nama asli', () => {
  it('spanduk MERAH di paling atas, tanpa spanduk MODE CONTOH; nama diminta tanpa cache', async () => {
    const { ambil, panggilan } = ambilContoh()
    const { container } = render(<UjiNamaAsli ambil={ambil} />)
    const spanduk = screen.getByRole('alert')
    expect(spanduk.textContent).toBe('DATA ASLI — HANYA DI KOMPUTER INI. Jangan ambil tangkapan layar dan jangan bagikan halaman ini.')
    expect(spanduk.className).toMatch(/sticky top-0/)
    expect(spanduk.className).toMatch(/bg-red-700/)
    expect(container.firstElementChild).toBe(spanduk)
    expect(document.body.textContent).not.toMatch(/MODE CONTOH/)
    await screen.findByText('Jumlah orang')
    expect(panggilan).toEqual([['/__uji-nama-asli/data', { cache: 'no-store' }]])
  })

  it('ringkasan tiga skenario × pilihan A–E; bingkai HP di atas bingkai komputer', async () => {
    const { ambil } = ambilContoh()
    const { container } = render(<UjiNamaAsli ambil={ambil} />)
    await screen.findByText('Jumlah orang')
    for (const s of ['Tanpa gelar', 'Gelar perkiraan (±30%)', 'Gelar terpanjang']) {
      const bagian = screen.getByRole('region', { name: s })
      expect(within(bagian).getAllByRole('row')).toHaveLength(6)
    }
    const hp = container.querySelector('[data-bingkai="hp"]')
    const komputer = container.querySelector('[data-bingkai="komputer"]')
    expect(hp.compareDocumentPosition(komputer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hp.className).toMatch(/w-\[390px\]/)
    expect(hp.querySelectorAll('.kartu-orang')).toHaveLength(3)
    expect(container.querySelector('[data-pemeriksaan-layar]').textContent).toBe('Pemeriksaan di layar, bingkai HP: melebihi lebar 0, terpotong "…" 0')
  })

  it('memilih skenario dan ukuran mengganti kartu', async () => {
    const { ambil } = ambilContoh()
    const { container } = render(<UjiNamaAsli ambil={ambil} />)
    await screen.findByText('Jumlah orang')
    const aksi = userEvent.setup()
    const hp = () => container.querySelector('[data-bingkai="hp"]')
    expect(hp().textContent).not.toMatch(/Alm\./)
    await aksi.click(screen.getByRole('button', { name: 'Gelar terpanjang' }))
    expect(hp().textContent).toMatch(/Alm\./)
    await aksi.click(screen.getByRole('button', { name: 'E' }))
    expect(screen.getByRole('button', { name: 'E' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('kalau server tidak memberi nama: pesan, tanpa isi', async () => {
    const { ambil } = ambilContoh({}, false)
    render(<UjiNamaAsli ambil={ambil} />)
    expect(await screen.findByText(/Nama tidak bisa dimuat/)).toBeTruthy()
  })
})
