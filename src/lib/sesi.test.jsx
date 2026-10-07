// @vitest-environment jsdom
// Tes pengelola sesi lewat aplikasi UTUH: apa yang terjadi saat aplikasi
// dibuka dengan berbagai keadaan perangkat. Semua data FIKTIF.
import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import { lokasiSaatIni, pasang } from '../test/pembantu.jsx'
import { OK, anggotaContoh, buatKlienTiruan, klienSudahMasuk, tokenTiruan } from '../test/klienTiruan.js'

const sesiAda = { access_token: tokenTiruan('sesi-ini'), user: { id: 'akun-contoh' } }
const klienDenganCek = (cek, tambahan = {}) =>
  buatKlienTiruan({
    sesi: sesiAda,
    fungsi: { 'cek-perangkat': cek },
    rpc: { db_version: async () => OK('999') },
    tabel: { members: [anggotaContoh] },
    ...tambahan,
  })
const galatFungsi = (nama, status, pesan = 'Edge Function returned a non-2xx status code') => ({
  data: null,
  error: Object.assign(new Error(pesan), { name: nama, context: { status } }),
})

describe('saat aplikasi dibuka', () => {
  it('belum ada sesi → layar Masuk (rute yang butuh login diarahkan ke sana)', async () => {
    const klien = buatKlienTiruan({})
    pasang('/saya', klien)
    expect(await screen.findByRole('heading', { name: 'Silsilah Keluarga' })).toBeTruthy()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
    expect(klien.functions.invoke).not.toHaveBeenCalled()
  })

  it('sesi ada dan perangkat sah → Beranda dengan nama anggota; nama diambil dari baris milik sendiri', async () => {
    const klien = klienDenganCek(async () => OK({ ok: true, status: 'ok', berakhir: null }))
    pasang('/', klien)
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
    expect(klien.panggilanKe('fungsi', 'cek-perangkat')).toHaveLength(1)
  })

  it('perangkat DICABUT → data dihapus dan layar Masuk dengan penjelasan', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    const klien = klienDenganCek(async () => OK({ ok: true, status: 'dicabut', berakhir: null }))
    pasang('/', klien)
    expect(await screen.findByText(/Akses perangkat ini sudah dicabut/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
    expect(klien.panggilanKe('auth', 'signOut')).toHaveLength(1)
    expect(klien.panggilanKe('tabel', 'members')).toEqual([])
  })

  it('akses sementara sudah lewat → data dihapus dan pesan "akses sementara berakhir"', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    pasang('/', klienDenganCek(async () => OK({ ok: true, status: 'kedaluwarsa', berakhir: null })))
    expect(await screen.findByText(/Akses sementara Anda sudah berakhir/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
  })

  it('sesi tanpa perangkat terdaftar → keluar tanpa pesan menakutkan', async () => {
    const klien = klienDenganCek(async () => OK({ ok: true, status: 'tidak_terdaftar', berakhir: null }))
    pasang('/', klien)
    expect(await screen.findByRole('heading', { name: 'Silsilah Keluarga' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(klien.panggilanKe('auth', 'signOut')).toHaveLength(1)
  })

  it('token ditolak server (401) → "Sesi berakhir", data dihapus', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    pasang('/', klienDenganCek(async () => galatFungsi('FunctionsHttpError', 401)))
    expect(await screen.findByText(/Sesi Anda berakhir/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
  })

  it('tanpa internet → layar "Tidak ada koneksi"; data TIDAK dihapus; "Coba lagi" memeriksa ulang', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    let n = 0
    const klien = klienDenganCek(async () => (++n === 1
      ? { data: null, error: Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }) }
      : OK({ ok: true, status: 'ok', berakhir: null })))
    const { aksi } = pasang('/', klien)
    expect(await screen.findByRole('button', { name: 'Coba lagi' })).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBe('data')
    expect(klien.panggilanKe('auth', 'signOut')).toEqual([])
    await aksi.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
  })

  it('project dijeda (540) → "Aplikasi sedang dipulihkan"', async () => {
    pasang('/', klienDenganCek(async () => galatFungsi('FunctionsHttpError', 540)))
    expect(await screen.findByRole('heading', { name: 'Aplikasi sedang dipulihkan' })).toBeTruthy()
  })

  it('database belum diperbarui (versi lama) → "Database belum diperbarui", tanpa membaca data', async () => {
    const klien = klienDenganCek(async () => OK({ ok: true, status: 'ok', berakhir: null }), {
      rpc: { db_version: async () => OK('008') },
    })
    pasang('/', klien)
    expect(await screen.findByRole('heading', { name: 'Database belum diperbarui' })).toBeTruthy()
    expect(klien.panggilanKe('tabel', 'members')).toEqual([])
  })

  it('anggota yang bisa melihat semua anggota tetap mendapat baris miliknya sendiri', async () => {
    const klien = klienDenganCek(async () => OK({ ok: true, status: 'ok', berakhir: null }), {
      tabel: { members: [
        { id: 'a-0', auth_user_id: 'akun-lain', display_name: 'Orang Lain Contoh', role: 'anggota', is_owner: false, permissions: [] },
        anggotaContoh,
        { id: 'a-2', auth_user_id: 'akun-lain-2', display_name: 'Orang Ketiga Contoh', role: 'anggota', is_owner: false, permissions: [] },
      ] },
    })
    pasang('/', klien)
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
  })

  it('keluar dari tab lain (SIGNED_OUT) → data di tab ini juga dihapus', async () => {
    localStorage.setItem('silsilah-salinan-contoh', 'data')
    const klien = klienSudahMasuk()
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    await act(async () => { klien.keadaan.pendengar.forEach((f) => f('SIGNED_OUT', null)) })
    expect(await screen.findByText(/Sesi Anda berakhir/)).toBeTruthy()
    expect(localStorage.getItem('silsilah-salinan-contoh')).toBeNull()
  })

  it('layar Masuk tidak bisa dibuka lagi kalau sudah masuk', async () => {
    pasang('/masuk', klienSudahMasuk())
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
    expect(lokasiSaatIni.pathname).toBe('/')
  })
})
