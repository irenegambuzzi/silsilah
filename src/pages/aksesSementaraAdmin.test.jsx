// @vitest-environment jsdom
// Layar pengurus "Beri akses sementara" dan kotak masuk admin. Aplikasi UTUH +
// klien tiruan; semua nama dan data FIKTIF.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { pasang } from '../test/pembantu.jsx'
import { GALAT, OK, anggotaContoh, klienSudahMasuk } from '../test/klienTiruan.js'

afterEach(() => vi.restoreAllMocks())

const asisten = { ...anggotaContoh, display_name: 'Asisten Contoh', role: 'asisten', permissions: ['akses_sementara'] }
const pemilik = { ...anggotaContoh, display_name: 'Admin Utama Contoh', is_owner: true }
const NAMA = [
  { id: 'm-1', display_name: 'Bu Peminjam Contoh', person_id: 'p-1' },
  { id: 'm-2', display_name: 'Pak Lain Contoh', person_id: 'p-2' },
]
const jamDepan = (menit) => new Date(Date.now() + menit * 60000).toISOString()

function klienPengurus({ anggota = asisten, rpc = {}, tabel = {}, batas = 1440 } = {}) {
  const klien = klienSudahMasuk({
    rpc: {
      db_version: async () => OK('999'),
      member_names: async () => OK(NAMA),
      list_temp_access: async () => OK(klien.daftar),
      create_temp_access_code: async ({ p_minutes }) =>
        OK({ code_id: 'k1', code: 'ABCD-2345', expires_at: jamDepan(10), access_minutes: p_minutes }),
      revoke_temp_access: async ({ p_device }) => {
        klien.daftar = klien.daftar.filter((d) => d.id !== p_device)
        return OK(null)
      },
      ...rpc,
    },
    tabel: { members: [anggota], settings: [{ temp_access_max_minutes: batas }], ...tabel },
  })
  klien.daftar = []
  return klien
}

describe('menu Saya', () => {
  it.each([
    ['asisten dengan izin', asisten, true],
    ['admin utama', pemilik, true],
    ['anggota biasa', anggotaContoh, false],
    ['asisten tanpa izin itu', { ...asisten, permissions: ['bendahara'] }, false],
  ])('%s: tautan "Beri akses sementara" %s', async (_n, anggota, tampil) => {
    pasang('/saya', klienPengurus({ anggota }))
    await screen.findByRole('heading', { name: 'Saya' })
    expect(!!screen.queryByRole('link', { name: 'Beri akses sementara' })).toBe(tampil)
  })
})

describe('layar Beri akses sementara', () => {
  it('anggota tanpa izin: pesan, dan tidak ada panggilan data ke server', async () => {
    const klien = klienPengurus({ anggota: anggotaContoh })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByText('Anda tidak punya izin memberi akses sementara.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'list_temp_access')).toEqual([])
    expect(klien.panggilanKe('rpc', 'member_names')).toEqual([])
  })

  it('pilih nama dan lama → kode, QR, dan hitung mundur 10 menit; kode tidak membocor ke label QR', async () => {
    const klien = klienPengurus()
    const { aksi } = pasang('/admin/akses-sementara', klien)
    const tombol = await screen.findByRole('button', { name: 'Buat kode' })
    expect(tombol.disabled).toBe(true)
    await aksi.selectOptions(screen.getByLabelText('Untuk siapa?'), 'm-1')
    await aksi.selectOptions(screen.getByLabelText('Berapa lama?'), '120')
    await aksi.click(screen.getByRole('button', { name: 'Buat kode' }))
    expect(await screen.findByText('ABCD-2345')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'create_temp_access_code')[0].isi).toEqual({ p_member: 'm-1', p_minutes: 120 })
    expect(screen.getByRole('heading', { name: 'Kode untuk Bu Peminjam Contoh' })).toBeTruthy()
    expect(screen.getByText(/Berikan kode ini kepada Bu Peminjam Contoh/).textContent).toMatch(/Kode berlaku (9|10):\d\d lagi\. Setelah dipakai, akses berlangsung 2 jam\./)
    const qr = screen.getByRole('img', { name: 'Kode QR untuk akses sementara' })
    expect(qr.getAttribute('aria-label')).not.toContain('ABCD')
    expect(JSON.stringify({ ...localStorage })).not.toContain('ABCD')
  })

  it('pilihan lama dibatasi oleh pengaturan admin', async () => {
    pasang('/admin/akses-sementara', klienPengurus({ batas: 120 }))
    const pilihan = await screen.findByLabelText('Berapa lama?')
    expect([...pilihan.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['30 menit', '1 jam', '2 jam'])
  })

  it('"Buat kode lain" kembali ke formulir', async () => {
    const { aksi } = pasang('/admin/akses-sementara', klienPengurus())
    await aksi.selectOptions(await screen.findByLabelText('Untuk siapa?'), 'm-2')
    await aksi.click(screen.getByRole('button', { name: 'Buat kode' }))
    await screen.findByText('ABCD-2345')
    await aksi.click(screen.getByRole('button', { name: 'Buat kode lain' }))
    expect(screen.queryByText('ABCD-2345')).toBeNull()
    expect(screen.getByLabelText('Untuk siapa?').value).toBe('')
  })

  it('daftar: akses yang berjalan dan kode yang belum dipakai; yang berjalan bisa diakhiri setelah konfirmasi', async () => {
    const klien = klienPengurus()
    klien.daftar = [
      { kind: 'aktif', id: 'd-1', member_id: 'm-1', display_name: 'Bu Peminjam Contoh', label: 'Laptop Windows · Chrome', expires_at: jamDepan(45), access_minutes: null },
      { kind: 'menunggu', id: 'k-9', member_id: 'm-2', display_name: 'Pak Lain Contoh', label: null, expires_at: jamDepan(7), access_minutes: 90 },
    ]
    const { aksi } = pasang('/admin/akses-sementara', klien)
    const aktif = (await screen.findByText('Laptop Windows · Chrome')).closest('section')
    expect(within(aktif).getByText('Bu Peminjam Contoh')).toBeTruthy()
    expect(within(aktif).getByText(/^Berakhir pukul \d\d\.\d\d$/)).toBeTruthy()
    const menunggu = screen.getByText('Pak Lain Contoh', { selector: 'p' }).closest('section')
    expect(menunggu.textContent).toMatch(/Kode belum dipakai, berlaku sampai pukul \d\d\.\d\d \(90 menit\)/)
    expect(within(menunggu).queryByRole('button')).toBeNull()

    await aksi.click(within(aktif).getByRole('button', { name: 'Akhiri sekarang' }))
    expect(within(aktif).getByText('Akhiri akses Bu Peminjam Contoh?')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'revoke_temp_access')).toEqual([])
    await aksi.click(within(aktif).getByRole('button', { name: 'Ya, akhiri' }))
    expect(await screen.findByText('Akses sudah diakhiri.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'revoke_temp_access')[0].isi).toEqual({ p_device: 'd-1' })
    await waitFor(() => expect(screen.queryByText('Laptop Windows · Chrome')).toBeNull())
  })

  it('"Batal" tidak mengakhiri apa pun', async () => {
    const klien = klienPengurus()
    klien.daftar = [{ kind: 'aktif', id: 'd-1', member_id: 'm-1', display_name: 'Bu Peminjam Contoh', label: 'Laptop', expires_at: jamDepan(45), access_minutes: null }]
    const { aksi } = pasang('/admin/akses-sementara', klien)
    const kartu = (await screen.findByText('Laptop')).closest('section')
    await aksi.click(within(kartu).getByRole('button', { name: 'Akhiri sekarang' }))
    await aksi.click(within(kartu).getByRole('button', { name: 'Batal' }))
    expect(klien.panggilanKe('rpc', 'revoke_temp_access')).toEqual([])
    expect(within(kartu).queryByText(/Akhiri akses/)).toBeNull()
  })

  it.each([
    ['AK009', 'Durasi akses sementara melebihi batas yang diatur admin.'],
    ['AK017', 'Link dan kode untuk admin utama atau asisten hanya bisa dibuat oleh admin utama.'],
    ['AK012', 'Akses anggota ini sudah dicabut. Admin utama perlu mengaktifkannya dulu.'],
  ])('ditolak server (%s) → pesan Indonesia, tanpa kode', async (kode, pesan) => {
    const klien = klienPengurus({ rpc: { create_temp_access_code: async () => GALAT(kode, pesan) } })
    const { aksi } = pasang('/admin/akses-sementara', klien)
    await aksi.selectOptions(await screen.findByLabelText('Untuk siapa?'), 'm-1')
    await aksi.click(screen.getByRole('button', { name: 'Buat kode' }))
    expect(await screen.findByText(pesan)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('admin utama tanpa verifikasi dua langkah: penjelasan khusus (bukan "tidak punya izin")', async () => {
    const klien = klienPengurus({ anggota: pemilik, rpc: { list_temp_access: async () => GALAT('AK016', 'Anda tidak punya izin memberi akses sementara.') } })
    pasang('/admin/akses-sementara', klien)
    expect(await screen.findByText(/membutuhkan verifikasi dua langkah/)).toBeTruthy()
    expect(screen.queryByText('Anda tidak punya izin memberi akses sementara.')).toBeNull()
  })
})

describe('kotak masuk', () => {
  const notif = (id, ekstra = {}) => ({
    id, kind: 'login_baru', title: `Pemberitahuan ${id} Contoh`, body: 'iPhone · sekitar Kota Contoh, Indonesia · 14.05, lewat link undangan.',
    link: '#/admin/perangkat', priority: 'biasa', created_at: '2026-10-07T07:05:00Z', read_at: null, ...ekstra,
  })
  const UUID = '0b7e4e10-6c3a-4c8e-9a52-3f1d2b8c7a11'
  const klienKotak = (notifications, rpc = {}) => klienSudahMasuk({
    rpc: { db_version: async () => OK('999'), revoke_device: async () => OK(null), ...rpc },
    tabel: { notifications },
  })

  it('daftar pemberitahuan; yang belum dibaca dan yang penting ditandai dengan TULISAN', async () => {
    pasang('/kotak-masuk', klienKotak([
      notif(1),
      notif(2, { read_at: '2026-10-07T08:00:00Z' }),
      notif(3, { priority: 'penting', kind: 'login_mencurigakan', title: 'Login mencurigakan: Pak Jauh Contoh' }),
    ]))
    expect(await screen.findByRole('heading', { name: 'Pemberitahuan 1 Contoh' })).toBeTruthy()
    expect(screen.getAllByText('Belum dibaca')).toHaveLength(2)
    expect(screen.getByText('Penting')).toBeTruthy()
    expect(screen.getAllByText(/iPhone · sekitar Kota Contoh, Indonesia · 14\.05/)).toHaveLength(3)
    expect(screen.getAllByText(/^7 Oktober 2026, \d\d\.\d\d$/).length).toBeGreaterThan(0)
  })

  it('kosong → "Belum ada pemberitahuan."', async () => {
    pasang('/kotak-masuk', klienKotak([]))
    expect(await screen.findByText('Belum ada pemberitahuan.')).toBeTruthy()
  })

  it('"Tandai sudah dibaca" menyimpan waktu baca dan memuat ulang', async () => {
    const klien = klienKotak([notif(1)])
    const { aksi } = pasang('/kotak-masuk', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Tandai sudah dibaca' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tandai sudah dibaca' })).toBeNull())
    expect(klien.tabel.notifications[0].read_at).toBeTruthy()
    expect(screen.queryByText('Belum dibaca')).toBeNull()
  })

  it('login mencurigakan: "Cabut perangkat ini" mencabut perangkat yang tertera di pemberitahuan', async () => {
    const klien = klienKotak([notif(7, { kind: 'login_mencurigakan', priority: 'penting', link: `#/admin/perangkat?cabut=${UUID}` })])
    const { aksi } = pasang('/kotak-masuk', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Cabut perangkat ini' }))
    expect(await screen.findByText('Perangkat itu sudah dicabut.')).toBeTruthy()
    expect(klien.panggilanKe('rpc', 'revoke_device')[0].isi).toEqual({ p_device: UUID })
    expect(klien.tabel.notifications[0].read_at).toBeTruthy()
  })

  it('gagal mencabut (mis. belum verifikasi dua langkah) → pesan Indonesia, pemberitahuan tetap belum dibaca', async () => {
    const klien = klienKotak(
      [notif(7, { priority: 'penting', link: `#/admin/perangkat?cabut=${UUID}` })],
      { revoke_device: async () => GALAT('AK024', 'Perangkat ini tidak ditemukan, atau bukan milik Anda.') },
    )
    const { aksi } = pasang('/kotak-masuk', klien)
    await aksi.click(await screen.findByRole('button', { name: 'Cabut perangkat ini' }))
    expect(await screen.findByText('Perangkat ini tidak ditemukan, atau bukan milik Anda.')).toBeTruthy()
    expect(klien.tabel.notifications[0].read_at).toBeNull()
  })

  it('tautan di pemberitahuan tidak pernah dijadikan tautan, kecuali bentuk "cabut perangkat" yang persis', async () => {
    pasang('/kotak-masuk', klienKotak([
      notif(1, { link: 'javascript:alert(1)' }),
      notif(2, { link: 'https://jahat.invalid/ambil' }),
      notif(3, { link: `#/admin/perangkat?cabut=${UUID}&x=1` }),
      notif(4, { link: '#/admin/perangkat?cabut=bukan-uuid' }),
    ]))
    await screen.findByRole('heading', { name: 'Pemberitahuan 1 Contoh' })
    const isi = within(screen.getByRole('main'))
    expect(isi.queryAllByRole('link')).toEqual([])
    expect(isi.queryByRole('button', { name: 'Cabut perangkat ini' })).toBeNull()
  })

  it('isi pemberitahuan ditampilkan sebagai teks biasa (tidak menjalankan HTML)', async () => {
    pasang('/kotak-masuk', klienKotak([notif(1, { title: '<img src=x onerror=alert(1)>', body: '<b>tebal</b>' })]))
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy()
    expect(document.querySelector('main img')).toBeNull()
    expect(document.querySelector('main b')).toBeNull()
  })

  it('penanda di navigasi: jumlah belum dibaca (juga untuk pembaca layar); hilang kalau semua dibaca', async () => {
    const klien = klienKotak([notif(1), notif(2), notif(3, { read_at: '2026-10-07T08:00:00Z' })])
    pasang('/', klien)
    await screen.findByText('Halo, Bu Contoh')
    const nav = screen.getByRole('navigation', { name: 'Menu utama' })
    expect(await within(nav).findByText('2 belum dibaca')).toBeTruthy()
    expect(nav.textContent).toContain('2')
  })

  it('tanpa pemberitahuan → tidak ada penanda', async () => {
    pasang('/', klienKotak([]))
    await screen.findByText('Halo, Bu Contoh')
    const nav = screen.getByRole('navigation', { name: 'Menu utama' })
    await new Promise((r) => setTimeout(r, 50))
    expect(within(nav).queryByText(/belum dibaca/)).toBeNull()
  })
})
