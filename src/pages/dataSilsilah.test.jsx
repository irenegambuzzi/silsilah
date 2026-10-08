// @vitest-environment jsdom
// Lapisan data silsilah (langkah 1.20) di aplikasi UTUH + klien tiruan:
// memuat semua, layar keterangan, sinkron live, salinan offline tanpa
// kontak, dan TIDAK PERNAH MENULIS ke database (apa pun yang gagal).
// Semua data FIKTIF (keluargaFiktif.js).
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, configure, screen, waitFor } from '@testing-library/react'
import { pasang } from '../test/pembantu.jsx'
import { GALAT, OK, anggotaContoh, klienSudahMasuk } from '../test/klienTiruan.js'
import { bangunKeluargaFiktif } from '../lib/silsilah/keluargaFiktif.js'
import { bacaSalinan, generasiPenghapusan } from '../lib/penyimpanan.js'
import { tulisSalinan } from '../lib/data/salinan.js'
import { teks } from '../teks/id.js'

// Memuat data melewati banyak langkah (sesi, enam tabel per halaman); di
// komputer yang sedang sibuk itu bisa lebih dari 1 detik (batas bawaan).
configure({ asyncUtilTimeout: 5000 })

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const keluarga = bangunKeluargaFiktif()
const JUMLAH_UTAMA = keluarga.people.filter((p) => p.tree_id === null).length
const ringkasan = (n) => `Silsilah keluarga saat ini berisi ${n} orang.`
const tabelKeluarga = () => ({
  people: structuredClone(keluarga.people),
  unions: structuredClone(keluarga.unions),
  children: structuredClone(keluarga.children),
  birth_ranks: structuredClone(keluarga.birth_ranks),
  origin_trees: structuredClone(keluarga.origin_trees),
  settings: [{ root_union_id: keluarga.root_union_id, generation_terms: null, temp_access_max_minutes: 1440 }],
})
const klienKeluarga = (tambahan = {}) =>
  klienSudahMasuk({
    ...tambahan,
    rpc: { db_version: async () => OK('999'), sign_out_devices: async () => OK(1), ...(tambahan.rpc ?? {}) },
    tabel: { ...tabelKeluarga(), ...(tambahan.tabel ?? {}) },
  })
const putus = () => ({ message: 'TypeError: Failed to fetch', code: '' })
const tunda = () => {
  let lepas
  const janji = new Promise((r) => { lepas = r })
  return { janji, lepas }
}
// Teks spanduk data (offline / belum diperbarui), atau '' kalau tidak ada.
const teksSpanduk = () => screen.queryAllByRole('status').map((e) => e.textContent).find((t) => t.includes(teks.data.hanyaMembaca)) ?? ''
const kirim = (klien, peristiwa) => act(async () => { klien.realtime.kirim(peristiwa) })
const keadaanOffline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
// Salinan offline yang sudah ada di perangkat (dari kunjungan sebelumnya).
const salinanAda = (akun = 'akun-contoh') =>
  tulisSalinan({ akun, anggota: { id: anggotaContoh.id, nama: 'Bu Contoh', peran: 'anggota', pemilik: false, izin: [] }, data: tabelKeluarga() }, generasiPenghapusan())

// Semua yang dikirim ke server HANYA membaca: tidak ada insert, upsert,
// update, delete, atau RPC/fungsi yang mengubah data.
const RPC_BACA = new Set(['db_version'])
const FUNGSI_BACA = new Set(['cek-perangkat'])
function hanyaMembaca(klien) {
  expect(klien.tulisan()).toEqual([])
  expect(klien.panggilan.filter((p) => p.jenis === 'rpc' && !RPC_BACA.has(p.nama))).toEqual([])
  expect(klien.panggilan.filter((p) => p.jenis === 'fungsi' && !FUNGSI_BACA.has(p.nama))).toEqual([])
}

describe('memuat data silsilah', () => {
  it('setelah masuk: semua data dimuat dan beranda menunjukkan jumlah orang; hanya membaca', async () => {
    const klien = klienKeluarga()
    pasang('/', klien)
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA))).toBeTruthy()
    for (const t of ['people', 'unions', 'children', 'birth_ranks', 'origin_trees', 'settings']) {
      expect(klien.panggilanKe('tabel', t).length, t).toBeGreaterThan(0)
    }
    hanyaMembaca(klien)
  })

  it('database kosong → "Belum ada data, hubungi admin." dan tidak ada penulisan apa pun', async () => {
    const klien = klienSudahMasuk()
    pasang('/', klien)
    expect(await screen.findByText(teks.layar.kosong.isi)).toBeTruthy()
    expect(screen.getByRole('heading', { name: teks.layar.kosong.judul })).toBeTruthy()
    hanyaMembaca(klien)
  })
})

describe('Supabase gagal → layar keterangan, TIDAK PERNAH menulis data bawaan', () => {
  const kasus = [
    ['jaringan putus', putus(), teks.galat.jaringan, true],
    ['project dijeda (540)', { message: 'Project paused', status: 540 }, teks.galat.dipulihkan, true],
    ['server bermasalah (500)', { message: 'Internal error', status: 500 }, teks.galat.server, true],
    ['database belum diperbarui (tabel tidak ada)', { code: 'PGRST205', message: 'Could not find the table' }, teks.galat.belumDiperbarui, false],
    ['ditolak RLS (42501)', { code: '42501', message: 'permission denied for table people' }, teks.galat.tanpaIzin, false],
    ['sesi berakhir (401)', { code: 'PGRST301', message: 'JWT expired', status: 401 }, null, false],
  ]
  it.each(kasus)('%s', async (_nama, galat, pesan, bisaCobaLagi) => {
    const klien = klienKeluarga({ gagalTabel: { people: async () => galat } })
    pasang('/', klien)
    if (pesan) {
      expect(await screen.findByText(pesan)).toBeTruthy()
      expect(Boolean(screen.queryByRole('button', { name: teks.umum.cobaLagi }))).toBe(bisaCobaLagi)
    } else {
      // Sesi berakhir: keluar dan data dihapus, bukan menulis apa pun.
      expect(await screen.findByText(teks.keluar.alasan.sesi)).toBeTruthy()
    }
    expect(screen.queryByText(/Silsilah keluarga saat ini berisi/)).toBeNull()
    hanyaMembaca(klien)
  })

  it('"Coba lagi" setelah gagal → data termuat', async () => {
    let gagal = true
    const klien = klienKeluarga({ gagalTabel: { people: async () => (gagal ? putus() : null) } })
    const { aksi } = pasang('/', klien)
    await screen.findByText(teks.galat.jaringan)
    gagal = false
    await aksi.click(screen.getByRole('button', { name: teks.umum.cobaLagi }))
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA))).toBeTruthy()
    hanyaMembaca(klien)
  })
})

describe('sinkron live', () => {
  it('perubahan dari anggota lain langsung tampil: tambah, buang ke tempat sampah, hapus permanen', async () => {
    const klien = klienKeluarga()
    pasang('/', klien)
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    await kirim(klien, { table: 'people', eventType: 'INSERT', new: { id: 'baru', tree_id: null, full_name: 'Baru Contoh', version: 1 } })
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA + 1))).toBeTruthy()
    // Anggota biasa tidak melihat isi tempat sampah; yang sampai hanya penandanya.
    await kirim(klien, { table: 'sync_removals', eventType: 'INSERT', new: { table_name: 'people', row_id: 'baru', tree_id: null } })
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA))).toBeTruthy()
    await kirim(klien, { table: 'people', eventType: 'DELETE', old: { id: keluarga.people.find((p) => p.tree_id === null).id } })
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA - 1))).toBeTruthy()
    hanyaMembaca(klien)
  })

  it('perubahan yang tiba selagi data dimuat tidak hilang', async () => {
    const t = tunda()
    const klien = klienKeluarga({ gagalTabel: { people: async () => { await t.janji; return null } } })
    pasang('/', klien)
    await waitFor(() => expect(klien.realtime.jumlahSaluran()).toBe(1))
    await kirim(klien, { table: 'people', eventType: 'INSERT', new: { id: 'saat-muat', tree_id: null, full_name: 'Saat Muat Contoh', version: 1 } })
    await act(async () => t.lepas())
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA + 1))).toBeTruthy()
  })

  it('sambungan live putus lalu pulih → semua data diambil ulang (perubahan selama putus tidak hilang)', async () => {
    const klien = klienKeluarga()
    pasang('/', klien)
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    const sebelum = klien.panggilanKe('tabel', 'people').length
    await act(async () => klien.realtime.status('CHANNEL_ERROR'))
    klien.tabel.people.push({ id: 'selama-putus', tree_id: null, full_name: 'Selama Putus Contoh', deleted_at: null })
    await act(async () => klien.realtime.status('SUBSCRIBED'))
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA + 1))).toBeTruthy()
    expect(klien.panggilanKe('tabel', 'people').length).toBeGreaterThan(sebelum)
    hanyaMembaca(klien)
  })

  it('internet tersambung lagi → data diambil ulang', async () => {
    const klien = klienKeluarga()
    pasang('/', klien)
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    klien.tabel.people.push({ id: 'setelah-online', tree_id: null, full_name: 'Setelah Online Contoh', deleted_at: null })
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA + 1))).toBeTruthy()
  })

  it('keluar → langganan live dihentikan', async () => {
    const klien = klienKeluarga()
    const { aksi } = pasang('/saya/keluar', klien)
    await waitFor(() => expect(klien.realtime.jumlahSaluran()).toBe(1))
    await aksi.click(await screen.findByRole('button', { name: teks.keluar.iniSaja }))
    await screen.findByText(teks.keluar.alasan.keluar)
    await waitFor(() => expect(klien.realtime.jumlahSaluran()).toBe(0))
  })
})

describe('salinan offline', () => {
  const jamTiruan = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
  const majukan = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

  it('setelah dimuat, salinan disimpan di perangkat TANPA data kontak (walau server mengirimkannya)', async () => {
    jamTiruan()
    const people = tabelKeluarga().people.map((p, i) => (i === 0 ? { ...p, phone: '081234567890', address_enc: 'rahasia', region_lat: -7.25 } : p))
    pasang('/', klienKeluarga({ tabel: { people } }))
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    await majukan(2500)
    await waitFor(async () => expect(await bacaSalinan()).not.toBeNull())
    const s = await bacaSalinan()
    expect(s.akun).toBe('akun-contoh')
    expect(s.data.people).toHaveLength(keluarga.people.length)
    expect(JSON.stringify(s)).not.toMatch(/081234567890|rahasia|phone|address|region|-7\.25/)
  })

  it('tanpa internet saat dibuka: aplikasi terbuka dari salinan, dengan spanduk offline; tidak menulis dan tidak berlangganan', async () => {
    await salinanAda()
    keadaanOffline()
    const klien = klienKeluarga({ fungsi: { 'cek-perangkat': async () => { throw new TypeError('Failed to fetch') } } })
    pasang('/', klien)
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA))).toBeTruthy()
    expect(screen.getByText('Halo, Bu Contoh')).toBeTruthy()
    expect(teksSpanduk()).toMatch(/^Anda sedang offline\. Yang tampil adalah data tersimpan di perangkat ini dari \d+ \w+ \d{4}, \d\d\.\d\d\./)
    expect(klien.realtime.jumlahSaluran()).toBe(0)
    expect(klien.panggilanKe('tabel', 'people')).toEqual([])
    hanyaMembaca(klien)
  })

  it('internet tersambung lagi → diperiksa ke server, lalu data terbaru menggantikan salinan', async () => {
    await salinanAda()
    const offline = keadaanOffline()
    let tersambung = false
    const klien = klienKeluarga({
      fungsi: { 'cek-perangkat': async () => {
        if (!tersambung) throw new TypeError('Failed to fetch')
        return OK({ ok: true, status: 'ok', berakhir: null })
      } },
    })
    klien.tabel.people.push({ id: 'terbaru', tree_id: null, full_name: 'Terbaru Contoh', deleted_at: null })
    pasang('/', klien)
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    tersambung = true
    offline.mockReturnValue(true)
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA + 1))).toBeTruthy()
    await waitFor(() => expect(teksSpanduk()).toBe(''))
  })

  it('server tidak terjangkau saat memuat data (sesi sah) → salinan dipakai dengan spanduk', async () => {
    await salinanAda()
    const klien = klienKeluarga({ gagalTabel: { people: async () => putus() } })
    pasang('/', klien)
    expect(await screen.findByText(ringkasan(JUMLAH_UTAMA))).toBeTruthy()
    expect(teksSpanduk()).toMatch(/^Server belum bisa dihubungi\. Yang tampil adalah data tersimpan di perangkat ini dari/)
    hanyaMembaca(klien)
  })

  it('salinan milik akun lain tidak dipakai', async () => {
    await salinanAda('akun-lain')
    keadaanOffline()
    pasang('/', klienKeluarga({ fungsi: { 'cek-perangkat': async () => { throw new TypeError('Failed to fetch') } } }))
    expect(await screen.findByText(teks.layar.offline.judul)).toBeTruthy()
    expect(screen.queryByText(/Silsilah keluarga saat ini berisi/)).toBeNull()
  })

  it('server MENOLAK (bukan soal koneksi) → salinan tidak dipakai', async () => {
    await salinanAda()
    pasang('/', klienKeluarga({ gagalTabel: { people: async () => GALAT('42501', 'permission denied').error } }))
    expect(await screen.findByText(teks.galat.tanpaIzin)).toBeTruthy()
    expect(screen.queryByText(/Silsilah keluarga saat ini berisi/)).toBeNull()
  })

  it('perangkat akses sementara tidak pernah menyimpan salinan', async () => {
    jamTiruan()
    const berakhir = new Date(Date.now() + 30 * 60000).toISOString()
    pasang('/', klienKeluarga({ fungsi: { 'cek-perangkat': async () => OK({ ok: true, status: 'ok', berakhir }) } }))
    await screen.findByText(ringkasan(JUMLAH_UTAMA))
    await majukan(5000)
    expect(await bacaSalinan()).toBeNull()
  })

  it('keluar → salinan terhapus, dan pemuatan yang masih berjalan tidak menulisnya lagi', async () => {
    jamTiruan()
    let tahan = null
    const klien = klienKeluarga({ gagalTabel: { people: async () => { if (tahan) await tahan.janji; return null } } })
    const { aksi } = pasang('/saya/keluar', klien)
    await waitFor(() => expect(klien.panggilanKe('tabel', 'people').length).toBeGreaterThan(0))
    await majukan(2500)
    await waitFor(async () => expect(await bacaSalinan()).not.toBeNull())
    // Pemuatan ulang yang masih tertahan di server saat orang itu keluar.
    tahan = tunda()
    const sebelum = klien.panggilanKe('tabel', 'people').length
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(klien.panggilanKe('tabel', 'people').length).toBeGreaterThan(sebelum))
    await aksi.click(await screen.findByRole('button', { name: teks.keluar.iniSaja }))
    await screen.findByText(teks.keluar.alasan.keluar)
    expect(await bacaSalinan()).toBeNull()
    await act(async () => tahan.lepas())
    await majukan(5000)
    expect(await bacaSalinan()).toBeNull()
  })
})
