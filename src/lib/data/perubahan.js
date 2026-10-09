// Menerapkan satu perubahan live (Supabase Realtime) ke data di memori.
// Fungsi murni: data lama tidak diubah, hasilnya data baru.
//
// Bentuk peristiwa (dari supabase-js): { table, eventType, new, old }
//   INSERT/UPDATE  baris baru (hanya kolom yang diizinkan yang disimpan);
//                  baris yang disisihkan (deleted_at terisi) dibuang
//   DELETE         hapus permanen; hanya berisi id
//   sync_removals  penanda "baris ini didisisihkan" untuk anggota
//                  yang tidak boleh melihat data yang disisihkan (SQL 014)
//   settings       pangkal silsilah dan istilah generasi
//
// Perubahan yang lebih lama daripada yang sudah dipegang (version lebih
// kecil) diabaikan, misalnya peristiwa yang tiba saat data sedang dimuat ulang.
import { KOLOM, KOLOM_PENGATURAN, kunciBaris, pilihKolom } from './kolom.js'

function buang(data, tabel, kunci) {
  if (!KOLOM[tabel] || kunci == null) return data
  const sisa = data[tabel].filter((b) => kunciBaris(tabel, b) !== kunci)
  return sisa.length === data[tabel].length ? data : { ...data, [tabel]: sisa }
}

export function terapkanPerubahan(data, peristiwa) {
  const { table: tabel, eventType: jenis } = peristiwa ?? {}
  const baru = peristiwa?.new ?? {}

  if (tabel === 'settings') {
    if (jenis !== 'UPDATE' && jenis !== 'INSERT') return data
    const p = pilihKolom(KOLOM_PENGATURAN, baru)
    return {
      ...data,
      ...(Object.hasOwn(p, 'root_union_id') ? { root_union_id: p.root_union_id ?? null } : {}),
      ...(Array.isArray(p.generation_terms) ? { generation_terms: p.generation_terms.map(String) } : {}),
    }
  }
  if (tabel === 'sync_removals') {
    return jenis === 'INSERT' ? buang(data, baru.table_name, baru.row_id) : data
  }
  if (!KOLOM[tabel]) return data
  if (jenis === 'DELETE') return buang(data, tabel, kunciBaris(tabel, peristiwa.old ?? {}))
  if (jenis !== 'INSERT' && jenis !== 'UPDATE') return data

  const baris = pilihKolom(KOLOM[tabel], baru)
  const kunci = kunciBaris(tabel, baris)
  if (kunci == null) return data
  if (baris.deleted_at) return buang(data, tabel, kunci)

  const i = data[tabel].findIndex((b) => kunciBaris(tabel, b) === kunci)
  if (i < 0) return { ...data, [tabel]: [...data[tabel], baris] }
  if ((data[tabel][i].version ?? 0) > (baris.version ?? 0)) return data
  return { ...data, [tabel]: data[tabel].map((b, j) => (j === i ? baris : b)) }
}
