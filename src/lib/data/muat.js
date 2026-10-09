// Memuat SEMUA data silsilah yang boleh dibaca anggota ini (RLS di server
// yang menentukan: silsilah utama + pohon keluarga asal yang diberi akses).
// HANYA MEMBACA: tidak ada insert, update, upsert, delete, atau rpc di sini
// (aturanKode.test.js menjaganya). Galat dilempar apa adanya.
import { KOLOM, KOLOM_PENGATURAN, BISA_DISISIHKAN, TABEL_SILSILAH, pilihKolom, saringData } from './kolom.js'

// Server mengembalikan paling banyak 1.000 baris per permintaan (batas
// bawaan Supabase), padahal silsilah bisa lebih besar. Karena itu dimuat
// per halaman sampai jumlahnya sama dengan jumlah total dari server.
export const UKURAN_HALAMAN = 1000
const BATAS_HALAMAN = 500
const URUTAN = { birth_ranks: ['parent_id', 'child_id'] }

export async function ambilSemua(klien, tabel) {
  const kolom = KOLOM[tabel]
  const hasil = []
  let total = null
  for (let halaman = 0; halaman < BATAS_HALAMAN; halaman++) {
    let q = klien.from(tabel).select(kolom.join(','), halaman === 0 ? { count: 'exact' } : undefined)
    // Yang disisihkan tidak ikut (yang berizin melihatnya di layar Data yang disisihkan).
    if (BISA_DISISIHKAN.has(tabel)) q = q.is('deleted_at', null)
    for (const k of URUTAN[tabel] ?? ['id']) q = q.order(k)
    const { data, error, count } = await q.range(hasil.length, hasil.length + UKURAN_HALAMAN - 1)
    if (error) throw error
    if (halaman === 0 && Number.isInteger(count)) total = count
    hasil.push(...(data ?? []).map((b) => pilihKolom(kolom, b)))
    // Tanpa jumlah total: berhenti di halaman kosong (bukan di halaman yang
    // "kurang dari penuh", karena server bisa saja membatasi lebih kecil).
    if (!data?.length || (total != null && hasil.length >= total)) return hasil
  }
  throw new Error('data terlalu banyak')
}

export async function muatSemua(klien) {
  const [tabel, pengaturan] = await Promise.all([
    Promise.all(TABEL_SILSILAH.map((t) => ambilSemua(klien, t))),
    klien.from('settings').select(KOLOM_PENGATURAN.join(',')),
  ])
  if (pengaturan.error) throw pengaturan.error
  const p = pengaturan.data?.[0] ?? {}
  return saringData({
    ...Object.fromEntries(TABEL_SILSILAH.map((t, i) => [t, tabel[i]])),
    root_union_id: p.root_union_id ?? null,
    generation_terms: p.generation_terms ?? null,
  })
}
