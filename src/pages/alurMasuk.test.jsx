// @vitest-environment jsdom
// Tes alur masuk dengan aplikasi UTUH dan klien tiruan: kode yang diketik,
// link undangan, kode dari QR, semua pesan penolakan, dan browser di dalam
// aplikasi lain. Semua orang dan data FIKTIF.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { lokasiSaatIni, pasang } from '../test/pembantu.jsx'
import { GALAT, OK, anggotaContoh, buatKlienTiruan } from '../test/klienTiruan.js'

const TOKEN = 'Q'.repeat(43)
const HASIL_OK = { ok: true, token_hash: 'hash-tiruan', tiket: 'tiket-tiruan', nama: 'Bu Contoh', via: 'undangan', menit: null }

// Klien dengan jalur masuk yang berhasil. `fungsi` dan `rpc` bisa diganti per tes.
function klienMasuk({ fungsi = {}, rpc = {}, ...sisa } = {}) {
  return buatKlienTiruan({
    fungsi: {
      'pakai-undangan': async () => OK(HASIL_OK),
      'pakai-kode': async () => OK({ ...HASIL_OK, via: 'kode' }),
      'cek-perangkat': async () => OK({ ok: true, status: 'ok', berakhir: null }),
      ...fungsi,
    },
    rpc: {
      claim_device: async (a) => OK({ device_id: 'perangkat-1', member_id: 'anggota-1', via: HASIL_OK.via, expires_at: null, tiket: a.p_ticket }),
      db_version: async () => OK('999'),
      ...rpc,
    },
    tabel: { members: [anggotaContoh] },
    ...sisa,
  })
}

const ubahUserAgent = (ua) => vi.spyOn(globalThis.navigator, 'userAgent', 'get').mockReturnValue(ua)
afterEach(() => vi.restoreAllMocks())

describe('layar Masuk', () => {
  it('belum masuk → layar Masuk, tanpa data apa pun dan tanpa memanggil server', async () => {
    const klien = klienMasuk()
    pasang('/', klien)
    expect(await screen.findByRole('heading', { name: 'Silsilah Keluarga' })).toBeTruthy()
    expect(screen.getByText(/khusus untuk anggota keluarga yang sudah diundang/)).toBeTruthy()
    expect(klien.panggilan.filter((p) => p.jenis !== 'auth')).toEqual([])
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('kode diketik: huruf kecil dirapikan jadi ABCD-2345; masuk → menukar kode, membuat sesi, mendaftarkan perangkat', async () => {
    const klien = klienMasuk()
    const { aksi } = pasang('/masuk', klien)
    const isian = await screen.findByLabelText('Kode (8 huruf dan angka)')
    await aksi.type(isian, 'abcd2345')
    expect(isian.value).toBe('ABCD-2345')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    await screen.findByText('Halo, Bu Contoh')

    expect(klien.panggilanKe('fungsi', 'pakai-kode')[0].isi).toEqual({ kode: 'ABCD2345' })
    expect(klien.panggilanKe('auth', 'verifyOtp')[0].isi).toEqual({ token_hash: 'hash-tiruan', type: 'magiclink' })
    const klaim = klien.panggilanKe('rpc', 'claim_device')[0].isi
    expect(klaim.p_ticket).toBe('tiket-tiruan')
    expect(typeof klaim.p_timezone === 'string' || klaim.p_timezone === null).toBe(true)
    expect(lokasiSaatIni.pathname).toBe('/')
  })

  it('kode kurang lengkap: pesan, dan server TIDAK dipanggil', async () => {
    const klien = klienMasuk()
    const { aksi } = pasang('/masuk', klien)
    await aksi.type(await screen.findByLabelText('Kode (8 huruf dan angka)'), 'ABC')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    expect(await screen.findByText(/Kode terdiri dari 8 huruf dan angka/)).toBeTruthy()
    expect(klien.panggilanKe('fungsi', 'pakai-kode')).toEqual([])
  })

  it.each([
    ['salah', 'Kode salah. Periksa lagi kodenya, lalu coba lagi.'],
    ['sudah_dipakai', 'Kode ini sudah dipakai. Buat atau mintalah kode baru.'],
    ['kedaluwarsa', 'Kode ini sudah tidak berlaku (lebih dari 10 menit). Buat atau mintalah kode baru.'],
    ['terlalu_sering', 'Terlalu banyak percobaan kode yang salah. Tunggu 15 menit, lalu coba lagi.'],
  ])('kode ditolak (%s) → pesan Indonesia, tidak masuk', async (alasan, pesan) => {
    const klien = klienMasuk({ fungsi: { 'pakai-kode': async () => OK({ ok: false, alasan }) } })
    const { aksi } = pasang('/masuk', klien)
    await aksi.type(await screen.findByLabelText('Kode (8 huruf dan angka)'), 'ABCD2345')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    expect(await screen.findByText(pesan)).toBeTruthy()
    expect(klien.panggilanKe('auth', 'verifyOtp')).toEqual([])
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('tanpa internet → pesan jaringan (bukan pesan Inggris dari server)', async () => {
    const klien = klienMasuk({ fungsi: { 'pakai-kode': async () => GALAT(undefined, 'Failed to fetch') } })
    klien.functions.invoke.mockImplementationOnce(async () => ({ data: null, error: Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }) }))
    const { aksi } = pasang('/masuk', klien)
    await aksi.type(await screen.findByLabelText('Kode (8 huruf dan angka)'), 'ABCD2345')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    expect(await screen.findByText(/Tidak bisa terhubung ke server|Tidak ada koneksi internet/)).toBeTruthy()
    expect(screen.queryByText(/Failed|Edge Function/)).toBeNull()
  })

  it('database/aplikasi belum dikonfigurasi → "Aplikasi belum siap"', async () => {
    pasang('/masuk', null)
    expect(await screen.findByRole('heading', { name: 'Aplikasi belum siap' })).toBeTruthy()
  })
})

describe('membuka link undangan', () => {
  it('SEBELUM tombol Masuk ditekan: tidak ada panggilan ke server, tidak ada nama atau data', async () => {
    const klien = klienMasuk()
    pasang(`/u/${TOKEN}`, klien)
    expect(await screen.findByRole('heading', { name: 'Link undangan pribadi' })).toBeTruthy()
    expect(screen.getByText('Ini link pribadi untuk membuka Silsilah Keluarga. Tekan Masuk untuk melanjutkan.')).toBeTruthy()
    expect(screen.getByText(/hanya bisa dipakai sekali/)).toBeTruthy()
    expect(screen.queryByText(/Bu Contoh/)).toBeNull()
    await new Promise((r) => setTimeout(r, 50))
    expect(klien.functions.invoke).not.toHaveBeenCalled()
    expect(klien.rpc).not.toHaveBeenCalled()
    expect(klien.panggilanKe('auth', 'verifyOtp')).toEqual([])
  })

  it('Masuk → sapaan "Selamat datang, …! Apakah ini Anda?", dan link hilang dari kolom alamat', async () => {
    const klien = klienMasuk()
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('heading', { name: 'Selamat datang, Bu Contoh!' })).toBeTruthy()
    expect(screen.getByText('Apakah ini Anda?')).toBeTruthy()
    expect(klien.panggilanKe('fungsi', 'pakai-undangan')[0].isi).toEqual({ token: TOKEN })
    expect(lokasiSaatIni.pathname).toBe('/selamat-datang')
    expect(`${lokasiSaatIni.pathname}${lokasiSaatIni.search}`).not.toContain(TOKEN)
  })

  it.each([
    ['sudah_dipakai', 'Link ini sudah dipakai. Kalau Anda belum pernah masuk, hubungi admin keluarga.'],
    ['kedaluwarsa', 'Link ini sudah kedaluwarsa. Mintalah link baru kepada admin.'],
    ['dicabut', 'Link ini sudah dibatalkan. Mintalah link baru kepada admin.'],
    ['tidak_dikenal', 'Link ini tidak dikenali. Pastikan Anda membuka link lengkap dari admin, atau mintalah link baru.'],
  ])('link %s → pesan jelas, tombol Masuk hilang, ada jalan ke halaman masuk', async (alasan, pesan) => {
    const klien = klienMasuk({ fungsi: { 'pakai-undangan': async () => OK({ ok: false, alasan }) } })
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText(pesan)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Masuk' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ke halaman masuk' })).toBeTruthy()
    expect(klien.panggilanKe('auth', 'verifyOtp')).toEqual([])
  })

  it('terlalu banyak percobaan atau gangguan server: boleh dicoba lagi', async () => {
    let n = 0
    const klien = klienMasuk({
      fungsi: { 'pakai-undangan': async () => (++n === 1 ? OK({ ok: false, alasan: 'terlalu_sering' }) : OK(HASIL_OK)) },
    })
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText(/Terlalu banyak percobaan yang salah/)).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByRole('heading', { name: 'Selamat datang, Bu Contoh!' })).toBeTruthy()
  })

  it('server error 500 dari Edge Function → pesan "server bermasalah", boleh coba lagi', async () => {
    const klien = klienMasuk({
      fungsi: { 'pakai-undangan': async () => ({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError', context: { status: 500 } }) }) },
    })
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Server sedang bermasalah. Silakan coba lagi beberapa saat lagi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeTruthy()
  })

  it('link terpotong → pesan, dan server tidak dipanggil', async () => {
    const klien = klienMasuk()
    pasang('/u/pendek', klien)
    expect(await screen.findByText(/Link ini tidak lengkap/)).toBeTruthy()
    expect(klien.functions.invoke).not.toHaveBeenCalled()
  })

  it('tautan masuk gagal diverifikasi di kedua tipe → galat, tidak masuk', async () => {
    const klien = klienMasuk({ verifyOtp: async () => GALAT('otp_expired', 'Token has expired or is invalid', 403) })
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await waitFor(() => expect(klien.panggilanKe('auth', 'verifyOtp')).toHaveLength(2))
    expect(klien.panggilanKe('auth', 'verifyOtp').map((p) => p.isi.type)).toEqual(['magiclink', 'email'])
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/Token has expired/)).toBeNull()
    expect(klien.panggilanKe('rpc', 'claim_device')).toEqual([])
  })
})

describe('membuka kode dari QR', () => {
  it('menunggu tombol Masuk; sesudahnya langsung ke beranda (tanpa sapaan "Apakah ini Anda?")', async () => {
    const klien = klienMasuk({
      rpc: { claim_device: async () => OK({ device_id: 'perangkat-2', member_id: 'anggota-1', via: 'kode', expires_at: null }) },
    })
    const { aksi } = pasang('/kode/ABCD2345', klien)
    expect(await screen.findByRole('heading', { name: 'Masuk dengan kode' })).toBeTruthy()
    expect(klien.functions.invoke).not.toHaveBeenCalled()
    await aksi.click(screen.getByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Bu Contoh')
    expect(klien.panggilanKe('fungsi', 'pakai-kode')[0].isi).toEqual({ kode: 'ABCD2345' })
    expect(lokasiSaatIni.pathname).toBe('/')
  })
})

describe('browser di dalam aplikasi lain', () => {
  const UA_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0'

  it('diminta membuka di Chrome/Safari DULU; link belum dipakai', async () => {
    ubahUserAgent(UA_INSTAGRAM)
    const klien = klienMasuk()
    pasang(`/u/${TOKEN}`, klien)
    expect(await screen.findByRole('heading', { name: 'Buka di Chrome atau Safari' })).toBeTruthy()
    expect(screen.getByText(/di dalam aplikasi Instagram/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Masuk' })).toBeNull()
    expect(klien.functions.invoke).not.toHaveBeenCalled()
  })

  it('"Salin link" menyalin alamat dan memberi petunjuk', async () => {
    ubahUserAgent(UA_INSTAGRAM)
    const { aksi } = pasang(`/u/${TOKEN}`, klienMasuk())
    const tulis = vi.fn(async () => {})
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: tulis }, configurable: true })
    await aksi.click(await screen.findByRole('button', { name: 'Salin link' }))
    expect(tulis).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Link sudah disalin/)).toBeTruthy()
  })

  it('gagal menyalin → petunjuk lain', async () => {
    ubahUserAgent(UA_INSTAGRAM)
    const { aksi } = pasang(`/u/${TOKEN}`, klienMasuk())
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('ditolak') } }, configurable: true })
    await aksi.click(await screen.findByRole('button', { name: 'Salin link' }))
    expect(await screen.findByText(/Link belum bisa disalin/)).toBeTruthy()
  })

  it('"Saya tetap ingin lanjut di sini" membuka layar biasa', async () => {
    ubahUserAgent(UA_INSTAGRAM)
    const { aksi } = pasang(`/u/${TOKEN}`, klienMasuk())
    await aksi.click(await screen.findByRole('button', { name: 'Saya tetap ingin lanjut di sini' }))
    expect(await screen.findByRole('button', { name: 'Masuk' })).toBeTruthy()
  })
})

describe('selamat datang', () => {
  async function sampaiSapaan(klien = klienMasuk()) {
    const h = pasang(`/u/${TOKEN}`, klien)
    await h.aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByRole('heading', { name: 'Selamat datang, Bu Contoh!' })
    return { ...h, klien }
  }

  it('"Ya, ini saya" → tips (ukuran huruf, layar utama, perangkat lain) → Beranda', async () => {
    const { aksi } = await sampaiSapaan()
    await aksi.click(screen.getByRole('button', { name: 'Ya, ini saya' }))
    expect(await screen.findByRole('heading', { name: 'Beberapa tips' })).toBeTruthy()
    expect(screen.getByText('Pasang di layar utama')).toBeTruthy()
    expect(screen.getByText('Pakai di HP atau laptop lain')).toBeTruthy()
    await aksi.click(screen.getByLabelText('Besar'))
    expect(document.documentElement.dataset.ukuran).toBe('besar')
    await aksi.click(screen.getByRole('button', { name: 'Mulai memakai aplikasi' }))
    await screen.findByText('Halo, Bu Contoh')
  })

  it('"Bukan saya" → minta kepastian dulu; "Kembali" membatalkan tanpa memberi tahu admin', async () => {
    const { aksi, klien } = await sampaiSapaan()
    await aksi.click(screen.getByRole('button', { name: 'Bukan saya' }))
    expect(await screen.findByRole('heading', { name: 'Yakin ini bukan Anda?' })).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Kembali' }))
    expect(await screen.findByText('Apakah ini Anda?')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'report_not_me')).toEqual([])
  })

  it('"Ya, ini bukan saya" → admin diberi tahu, akses ditutup, data lokal dihapus', async () => {
    const klien = klienMasuk({ rpc: { report_not_me: async () => OK({ status: 'ok' }) } })
    const { aksi } = await sampaiSapaan(klien)
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    await aksi.click(screen.getByRole('button', { name: 'Bukan saya' }))
    await aksi.click(await screen.findByRole('button', { name: 'Ya, ini bukan saya' }))
    expect(await screen.findByRole('heading', { name: 'Terima kasih' })).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'report_not_me')).toHaveLength(1)
    await aksi.click(screen.getByRole('button', { name: 'Ke halaman masuk' }))
    expect(await screen.findByRole('heading', { name: 'Silsilah Keluarga' })).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('kalau pelaporan gagal, orangnya diberi tahu dan boleh mencoba lagi (tidak dianggap berhasil)', async () => {
    const klien = klienMasuk({ rpc: { report_not_me: async () => GALAT('XX000', 'internal error') } })
    const { aksi } = await sampaiSapaan(klien)
    await aksi.click(screen.getByRole('button', { name: 'Bukan saya' }))
    await aksi.click(await screen.findByRole('button', { name: 'Ya, ini bukan saya' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Terima kasih' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ya, ini bukan saya' })).toBeTruthy()
  })
})

describe('tidak pernah meminta izin lokasi', () => {
  it('di layar masuk, membuka link, dan sapaan: tidak ada panggilan geolocation atau izin notifikasi', async () => {
    const getCurrentPosition = vi.fn()
    const watchPosition = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', { value: { getCurrentPosition, watchPosition }, configurable: true })
    const minta = vi.fn()
    globalThis.Notification = Object.assign(function Notification() {}, { requestPermission: minta, permission: 'default' })
    const klien = klienMasuk()
    const { aksi } = pasang(`/u/${TOKEN}`, klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByRole('heading', { name: 'Selamat datang, Bu Contoh!' })
    await aksi.click(screen.getByRole('button', { name: 'Ya, ini saya' }))
    await screen.findByRole('heading', { name: 'Beberapa tips' })
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(watchPosition).not.toHaveBeenCalled()
    expect(minta).not.toHaveBeenCalled()
    delete globalThis.Notification
  })
})
