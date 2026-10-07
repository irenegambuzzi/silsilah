// @vitest-environment jsdom
// Mode contoh: alur yang dicoba pemilik lewat "npm run dev:contoh", dengan
// aplikasi UTUH dan server tiruan di memori. Semua data FIKTIF.
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { pasang, lokasiSaatIni } from '../test/pembantu.jsx'
import { buatKlienContoh } from './klienContoh.js'

const tokenDengan = (huruf) => huruf.repeat(43)

describe('mode contoh', () => {
  it('link berhasil → sapaan → tips → beranda; perangkat terdaftar dan terlihat di Perangkat saya', async () => {
    const { aksi } = pasang(`/u/${tokenDengan('A')}`, buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByRole('heading', { name: 'Selamat datang, Bu Contoh!' })
    await aksi.click(screen.getByRole('button', { name: 'Ya, ini saya' }))
    await aksi.click(await screen.findByRole('button', { name: 'Mulai memakai aplikasi' }))
    await screen.findByText('Halo, Bu Contoh')
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await aksi.click(await screen.findByRole('link', { name: 'Perangkat saya' }))
    expect(await screen.findByText('Laptop Windows · Chrome')).toBeTruthy()
    expect(screen.getByText('Perangkat ini')).toBeTruthy()
  })

  it.each([
    ['B', /sudah dipakai/], ['C', /kedaluwarsa/], ['E', /sudah dibatalkan/], ['D', /Server sedang bermasalah/],
  ])('link berawalan %s → pesan yang sesuai', async (huruf, pesan) => {
    const { aksi } = pasang(`/u/${tokenDengan(huruf)}`, buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText(pesan)).toBeTruthy()
  })

  it('kode ABCD2345 masuk; kode lain ditolak', async () => {
    const { aksi } = pasang('/masuk', buatKlienContoh({ jeda: 0 }))
    const isian = await screen.findByLabelText('Kode (8 huruf dan angka)')
    await aksi.type(isian, 'SALAH999')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    expect(await screen.findByText(/Kode salah/)).toBeTruthy()
    await aksi.clear(isian)
    await aksi.type(isian, 'abcd2345')
    await aksi.click(screen.getByRole('button', { name: 'Masuk dengan kode' }))
    expect(await screen.findByText('Halo, Bu Contoh')).toBeTruthy()
  })

  it('Tambah perangkat membuat kode, yang bisa dipakai untuk masuk di perangkat lain', async () => {
    const klien = buatKlienContoh({ jeda: 0 })
    const { aksi } = pasang('/kode/ABCD2345', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Bu Contoh')
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await aksi.click(await screen.findByRole('link', { name: 'Tambah perangkat' }))
    const kode = (await screen.findByRole('timer')).previousElementSibling.textContent
    expect(kode).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
    const hasil = await klien.functions.invoke('pakai-kode', { body: { kode } })
    expect(hasil.data).toMatchObject({ ok: true, via: 'kode' })
  })

  it('keluar menghapus sesi contoh; membuka lagi → layar Masuk', async () => {
    const { aksi } = pasang('/kode/ABCD2345', buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Bu Contoh')
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await aksi.click(await screen.findByRole('link', { name: 'Keluar' }))
    await aksi.click(await screen.findByRole('button', { name: 'Keluar dari perangkat ini' }))
    expect(await screen.findByText(/Anda sudah keluar/)).toBeTruthy()
    expect(lokasiSaatIni.pathname).toBe('/masuk')
    expect(localStorage.getItem('silsilah-contoh-keadaan')).toBeNull()
  })
})

describe('mode contoh: akses sementara dan pengurus', () => {
  it('kode AKSES234 → spanduk hitung mundur dan tanpa "Tambah perangkat"', async () => {
    const { aksi } = pasang('/kode/AKSES234', buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Bu Contoh')
    expect(screen.getByRole('timer').textContent).toMatch(/Akses sementara berakhir pukul \d\d\.\d\d\. Sisa waktu: (29|30) menit\./)
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await screen.findByRole('heading', { name: 'Saya' })
    expect(screen.queryByRole('link', { name: 'Tambah perangkat' })).toBeNull()
  })

  it('kode PENGURUS → kotak masuk berisi contoh pemberitahuan, dan "Cabut perangkat ini" bekerja', async () => {
    const { aksi } = pasang('/kode/PENGURUS', buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Pak Pengurus Contoh')
    await aksi.click(screen.getByRole('link', { name: /Kotak masuk/ }))
    expect(await screen.findByRole('heading', { name: 'Login mencurigakan: Pak Jauh Contoh' })).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Cabut perangkat ini' }))
    expect(await screen.findByText('Perangkat itu sudah dicabut.')).toBeTruthy()
  })

  it('pengurus membuat kode akses sementara, dan kode itu bisa dipakai di perangkat lain', async () => {
    const klien = buatKlienContoh({ jeda: 0 })
    const { aksi } = pasang('/kode/PENGURUS', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Pak Pengurus Contoh')
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await aksi.click(await screen.findByRole('link', { name: 'Beri akses sementara' }))
    await aksi.selectOptions(await screen.findByLabelText('Untuk siapa?'), 'anggota-contoh')
    await aksi.click(screen.getByRole('button', { name: 'Buat kode' }))
    const kode = (await screen.findByText(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)).textContent
    expect((await screen.findAllByText(/Kode belum dipakai/)).length).toBeGreaterThan(0)
    const hasil = await klien.functions.invoke('pakai-kode', { body: { kode } })
    expect(hasil.data).toMatchObject({ ok: true, via: 'sementara', menit: 60, nama: 'Bu Contoh' })
  })

  it('anggota biasa tidak melihat pemberitahuan pengurus maupun menu akses sementara', async () => {
    const { aksi } = pasang('/kode/ABCD2345', buatKlienContoh({ jeda: 0 }))
    await aksi.click(await screen.findByRole('button', { name: 'Masuk' }))
    await screen.findByText('Halo, Bu Contoh')
    await aksi.click(screen.getByRole('link', { name: 'Kotak masuk' }))
    expect(await screen.findByText('Belum ada pemberitahuan.')).toBeTruthy()
    await aksi.click(screen.getByRole('link', { name: 'Saya' }))
    await screen.findByRole('heading', { name: 'Saya' })
    expect(screen.queryByRole('link', { name: 'Beri akses sementara' })).toBeNull()
  })
})
