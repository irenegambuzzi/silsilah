// @vitest-environment jsdom
// Tes menu Saya: tampilan, keluar (dan penghapusan data), tambah perangkat,
// perangkat saya, dan Privasi. Aplikasi UTUH + klien tiruan; data FIKTIF.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { lokasiSaatIni, pasang } from '../test/pembantu.jsx'
import { GALAT, OK, klienSudahMasuk } from '../test/klienTiruan.js'

afterEach(() => {
  vi.restoreAllMocks()
  delete globalThis.indexedDB
  delete globalThis.caches
})

describe('Saya: tampilan', () => {
  it('ukuran huruf dan kontras: langsung berlaku dan tersimpan di perangkat', async () => {
    const { aksi } = pasang('/saya', klienSudahMasuk())
    await screen.findByRole('heading', { name: 'Saya' })
    await aksi.click(screen.getByLabelText('Sangat besar'))
    expect(document.documentElement.dataset.ukuran).toBe('sangatBesar')
    const saklar = screen.getByRole('switch')
    expect(saklar.getAttribute('aria-checked')).toBe('false')
    expect(saklar.textContent).toContain('Mati')
    await aksi.click(saklar)
    expect(document.documentElement.dataset.kontras).toBe('tinggi')
    expect(saklar.getAttribute('aria-checked')).toBe('true')
    expect(saklar.textContent).toContain('Menyala')
    expect(JSON.parse(localStorage.getItem('silsilah-tampilan'))).toEqual({ ukuran: 'sangatBesar', kontras: true })
  })

  it('menu Saya memuat jalan ke Tambah perangkat, Perangkat saya, Privasi, dan Keluar', async () => {
    pasang('/saya', klienSudahMasuk())
    await screen.findByRole('heading', { name: 'Saya' })
    for (const nama of ['Tambah perangkat', 'Perangkat saya', 'Privasi', 'Keluar']) {
      expect(screen.getByRole('link', { name: nama })).toBeTruthy()
    }
  })
})

describe('Keluar', () => {
  const siapkanPenyimpanan = () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data keluarga fiktif')
    localStorage.setItem('silsilah-auth', 'sesi')
    localStorage.setItem('silsilah-tampilan', '{"ukuran":"besar","kontras":false}')
    localStorage.setItem('nutrihub-lain', 'milik proyek lain di alamat yang sama')
    sessionStorage.setItem('silsilah-sementara', 'x')
    const hapus = vi.fn((nama) => { const r = {}; setTimeout(() => r.onsuccess?.(), 0); return { ...r, set onsuccess(f) { setTimeout(f, 0) }, nama } })
    globalThis.indexedDB = { databases: async () => [{ name: 'silsilah-data' }, { name: 'nutrihub-db' }], deleteDatabase: hapus }
    const hapusCache = vi.fn(async () => true)
    globalThis.caches = { keys: async () => ['silsilah-v1', 'nutrihub-v1'], delete: hapusCache }
    return { hapus, hapusCache }
  }

  it('dari perangkat ini: perangkat dicabut, sesi dan data aplikasi dihapus, data proyek lain TIDAK tersentuh', async () => {
    const klien = klienSudahMasuk({ rpc: { sign_out_devices: async () => OK(1), db_version: async () => OK('999') } })
    const { hapus, hapusCache } = siapkanPenyimpanan()
    const { aksi } = pasang('/saya/keluar', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Keluar dari perangkat ini' }))
    expect(await screen.findByText('Anda sudah keluar. Data di perangkat ini sudah dihapus.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'sign_out_devices')[0].isi).toEqual({ p_all: false })
    expect(klien.panggilanKe('auth', 'signOut').map((p) => p.isi)).toEqual([{ scope: 'local' }])
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(localStorage.getItem('silsilah-auth')).toBeNull()
    expect(sessionStorage.getItem('silsilah-sementara')).toBeNull()
    expect(localStorage.getItem('nutrihub-lain')).toBe('milik proyek lain di alamat yang sama')
    // Pilihan tampilan bukan data keluarga: tetap ada.
    expect(localStorage.getItem('silsilah-tampilan')).toContain('besar')
    expect(hapus.mock.calls.map((c) => c[0])).toEqual(['silsilah-data'])
    expect(hapusCache.mock.calls.map((c) => c[0])).toEqual(['silsilah-v1'])
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('dari semua perangkat: semua perangkat dicabut dan semua sesi diakhiri', async () => {
    const klien = klienSudahMasuk({ rpc: { sign_out_devices: async () => OK(3), db_version: async () => OK('999') } })
    const { aksi } = pasang('/saya/keluar', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Keluar dari semua perangkat' }))
    await screen.findByText('Anda sudah keluar. Data di perangkat ini sudah dihapus.')
    expect(klien.panggilanKe('rpc', 'sign_out_devices')[0].isi).toEqual({ p_all: true })
    expect(klien.panggilanKe('auth', 'signOut').map((p) => p.isi.scope)).toEqual(['global', 'local'])
  })

  it('server tidak terjangkau: perangkat ini TETAP keluar dan datanya dihapus; perangkat lain dijelaskan', async () => {
    const klien = klienSudahMasuk({ rpc: { sign_out_devices: async () => { throw new TypeError('Failed to fetch') }, db_version: async () => OK('999') } })
    siapkanPenyimpanan()
    const { aksi } = pasang('/saya/keluar', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Keluar dari semua perangkat' }))
    expect(await screen.findByText(/Perangkat lain belum bisa dikeluarkan sekarang/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('"Batal" kembali ke menu Saya tanpa keluar', async () => {
    const klien = klienSudahMasuk()
    const { aksi } = pasang('/saya/keluar', klien)
    await aksi.click(await screen.findByRole('link', { name: 'Batal' }))
    expect(await screen.findByRole('heading', { name: 'Saya' })).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'sign_out_devices')).toEqual([])
  })
})

describe('Tambah perangkat', () => {
  const kodeBaru = (detik = 600) => async () =>
    OK({ code_id: 'k1', code: 'ABCD-2345', expires_at: new Date(Date.now() + detik * 1000).toISOString() })

  it('kode dibuat saat layar dibuka: QR + kode 8 karakter + hitung mundur 10 menit', async () => {
    const klien = klienSudahMasuk({ rpc: { create_device_code: kodeBaru(), db_version: async () => OK('999') } })
    pasang('/saya/tambah-perangkat', klien)
    expect(await screen.findByText('ABCD-2345')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'create_device_code')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Kode QR untuk menambah perangkat' })).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toMatch(/Berlaku (9|10):\d\d lagi/)
    expect(screen.getByText(/Kode hanya bisa dipakai sekali/)).toBeTruthy()
    expect(screen.getByText(/layar utama dan Safari tidak berbagi login/)).toBeTruthy()
  })

  it('label QR tidak membocorkan kode; kode tidak disimpan di perangkat', async () => {
    pasang('/saya/tambah-perangkat', klienSudahMasuk({ rpc: { create_device_code: kodeBaru(), db_version: async () => OK('999') } }))
    const qr = await screen.findByRole('img', { name: 'Kode QR untuk menambah perangkat' })
    expect(qr.getAttribute('aria-label')).not.toContain('ABCD')
    expect(JSON.stringify({ ...localStorage })).not.toContain('ABCD')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('ABCD')
  })

  it('kode habis → pesan dan tombol "Buat kode baru" yang membuat kode lain', async () => {
    let n = 0
    const klien = klienSudahMasuk({
      rpc: {
        create_device_code: async () => OK({ code_id: `k${++n}`, code: n === 1 ? 'ABCD-2345' : 'WXYZ-6789', expires_at: new Date(Date.now() + (n === 1 ? 1500 : 600000)).toISOString() }),
        db_version: async () => OK('999'),
      },
    })
    const { aksi } = pasang('/saya/tambah-perangkat', klien)
    await screen.findByText('ABCD-2345')
    expect(await screen.findByText('Kode ini sudah tidak berlaku.', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText('ABCD-2345')).toBeNull()
    await aksi.click(screen.getByRole('button', { name: 'Buat kode baru' }))
    expect(await screen.findByText('WXYZ-6789')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'create_device_code')).toHaveLength(2)
  })

  it.each([
    ['AK013', 'Fitur tambah perangkat sedang dimatikan oleh admin.'],
    ['AK014', 'Perangkat dengan akses sementara tidak bisa menambah perangkat lain.'],
  ])('ditolak server (%s) → pesan Indonesia dari server, tanpa QR', async (kode, pesan) => {
    const klien = klienSudahMasuk({ rpc: { create_device_code: async () => GALAT(kode, pesan), db_version: async () => OK('999') } })
    pasang('/saya/tambah-perangkat', klien)
    expect(await screen.findByText(pesan)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('Perangkat saya', () => {
  const perangkat = (id, sesi, ekstra = {}) => ({
    id, member_id: 'anggota-1', session_id: sesi, label: 'iPhone · Safari', device_type: 'iPhone', via: 'undangan',
    expires_at: null, approx_city: 'Kota Contoh', approx_country: 'ID', approx_country_name: 'Indonesia',
    created_at: '2026-10-01T03:00:00Z', last_seen_at: '2026-10-07T03:30:00Z', revoked_at: null, ...ekstra,
  })
  const klienDenganPerangkat = () => {
    const klien = klienSudahMasuk({
      rpc: {
        db_version: async () => OK('999'),
        revoke_device: async ({ p_device }) => {
          klien.tabel.devices.find((d) => d.id === p_device).revoked_at = '2026-10-07T04:00:00Z'
          return OK(null)
        },
      },
      tabel: {
        devices: [
          perangkat('d-ini', 'sesi-ini'),
          perangkat('d-lain', 'sesi-lain', { label: 'Laptop Windows · Chrome', device_type: 'Laptop Windows', via: 'kode', approx_city: null, approx_country: 'IT', approx_country_name: 'Italia' }),
          { ...perangkat('d-orang', 'sesi-orang'), member_id: 'anggota-lain' },
        ],
      },
    })
    return klien
  }

  it('hanya perangkat sendiri; "Perangkat ini" ditandai; lokasi selalu "sekitar" dan hanya perkiraan', async () => {
    pasang('/saya/perangkat', klienDenganPerangkat())
    expect(await screen.findByText('iPhone · Safari')).toBeTruthy()
    expect(screen.getByText('Laptop Windows · Chrome')).toBeTruthy()
    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText('Perangkat ini')).toHaveLength(1)
    expect(screen.getByText('Perkiraan lokasi: sekitar Kota Contoh, Indonesia')).toBeTruthy()
    expect(screen.getByText('Perkiraan lokasi: sekitar Italia')).toBeTruthy()
  })

  it('mencabut perangkat lain: minta kepastian, lalu hilang dari daftar', async () => {
    const klien = klienDenganPerangkat()
    const { aksi } = pasang('/saya/perangkat', klien)
    await screen.findByText('Laptop Windows · Chrome')
    const kartu = screen.getByText('Laptop Windows · Chrome').closest('section')
    await aksi.click(within(kartu).getByRole('button', { name: 'Cabut akses' }))
    expect(within(kartu).getByText('Cabut akses perangkat ini?')).toBeTruthy()
    expect(within(kartu).getByText('Perangkat itu langsung tidak bisa membuka data lagi.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'revoke_device')).toEqual([])
    await aksi.click(within(kartu).getByRole('button', { name: 'Ya, cabut' }))
    expect(await screen.findByText('Akses perangkat sudah dicabut.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'revoke_device')[0].isi).toEqual({ p_device: 'd-lain' })
    await waitFor(() => expect(screen.queryByText('Laptop Windows · Chrome')).toBeNull())
  })

  it('mencabut perangkat yang sedang dipakai → keluar dan data dihapus', async () => {
    const klien = klienDenganPerangkat()
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    const { aksi } = pasang('/saya/perangkat', klien)
    await screen.findByText('Laptop Windows · Chrome')
    const kartu = screen.getByText('Perangkat ini').closest('section')
    await aksi.click(within(kartu).getByRole('button', { name: 'Cabut akses' }))
    expect(within(kartu).getByText(/Anda akan keluar dan data di sini dihapus/)).toBeTruthy()
    await aksi.click(within(kartu).getByRole('button', { name: 'Ya, cabut' }))
    expect(await screen.findByText('Anda sudah keluar. Data di perangkat ini sudah dihapus.')).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
  })

  it('"Batal" tidak mencabut apa pun', async () => {
    const klien = klienDenganPerangkat()
    const { aksi } = pasang('/saya/perangkat', klien)
    await screen.findByText('Laptop Windows · Chrome')
    const kartu = screen.getByText('Laptop Windows · Chrome').closest('section')
    await aksi.click(within(kartu).getByRole('button', { name: 'Cabut akses' }))
    await aksi.click(within(kartu).getByRole('button', { name: 'Batal' }))
    expect(within(kartu).queryByText('Cabut akses perangkat ini?')).toBeNull()
    expect(klien.panggilanKe('rpc', 'revoke_device')).toEqual([])
  })
})

describe('Privasi', () => {
  it('bisa dibuka tanpa login, tidak memanggil server sama sekali, dan tidak memuat data keluarga', async () => {
    const klien = klienSudahMasuk()
    klien.keadaan.sesi = null
    pasang('/privasi', klien)
    expect(await screen.findByRole('heading', { name: 'Privasi' })).toBeTruthy()
    await new Promise((r) => setTimeout(r, 30))
    expect(klien.functions.invoke).not.toHaveBeenCalled()
    expect(klien.rpc).not.toHaveBeenCalled()
    expect(klien.from).not.toHaveBeenCalled()
  })

  it('menjelaskan lokasi (perkiraan, tanpa GPS), IP 30 hari, penghapusan data, dan atribusi DB-IP', async () => {
    pasang('/privasi', klienSudahMasuk())
    await screen.findByRole('heading', { name: 'Privasi' })
    const isi = document.body.textContent
    expect(isi).toContain('Tidak ada GPS')
    expect(isi).toContain('tidak pernah meminta izin lokasi saat masuk')
    expect(isi).toContain('dihapus otomatis setelah 30 hari')
    expect(isi).toContain('tidak dikirim ke layanan lain')
    expect(isi).toContain('semua data aplikasi di perangkat itu dihapus')
    expect(isi).toContain('data DB-IP (db-ip.com), lisensi CC BY 4.0')
    const tautan = screen.getByRole('link', { name: /Buka situs DB-IP/ })
    expect(tautan.getAttribute('href')).toBe('https://db-ip.com')
    expect(tautan.getAttribute('rel')).toContain('noopener')
  })

  it('sesudah masuk tetap bisa dibuka dari menu Saya', async () => {
    const { aksi } = pasang('/saya', klienSudahMasuk())
    await screen.findByRole('heading', { name: 'Saya' })
    await aksi.click(screen.getByRole('link', { name: 'Privasi' }))
    expect(await screen.findByRole('heading', { name: 'Privasi' })).toBeTruthy()
  })
})
