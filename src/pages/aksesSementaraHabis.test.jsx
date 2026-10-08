// @vitest-environment jsdom
// Akses sementara di perangkat yang dipinjam: spanduk hitung mundur, keluar
// otomatis dan penghapusan data saat waktunya habis, penghapusan saat
// aplikasi dibuka kembali (walau tanpa internet), dan pemeriksaan ulang saat
// aplikasi kembali terlihat. Aplikasi UTUH + klien tiruan; data FIKTIF.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { lokasiSaatIni, pasang } from '../test/pembantu.jsx'
import { OK, klienSudahMasuk } from '../test/klienTiruan.js'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const menitLagi = (m) => new Date(Date.now() + m * 60000).toISOString()
const jamTeks = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}
const klienSementara = (berakhir, tambahan = {}) =>
  klienSudahMasuk({
    fungsi: { 'cek-perangkat': async () => OK({ ok: true, status: 'ok', berakhir }) },
    ...tambahan,
  })
const lihatTampak = () => act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
// Pendengar "kembali terlihat" dipasang oleh efek React, yang saat komputer
// sibuk bisa sedikit tertinggal dari teks di layar. Karena itu peristiwanya
// dikirim berulang sampai harapan terpenuhi.
const tampakSampai = (harapan) =>
  waitFor(async () => {
    await lihatTampak()
    harapan()
  }, { timeout: 4000 })
// Jam perangkat dimajukan (hanya Date; pengatur waktu tetap asli).
const geserJam = (menit) => {
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + menit * 60000)
}
// Jam DAN pengatur waktu tiruan (tetap berjalan sendiri), supaya "tepat
// waktunya" tidak bergantung pada kecepatan komputer saat tes.
const pakaiJamTiruan = () => vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
const majukan = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('spanduk hitung mundur', () => {
  it('menampilkan pukul berapa akses berakhir dan sisa waktunya, dengan peran timer', async () => {
    const berakhir = menitLagi(29)
    pasang('/', klienSementara(berakhir))
    await screen.findByText('Halo, Bu Contoh')
    const spanduk = screen.getByRole('timer')
    expect(spanduk.textContent).toContain(`Akses sementara berakhir pukul ${jamTeks(berakhir)}.`)
    expect(spanduk.textContent).toMatch(/Sisa waktu: (28|29) menit\./)
    expect(spanduk.textContent).not.toContain('Segera berakhir')
  })

  it('lima menit terakhir: tulisan "Segera berakhir" (bukan hanya warna) dan penjelasan penghapusan data', async () => {
    pasang('/', klienSementara(menitLagi(4)))
    await screen.findByText('Halo, Bu Contoh')
    expect(screen.getByRole('timer').textContent).toContain('Segera berakhir. Setelah itu aplikasi keluar sendiri dan data di perangkat ini dihapus.')
  })

  it('akses biasa tidak punya spanduk', async () => {
    pasang('/', klienSudahMasuk())
    await screen.findByText('Halo, Bu Contoh')
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('perangkat akses sementara tidak ditawari "Tambah perangkat"', async () => {
    pasang('/saya', klienSementara(menitLagi(30)))
    await screen.findByRole('heading', { name: 'Saya' })
    expect(screen.queryByRole('link', { name: 'Tambah perangkat' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Perangkat saya' })).toBeTruthy()
  })

  it('waktu berakhir disimpan di perangkat (untuk penghapusan saat dibuka kembali)', async () => {
    const berakhir = menitLagi(30)
    pasang('/', klienSementara(berakhir))
    await screen.findByText('Halo, Bu Contoh')
    expect(localStorage.getItem('silsilah-akses-berakhir')).toBe(berakhir)
  })
})

describe('waktu habis saat aplikasi terbuka', () => {
  it('keluar sendiri tepat waktunya: data aplikasi dihapus, sesi diakhiri, pesan di layar Masuk', async () => {
    pakaiJamTiruan()
    localStorage.setItem('silsilah-salinan-contoh', 'data keluarga fiktif')
    localStorage.setItem('proyek-lain', 'tidak boleh hilang')
    const berakhir = menitLagi(10)
    const klien = klienSementara(berakhir)
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    await majukan(Date.parse(berakhir) - Date.now() - 1000)
    expect(screen.getByText('Halo, Bu Contoh')).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBe('data keluarga fiktif')
    await majukan(1000)
    expect(await screen.findByText('Akses sementara Anda sudah berakhir. Data di perangkat ini sudah dihapus.')).toBeTruthy()
    expect(screen.queryByText('Halo, Bu Contoh')).toBeNull()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(localStorage.getItem('silsilah-akses-berakhir')).toBeNull()
    expect(localStorage.getItem('proyek-lain')).toBe('tidak boleh hilang')
    expect(klien.panggilanKe('auth', 'signOut')).toHaveLength(1)
  })

  it('pengatur waktu berbunyi sedikit lebih awal daripada jam → dijadwalkan lagi dan tetap keluar begitu waktunya habis', async () => {
    pakaiJamTiruan()
    const berakhir = menitLagi(10)
    pasang('/', klienSementara(berakhir))
    await screen.findByText('Halo, Bu Contoh')
    const sisa = Date.parse(berakhir) - Date.now()
    // Jam perangkat tertinggal 5 ms dari pengatur waktu.
    vi.setSystemTime(Date.now() - 5)
    await majukan(sisa)
    await majukan(10)
    expect(await screen.findByText(/Akses sementara Anda sudah berakhir/)).toBeTruthy()
  })

  it('aplikasi kembali terlihat setelah waktu lewat (pengatur waktu tertunda di latar) → langsung keluar tanpa menunggu server', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    const klien = klienSementara(menitLagi(10))
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    const panggilanSebelum = klien.panggilanKe('fungsi', 'cek-perangkat').length
    geserJam(11)
    await tampakSampai(() => expect(screen.getByText(/Akses sementara Anda sudah berakhir/)).toBeTruthy())
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(panggilanSebelum)
  })
})

describe('aplikasi dibuka kembali', () => {
  it('waktu yang tersimpan sudah lewat → data dihapus DULU, walaupun tanpa internet dan tanpa menanyai server', async () => {
    localStorage.setItem('silsilah-akses-berakhir', new Date(Date.now() - 60000).toISOString())
    localStorage.setItem('silsilah-salinan-contoh', 'data keluarga fiktif')
    const klien = klienSementara(menitLagi(30), {
      fungsi: { 'cek-perangkat': async () => { throw new TypeError('Failed to fetch') } },
    })
    pasang('/', klien)
    expect(await screen.findByText('Akses sementara Anda sudah berakhir. Data di perangkat ini sudah dihapus.')).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toEqual([])
    expect(klien.panggilanKe('auth', 'signOut')).toHaveLength(1)
  })

  it('waktu yang tersimpan belum lewat → aplikasi dibuka seperti biasa', async () => {
    localStorage.setItem('silsilah-akses-berakhir', menitLagi(20))
    pasang('/', klienSementara(menitLagi(20)))
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
  })

  it('server menjawab "kedaluwarsa" (jam perangkat salah/mundur) → tetap dikeluarkan dan data dihapus', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    const klien = klienSudahMasuk({ fungsi: { 'cek-perangkat': async () => OK({ ok: true, status: 'kedaluwarsa', berakhir: null }) } })
    pasang('/', klien)
    expect(await screen.findByText(/Akses sementara Anda sudah berakhir/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
  })
})

describe('pemeriksaan ulang saat aplikasi kembali terlihat', () => {
  it('perangkat dicabut admin selagi aplikasi di latar → dikeluarkan dan data dihapus', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    let status = 'ok'
    const klien = klienSudahMasuk({ fungsi: { 'cek-perangkat': async () => OK({ ok: true, status, berakhir: null }) } })
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    status = 'dicabut'
    geserJam(2)
    await tampakSampai(() => expect(screen.getByText(/Akses perangkat ini sudah dicabut/)).toBeTruthy())
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
  })

  it('tidak menanyai server terlalu sering (paling cepat setiap 1 menit)', async () => {
    const klien = klienSudahMasuk()
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    const awal = klien.panggilanKe('fungsi', 'cek-perangkat').length
    geserJam(2)
    await tampakSampai(() => expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(awal + 1))
    // Pendengar sudah pasti terpasang (baru saja bereaksi): kurang dari 1 menit → tidak bertanya lagi.
    await lihatTampak()
    await lihatTampak()
    expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(awal + 1)
    geserJam(2)
    await tampakSampai(() => expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(awal + 2))
  })

  it('tanpa internet saat kembali terlihat → tetap di tempat, data tidak dihapus', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    let putus = false
    const klien = klienSudahMasuk({ fungsi: { 'cek-perangkat': async () => {
      if (putus) throw new TypeError('Failed to fetch')
      return OK({ ok: true, status: 'ok', berakhir: null })
    } } })
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    putus = true
    geserJam(2)
    await tampakSampai(() => expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(2))
    expect(screen.getByText('Halo, Bu Contoh')).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBe('data')
  })
})
