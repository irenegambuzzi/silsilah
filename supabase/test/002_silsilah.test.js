// Tes struktur silsilah. Semua orang di sini FIKTIF. Data dimasukkan
// sebagai pemilik database (RLS dan trigger datang di 003–005).
import { beforeAll, describe, expect, it } from 'vitest'
import {
  baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai,
} from './tiruan-supabase.js'

let db
const satu = async (sql, params) => (await baris(db, sql, params))[0]
const orang = async (nama, extra = {}) => {
  const kolom = ['full_name', ...Object.keys(extra)]
  const nilai = [nama, ...Object.values(extra)]
  const r = await satu(
    `insert into public.people (${kolom.join(', ')}) values (${kolom.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    nilai
  )
  return r.id
}
const nikah = async (p1, p2, extra = {}) => {
  const kolom = ['partner1_id', 'partner2_id', ...Object.keys(extra)]
  const nilai = [p1, p2, ...Object.values(extra)]
  return (await satu(
    `insert into public.unions (${kolom.join(', ')}) values (${kolom.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    nilai
  )).id
}
const anak = async (unionId, childId, kind = 'kandung', bio = 'keduanya') =>
  (await satu(
    `insert into public.children (union_id, child_id, kind, biological_parent) values ($1, $2, $3, $4) returning id`,
    [unionId, childId, kind, bio]
  )).id

beforeAll(async () => {
  db = await buatDatabase()
  expect(await jalankanFileDanPeriksa(db, '001_dasar_keamanan.sql')).toEqual([])
}, 30000)

describe('002_silsilah.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan dua kali', async () => {
    expect(await jalankanFileDanPeriksa(db, '002_silsilah.sql')).toEqual([])
    expect(await jalankanFileDanPeriksa(db, '002_silsilah.sql')).toEqual([])
  })
})

describe('tanggal kabur', () => {
  const sah = async (y, m, d) => (await satu(`select public.fuzzy_date_valid($1, $2, $3) as ok`, [y, m, d])).ok
  it('menerima tanggal lengkap, bulan+tahun, tahun saja, dan kosong', async () => {
    expect(await sah(1950, 3, 12)).toBe(true)
    expect(await sah(1950, 3, null)).toBe(true)
    expect(await sah(1950, null, null)).toBe(true)
    expect(await sah(null, null, null)).toBe(true)
    expect(await sah(2024, 2, 29)).toBe(true)
  })
  it('menolak kombinasi yang tidak masuk akal', async () => {
    expect(await sah(null, 3, null)).toBe(false) // bulan tanpa tahun
    expect(await sah(1950, null, 12)).toBe(false) // hari tanpa bulan
    expect(await sah(2023, 2, 29)).toBe(false) // bukan tahun kabisat
    expect(await sah(1950, 4, 31)).toBe(false)
    expect(await sah(1950, 13, null)).toBe(false)
    expect(await sah(1400, null, null)).toBe(false)
  })
  it('"perkiraan" butuh tahun; wafat butuh status wafat dan tidak sebelum lahir', async () => {
    await expect(orang('Uji Satu', { birth_approx: true })).rejects.toThrow(/people_birth_valid/)
    expect(await orang('Uji Dua', { birth_y: 1950, birth_approx: true })).toBeTruthy()
    await expect(orang('Uji Tiga', { death_y: 1990 })).rejects.toThrow(/people_death_needs_deceased/)
    await expect(orang('Uji Empat', { is_deceased: true, birth_y: 1950, death_y: 1940 })).rejects.toThrow(/people_death_after_birth/)
    expect(await orang('Uji Lima', { is_deceased: true })).toBeTruthy() // wafat, tanggal tidak diketahui
  })
})

describe('people', () => {
  it('nama wajib, tanpa spasi berlebih di awal/akhir', async () => {
    await expect(orang('')).rejects.toThrow(/check/)
    await expect(orang('  Spasi ')).rejects.toThrow(/check/)
  })
  it('jenis kelamin hanya L atau P (atau kosong)', async () => {
    await expect(orang('Uji Enam', { sex: 'X' })).rejects.toThrow(/check/)
    expect(await orang('Uji Tujuh', { sex: 'P' })).toBeTruthy()
  })
  it('kolom tempat sampah selalu terisi bersamaan', async () => {
    await expect(orang('Uji Delapan', { deleted_at: new Date().toISOString() })).rejects.toThrow(/people_trash_consistent/)
  })
})

describe('pernikahan berulang dan urutan lahir lintas pernikahan', () => {
  // Contoh dari PLAN.md: istri ke-1 → anak 1–3, istri ke-2 → anak 4–5,
  // kembali ke istri ke-1 → anak 6–7, istri ke-3 → anak 8–11.
  let ayah, istri1, istri2, istri3, n1a, n2, n1b, n3
  const anakAnak = []

  beforeAll(async () => {
    ayah = await orang('Wiryo Contoh', { sex: 'L' })
    istri1 = await orang('Lestari Contoh', { sex: 'P' })
    istri2 = await orang('Ratna Contoh', { sex: 'P' })
    istri3 = await orang('Sekar Contoh', { sex: 'P' })
    n1a = await nikah(ayah, istri1, { sort_order: 1, status: 'cerai' })
    n2 = await nikah(ayah, istri2, { sort_order: 2, status: 'cerai' })
    n1b = await nikah(ayah, istri1, { sort_order: 3, status: 'cerai' }) // menikah lagi, pasangan sama
    n3 = await nikah(ayah, istri3, { sort_order: 4 })
    const per = [[n1a, 3], [n2, 2], [n1b, 2], [n3, 4]]
    for (const [u, jumlah] of per) {
      for (let i = 0; i < jumlah; i++) {
        const c = await orang(`Anak Contoh ${anakAnak.length + 1}`)
        await anak(u, c)
        anakAnak.push(c)
      }
    }
    for (const [i, c] of anakAnak.entries()) {
      await db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, $3)`, [ayah, c, i + 1])
    }
  })

  it('pasangan yang sama boleh menikah lebih dari sekali', async () => {
    const r = await satu(`select count(*)::int as n from public.unions where partner1_id = $1 and partner2_id = $2`, [ayah, istri1])
    expect(r.n).toBe(2)
  })

  it('urutan lahir 1–11 lintas empat pernikahan', async () => {
    const r = await baris(db, `
      select br.rank, u.sort_order
      from public.birth_ranks br
      join public.children c on c.child_id = br.child_id
      join public.unions u on u.id = c.union_id
      where br.parent_id = $1 order by br.rank`, [ayah])
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(r.map((x) => x.sort_order)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4])
  })

  it('anak ke-6 dan ke-7 berasal dari istri ke-1 (pernikahan kedua dengannya)', async () => {
    const r = await baris(db, `
      select u.partner2_id from public.birth_ranks br
      join public.children c on c.child_id = br.child_id join public.unions u on u.id = c.union_id
      where br.parent_id = $1 and br.rank in (6, 7)`, [ayah])
    expect(r.map((x) => x.partner2_id)).toEqual([istri1, istri1])
  })

  it('urutan yang sama untuk satu orang tua ditolak', async () => {
    const baru = await orang('Anak Contoh Ganda')
    await expect(
      db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, 3)`, [ayah, baru])
    ).rejects.toThrow(/birth_ranks_unique_rank/)
  })

  it('urutan bisa ditukar dalam satu transaksi (pengaturan manual)', async () => {
    await db.transaction(async (tx) => {
      await tx.query(`update public.birth_ranks set rank = 2 where parent_id = $1 and child_id = $2`, [ayah, anakAnak[0]])
      await tx.query(`update public.birth_ranks set rank = 1 where parent_id = $1 and child_id = $2`, [ayah, anakAnak[1]])
    })
    const r = await satu(`select rank from public.birth_ranks where parent_id = $1 and child_id = $2`, [ayah, anakAnak[0]])
    expect(r.rank).toBe(2)
  })

  it('seseorang tidak bisa menikah dengan dirinya sendiri; pasangan boleh "tidak diketahui"', async () => {
    await expect(nikah(ayah, ayah)).rejects.toThrow(/unions_distinct_partners/)
    expect(await nikah(ayah, null, { sort_order: 5 })).toBeTruthy()
  })

  it('tanggal selesai menikah tidak boleh sebelum tanggal menikah', async () => {
    await expect(nikah(ayah, istri2, { marriage_y: 1980, end_y: 1970 })).rejects.toThrow(/unions_end_after_marriage/)
  })
})

describe('anak kandung, sambung, dan angkat', () => {
  let u, ibu, ayah
  beforeAll(async () => {
    ayah = await orang('Bambang Contoh', { sex: 'L' })
    ibu = await orang('Wulan Contoh', { sex: 'P' })
    u = await nikah(ayah, ibu)
  })

  it('jenis anak harus cocok dengan orang tua darahnya', async () => {
    expect(await anak(u, await orang('Kandung Contoh'), 'kandung', 'keduanya')).toBeTruthy()
    expect(await anak(u, await orang('Sambung Contoh'), 'sambung', 'partner2')).toBeTruthy()
    expect(await anak(u, await orang('Angkat Contoh'), 'angkat', null)).toBeTruthy()
    await expect(anak(u, await orang('Salah Satu'), 'kandung', 'partner1')).rejects.toThrow(/children_biological_matches_kind/)
    await expect(anak(u, await orang('Salah Dua'), 'sambung', 'keduanya')).rejects.toThrow(/children_biological_matches_kind/)
    await expect(anak(u, await orang('Salah Tiga'), 'angkat', 'partner1')).rejects.toThrow(/children_biological_matches_kind/)
  })

  it('anak yang sama tidak bisa dicatat dua kali di pernikahan yang sama', async () => {
    const c = await orang('Dobel Contoh')
    await anak(u, c)
    await expect(anak(u, c)).rejects.toThrow(/children_union_child_active/)
  })

  it('hanya satu hubungan kandung aktif per anak; angkat di keluarga lain tetap boleh', async () => {
    const c = await orang('Dua Keluarga Contoh')
    const lain = await nikah(await orang('Hartono Contoh', { sex: 'L' }), await orang('Yanti Contoh', { sex: 'P' }))
    await anak(u, c, 'kandung')
    await expect(anak(lain, c, 'kandung')).rejects.toThrow(/children_one_biological_active/)
    expect(await anak(lain, c, 'angkat', null)).toBeTruthy()
  })

  it('hubungan yang ada di tempat sampah tidak menghalangi pencatatan ulang', async () => {
    const c = await orang('Salah Cabang Contoh')
    const id = await anak(u, c)
    await db.query(`update public.children set deleted_at = now(), delete_batch = gen_random_uuid() where id = $1`, [id])
    expect(await anak(u, c)).toBeTruthy()
  })
})

describe('pernikahan antarsepupu: anak punya urutan untuk kedua orang tua', () => {
  it('dua baris urutan lahir untuk satu anak', async () => {
    const p1 = await orang('Sepupu Satu', { sex: 'L' })
    const p2 = await orang('Sepupu Dua', { sex: 'P' })
    const u = await nikah(p1, p2)
    const c = await orang('Anak Sepupu')
    await anak(u, c)
    await db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $3, 1), ($2, $3, 1)`, [p1, p2, c])
    const r = await satu(`select count(*)::int as n from public.birth_ranks where child_id = $1`, [c])
    expect(r.n).toBe(2)
  })
})

describe('pohon keluarga asal dan pangkal', () => {
  it('satu pohon per pasangan khusus; orang di pohon itu ditandai tree_id', async () => {
    const pasanganKhusus = await orang('Pasangan Khusus Contoh', { sex: 'P' })
    const pohon = (await satu(`insert into public.origin_trees (anchor_person_id) values ($1) returning id, grant_all_descendants`, [pasanganKhusus]))
    expect(pohon.grant_all_descendants).toBe(false)
    await expect(db.query(`insert into public.origin_trees (anchor_person_id) values ($1)`, [pasanganKhusus])).rejects.toThrow(/unique|duplicate/)
    const bapaknya = await orang('Bapak Pasangan Contoh', { tree_id: pohon.id })
    const r = await satu(`select tree_id from public.people where id = $1`, [bapaknya])
    expect(r.tree_id).toBe(pohon.id)
    await expect(orang('Pohon Palsu', { tree_id: '00000000-0000-0000-0000-000000000000' })).rejects.toThrow(/people_tree_fk/)
  })

  it('pangkal silsilah disimpan di settings dan harus pernikahan yang ada', async () => {
    const u = await nikah(await orang('Pangkal Satu', { sex: 'L' }), await orang('Pangkal Dua', { sex: 'P' }))
    await db.query(`update public.settings set root_union_id = $1`, [u])
    await expect(db.query(`update public.settings set root_union_id = gen_random_uuid()`)).rejects.toThrow(/settings_root_union_fk/)
  })
})

describe('hak akses (sebelum 005)', () => {
  it('anon dan authenticated belum bisa menyentuh tabel silsilah', async () => {
    const u = await buatPengguna(db)
    for (const t of ['people', 'unions', 'children', 'birth_ranks', 'origin_trees']) {
      await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from public.${t}`))).rejects.toThrow(/permission denied/)
      await expect(sebagai(db, 'authenticated', klaimUntuk(u), (tx) => baris(tx, `select * from public.${t}`))).rejects.toThrow(/permission denied/)
    }
  })

  it('validasi tanggal tetap bekerja saat yang menyimpan adalah pengguna login', async () => {
    // Hak sementara hanya untuk tes ini; hak sebenarnya diatur di 005.
    await db.exec(`grant insert, select on public.people to authenticated;
      create policy uji_sementara on public.people for all to authenticated using (true) with check (true);`)
    const u = await buatPengguna(db)
    await sebagai(db, 'authenticated', klaimUntuk(u), (tx) =>
      tx.query(`insert into public.people (full_name, birth_y, birth_m) values ('Login Contoh', 1960, 5)`))
    await expect(
      sebagai(db, 'authenticated', klaimUntuk(u), (tx) =>
        tx.query(`insert into public.people (full_name, birth_y, birth_m, birth_d) values ('Login Salah', 1961, 2, 30)`))
    ).rejects.toThrow(/people_birth_valid/)
    await db.exec(`drop policy uji_sementara on public.people; revoke all on public.people from authenticated;`)
  })

  it('anon tidak bisa menjalankan fungsi validasi tanggal', async () => {
    await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, `select public.fuzzy_date_valid(2000, 1, 1)`))).rejects.toThrow(/permission denied/)
  })
})
