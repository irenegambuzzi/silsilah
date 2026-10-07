// @vitest-environment jsdom
// Verifikasi dua langkah admin utama (langkah 1.19): gerbang layar admin,
// pendaftaran authenticator, kode, dan pengelolaan authenticator. Aplikasi
// UTUH + klien tiruan; semua nama dan data FIKTIF.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { pasang } from '../test/pembantu.jsx'
import { GALAT, OK, anggotaContoh, klienSudahMasuk } from '../test/klienTiruan.js'

afterEach(() => vi.restoreAllMocks())

const pemilik = { ...anggotaContoh, display_name: 'Admin Utama Contoh', is_owner: true }
const asisten = { ...anggotaContoh, display_name: 'Asisten Contoh', role: 'asisten', permissions: ['akses_sementara'] }
const UTAMA = { id: 'f-1', friendly_name: 'Utama' }
const CADANGAN = { id: 'f-2', friendly_name: 'Cadangan' }
const UUID = '0b7e4e10-6c3a-4c8e-9a52-3f1d2b8c7a11'

function klienAdmin({ anggota = pemilik, mfa, rpc = {}, notifications = [] } = {}) {
  return klienSudahMasuk({
    mfa,
    rpc: {
      db_version: async () => OK('999'),
      record_second_factor: async () => OK({ aal: 'aal2', perubahan: 0 }),
      member_names: async () => OK([{ id: 'm-1', display_name: 'Bu Peminjam Contoh', person_id: 'p-1' }]),
      list_temp_access: async () => OK([]),
      revoke_device: async () => OK(null),
      ...rpc,
    },
    tabel: { members: [anggota], settings: [{ temp_access_max_minutes: 1440 }], notifications },
  })
}
const panggilanAdmin = (klien) => [...klien.panggilanKe('rpc', 'list_temp_access'), ...klien.panggilanKe('rpc', 'member_names')]
const ketikKode = async (aksi, kode) => {
  const isian = screen.getByLabelText('Kode 6 angka')
  await aksi.clear(isian)
  await aksi.type(isian, kode)
  await aksi.click(screen.getByRole('button', { name: 'Verifikasi' }))
}

describe('gerbang layar admin', () => {
  it('admin utama tanpa aal2: layar verifikasi, layar admin TIDAK memanggil server', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal1', faktor: [UTAMA] } })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByRole('heading', { name: 'Masukkan kode verifikasi dulu' })).toBeTruthy()
    expect(screen.getByText(/Layar ini khusus admin utama/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Beri akses sementara' })).toBeNull()
    expect(screen.queryByLabelText('Untuk siapa?')).toBeNull()
    await new Promise((r) => setTimeout(r, 30))
    expect(panggilanAdmin(klien)).toEqual([])
  })

  it('kode salah → pesan Indonesia, tetap terkunci; kode benar → layar admin terbuka dan dicatat', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal1', faktor: [UTAMA] } })
    const { aksi } = pasang('/admin/akses-sementara', klien)
    await screen.findByLabelText('Kode 6 angka')
    await ketikKode(aksi, '000000')
    expect(await screen.findByText(/^Kode salah\. Masukkan kode 6 angka/)).toBeTruthy()
    expect(screen.queryByText(/Invalid/)).toBeNull()
    expect(panggilanAdmin(klien)).toEqual([])
    expect(screen.getByLabelText('Kode 6 angka').value).toBe('')

    await ketikKode(aksi, '123456')
    expect(await screen.findByRole('heading', { name: 'Beri akses sementara' })).toBeTruthy()
    expect(klien.panggilanKe('mfa', 'challengeAndVerify').at(-1).isi).toEqual({ factorId: 'f-1', code: '123456' })
    await waitFor(() => expect(klien.panggilanKe('rpc', 'list_temp_access').length).toBeGreaterThan(0))
    expect(klien.panggilanKe('rpc', 'record_second_factor')).toHaveLength(1)
  })

  it('isian kode hanya menerima 6 angka; tombol mati sebelum lengkap', async () => {
    const { aksi } = pasang('/admin/akses-sementara', klienAdmin({ mfa: { faktor: [UTAMA] } }))
    const isian = await screen.findByLabelText('Kode 6 angka')
    expect(isian.getAttribute('autocomplete')).toBe('one-time-code')
    expect(isian.getAttribute('inputmode')).toBe('numeric')
    await aksi.type(isian, '12a 3-45')
    expect(isian.value).toBe('12345')
    expect(screen.getByRole('button', { name: 'Verifikasi' }).disabled).toBe(true)
    await aksi.type(isian, '6789')
    expect(isian.value).toBe('123456')
    expect(screen.getByRole('button', { name: 'Verifikasi' }).disabled).toBe(false)
  })

  it('dua authenticator: bisa memilih yang dipakai', async () => {
    const klien = klienAdmin({ mfa: { faktor: [UTAMA, CADANGAN] } })
    const { aksi } = pasang('/admin/akses-sementara', klien)
    await aksi.selectOptions(await screen.findByLabelText('Authenticator yang dipakai'), 'f-2')
    await ketikKode(aksi, '123456')
    await screen.findByRole('heading', { name: 'Beri akses sementara' })
    expect(klien.panggilanKe('mfa', 'challengeAndVerify')[0].isi.factorId).toBe('f-2')
  })

  it('admin utama yang sudah aal2: langsung layar admin', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA] } })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByRole('heading', { name: 'Beri akses sementara' })).toBeTruthy()
    expect(screen.queryByLabelText('Kode 6 angka')).toBeNull()
  })

  it('asisten: langsung layar admin, status dua langkah tidak pernah dibaca', async () => {
    const klien = klienAdmin({ anggota: asisten })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByRole('heading', { name: 'Beri akses sementara' })).toBeTruthy()
    expect(klien.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled()
    expect(klien.auth.mfa.listFactors).not.toHaveBeenCalled()
  })

  it('status tidak bisa dibaca → tetap terkunci, dengan "Coba lagi"', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA], gagal: { getAuthenticatorAssuranceLevel: { message: 'Failed to fetch' } } } })
    const { aksi } = pasang('/admin/akses-sementara', klien)
    expect(await screen.findByText('Status verifikasi dua langkah belum bisa dibaca.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Beri akses sementara' })).toBeNull()
    klien.keadaan.mfa.gagal = {}
    await aksi.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByRole('heading', { name: 'Beri akses sementara' })).toBeTruthy()
  })
})

describe('mendaftarkan authenticator', () => {
  it('belum ada: QR + kunci, kode pertama → terdaftar dan layar admin terbuka; kunci tidak disimpan di perangkat', async () => {
    const klien = klienAdmin({ mfa: { faktor: [] } })
    const { aksi } = pasang('/admin/akses-sementara', klien)
    expect(await screen.findByText(/Belum ada aplikasi authenticator yang terdaftar/)).toBeTruthy()
    await aksi.click(screen.getByRole('button', { name: 'Daftarkan aplikasi authenticator' }))

    expect(await screen.findByRole('img', { name: 'Kode QR untuk aplikasi authenticator' })).toBeTruthy()
    expect(screen.getByText('KUNC ITIR UANR AHAS IA23 4567')).toBeTruthy()
    expect(klien.panggilanKe('mfa', 'enroll')[0].isi).toEqual({ factorType: 'totp', friendlyName: 'Utama', issuer: 'Silsilah Keluarga' })
    expect(screen.getByRole('img', { name: 'Kode QR untuk aplikasi authenticator' }).getAttribute('aria-label')).not.toContain('KUNCI')

    await ketikKode(aksi, '123456')
    expect(await screen.findByRole('heading', { name: 'Beri akses sementara' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('KUNC')
    const tersimpan = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(tersimpan).not.toContain('KUNCITIRUAN')
    expect(klien.panggilanKe('rpc', 'record_second_factor')).toHaveLength(1)
  })

  it('pendaftaran lama yang tidak selesai dibersihkan dulu', async () => {
    const klien = klienAdmin({ mfa: { faktor: [{ id: 'f-lama', friendly_name: 'Utama', status: 'unverified' }] } })
    const { aksi } = pasang('/saya/dua-langkah', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Daftarkan aplikasi authenticator' }))
    await screen.findByRole('img', { name: 'Kode QR untuk aplikasi authenticator' })
    expect(klien.panggilanKe('mfa', 'unenroll')[0].isi).toEqual({ factorId: 'f-lama' })
    expect(klien.panggilanKe('mfa', 'enroll')).toHaveLength(1)
  })

  it('TOTP belum diaktifkan di Supabase → pesan Indonesia yang menunjukkan tempatnya', async () => {
    const klien = klienAdmin({ mfa: { faktor: [], gagal: { enroll: { code: 'mfa_totp_enroll_not_enabled', message: 'MFA enroll is disabled for TOTP', status: 422 } } } })
    const { aksi } = pasang('/saya/dua-langkah', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Daftarkan aplikasi authenticator' }))
    expect(await screen.findByText(/belum diaktifkan di pengaturan Supabase: Authentication, lalu Multi-Factor/)).toBeTruthy()
  })

  it('"Batal" menutup pendaftaran', async () => {
    const { aksi } = pasang('/saya/dua-langkah', klienAdmin({ mfa: { faktor: [] } }))
    await aksi.click(await screen.findByRole('button', { name: 'Daftarkan aplikasi authenticator' }))
    await screen.findByRole('img', { name: 'Kode QR untuk aplikasi authenticator' })
    await aksi.click(screen.getByRole('button', { name: 'Batal' }))
    expect(screen.queryByRole('img', { name: 'Kode QR untuk aplikasi authenticator' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Daftarkan aplikasi authenticator' })).toBeTruthy()
  })
})

describe('layar Verifikasi dua langkah (menu Saya)', () => {
  it('aktif: daftar authenticator, saran cadangan, dan cara kalau HP hilang', async () => {
    pasang('/saya/dua-langkah', klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA] } }))
    expect(await screen.findByText('Aktif: perangkat ini sudah terverifikasi dua langkah.')).toBeTruthy()
    expect(screen.getByText('Utama')).toBeTruthy()
    expect(screen.getByText(/daftarkan juga authenticator cadangan/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Kalau HP atau aplikasi authenticator hilang' })).toBeTruthy()
    expect(screen.getByText(/prosedur darurat \(lihat README\)/)).toBeTruthy()
  })

  it('tambah cadangan → nama "Cadangan"', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA] } })
    const { aksi } = pasang('/saya/dua-langkah', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Tambah authenticator cadangan' }))
    await screen.findByRole('img', { name: 'Kode QR untuk aplikasi authenticator' })
    expect(klien.panggilanKe('mfa', 'enroll')[0].isi.friendlyName).toBe('Cadangan')
    await ketikKode(aksi, '123456')
    expect(await screen.findByText('Authenticator berhasil didaftarkan. Perangkat ini sudah terverifikasi.')).toBeTruthy()
    expect(screen.getByText('Cadangan')).toBeTruthy()
    expect(screen.queryByText(/daftarkan juga authenticator cadangan/)).toBeNull()
  })

  it('hapus: dengan konfirmasi; peringatan khusus untuk authenticator terakhir', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA, CADANGAN] } })
    const { aksi } = pasang('/saya/dua-langkah', klien)
    const kartu = (await screen.findByText('Cadangan')).closest('section')
    await aksi.click(within(kartu).getByRole('button', { name: 'Hapus' }))
    expect(within(kartu).getByText('Hapus authenticator "Cadangan"?')).toBeTruthy()
    expect(klien.panggilanKe('mfa', 'unenroll')).toEqual([])
    await aksi.click(within(kartu).getByRole('button', { name: 'Ya, hapus' }))
    expect(await screen.findByText('Authenticator sudah dihapus.')).toBeTruthy()
    expect(klien.panggilanKe('mfa', 'unenroll')[0].isi).toEqual({ factorId: 'f-2' })
    expect(klien.panggilanKe('rpc', 'record_second_factor')).toHaveLength(1)

    const terakhir = screen.getByText('Utama').closest('section')
    await aksi.click(within(terakhir).getByRole('button', { name: 'Hapus' }))
    expect(within(terakhir).getByText(/Ini authenticator terakhir/)).toBeTruthy()
    await aksi.click(within(terakhir).getByRole('button', { name: 'Batal' }))
    expect(klien.panggilanKe('mfa', 'unenroll')).toHaveLength(1)
  })

  it('bukan admin utama → hanya pesan, tanpa membaca status', async () => {
    const klien = klienAdmin({ anggota: asisten })
    pasang('/saya/dua-langkah', klien)
    expect(await screen.findByText('Verifikasi dua langkah hanya untuk admin utama.')).toBeTruthy()
    expect(klien.auth.mfa.listFactors).not.toHaveBeenCalled()
  })
})

describe('menu Saya dan kotak masuk', () => {
  it.each([
    ['admin utama tanpa aal2', pemilik, 'aal1', /belum di perangkat ini/],
    ['admin utama dengan aal2', pemilik, 'aal2', /aktif di perangkat ini/],
  ])('%s: tautan dan status', async (_n, anggota, level, status) => {
    pasang('/saya', klienAdmin({ anggota, mfa: { level, faktor: [UTAMA] } }))
    expect(await screen.findByRole('link', { name: 'Verifikasi dua langkah' })).toBeTruthy()
    expect(screen.getByText(status)).toBeTruthy()
  })

  it('anggota lain: tidak ada tautan verifikasi dua langkah', async () => {
    pasang('/saya', klienAdmin({ anggota: asisten }))
    await screen.findByRole('heading', { name: 'Saya' })
    expect(screen.queryByRole('link', { name: 'Verifikasi dua langkah' })).toBeNull()
  })

  const curiga = { id: 7, kind: 'login_mencurigakan', title: 'Login mencurigakan: Pak Jauh Contoh', body: 'Contoh.', priority: 'penting', link: `#/admin/perangkat?cabut=${UUID}`, created_at: '2026-10-07T07:05:00Z', read_at: null }

  it('kotak masuk, admin utama tanpa aal2: "Cabut perangkat ini" diganti tautan verifikasi', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal1', faktor: [UTAMA] }, notifications: [curiga] })
    pasang('/kotak-masuk', klien)
    expect(await screen.findByRole('link', { name: 'Verifikasi dua langkah dulu untuk mencabut' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cabut perangkat ini' })).toBeNull()
  })

  it('kotak masuk, admin utama dengan aal2: tombol cabut tersedia', async () => {
    const klien = klienAdmin({ mfa: { level: 'aal2', faktor: [UTAMA] }, notifications: [curiga] })
    pasang('/kotak-masuk', klien)
    expect(await screen.findByRole('button', { name: 'Cabut perangkat ini' })).toBeTruthy()
  })
})

describe('server tetap penjaga terakhir', () => {
  it('kalau server menolak (sesi tidak aal2), layar menampilkan petunjuk, bukan data', async () => {
    const klien = klienAdmin({
      mfa: { level: 'aal2', faktor: [UTAMA] },
      rpc: { list_temp_access: async () => GALAT('AK016', 'Anda tidak punya izin memberi akses sementara.') },
    })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByText(/Server meminta verifikasi dua langkah lagi/)).toBeTruthy()
  })
})
