// Tes aturan otomatis silsilah. Semua orang di sini FIKTIF.
//
// Keluarga contoh:
//   Kakek + Nenek (pangkal)
//   ├─ Anak A (L) + Menantu M (pasangan, bukan keturunan)
//   │   └─ Cucu C1
//   └─ Anak B (P) + Menantu N
//       └─ Cucu C2
import { beforeAll, describe, expect, it } from 'vitest'
import { baris, buatDatabase, jalankanFileDanPeriksa } from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'

let db, h
let kakek, nenek, akar, a, m, ua, b, n, ub, c1, c2

const ditolak = async (janji, kode) => {
  const e = await janji.then(() => null, (err) => err)
  expect(e, `seharusnya ditolak dengan ${kode}`).not.toBeNull()
  expect(e.code).toBe(kode)
  return e
}

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '003_aturan_silsilah.sql')).toEqual([])
  h = pembantuSilsilah(db)

  kakek = await h.orang('Kakek Contoh', { sex: 'L' })
  nenek = await h.orang('Nenek Contoh', { sex: 'P' })
  akar = await h.nikah(kakek, nenek)
  await h.aturPangkal(akar)
  a = await h.orang('Anak A Contoh', { sex: 'L', birth_y: 1950 })
  b = await h.orang('Anak B Contoh', { sex: 'P', birth_y: 1952 })
  await h.anak(akar, a)
  await h.anak(akar, b)
  m = await h.orang('Menantu M Contoh', { sex: 'P' })
  ua = await h.nikah(a, m)
  n = await h.orang('Menantu N Contoh', { sex: 'L' })
  ub = await h.nikah(b, n)
  c1 = await h.orang('Cucu C1 Contoh', { birth_y: 1975 })
  c2 = await h.orang('Cucu C2 Contoh', { birth_y: 1977 })
  await h.anak(ua, c1)
  await h.anak(ub, c2)
}, 60000)

describe('003_aturan_silsilah.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '003_aturan_silsilah.sql')).toEqual([])
  })
})

describe('cap waktu dan versi', () => {
  it('data baru mulai di versi 1; setiap perubahan menaikkan versi', async () => {
    const id = await h.orang('Versi Contoh')
    expect((await h.satu(`select version from public.people where id = $1`, [id])).version).toBe(1)
    await db.query(`update public.people set nickname = 'Panggilan' where id = $1`, [id])
    expect((await h.satu(`select version from public.people where id = $1`, [id])).version).toBe(2)
  })

  it('simpan tanpa perubahan tidak menaikkan versi', async () => {
    const id = await h.orang('Tanpa Ubah Contoh', { nickname: 'Sama' })
    await db.query(`update public.people set nickname = 'Sama' where id = $1`, [id])
    expect((await h.satu(`select version from public.people where id = $1`, [id])).version).toBe(1)
  })

  it('versi, waktu dibuat, dan pembuat tidak bisa dipalsukan', async () => {
    const id = await h.orang('Palsu Contoh')
    const awal = await h.satu(`select created_at from public.people where id = $1`, [id])
    await db.query(`update public.people set version = 99 where id = $1`, [id])
    expect((await h.satu(`select version from public.people where id = $1`, [id])).version).toBe(1)
    await db.query(`update public.people set created_at = '2000-01-01', notes = 'x' where id = $1`, [id])
    const akhir = await h.satu(`select created_at, version from public.people where id = $1`, [id])
    expect(akhir.created_at).toEqual(awal.created_at)
    expect(akhir.version).toBe(2)
  })
})

describe('kolom yang tidak boleh berubah', () => {
  it('pihak garis keturunan sebuah pernikahan', async () => {
    await ditolak(db.query(`update public.unions set partner1_id = $1 where id = $2`, [b, ua]), 'SL006')
  })
  it('anak dalam sebuah hubungan, dan pohon seseorang', async () => {
    await ditolak(db.query(`update public.children set child_id = $1 where child_id = $2`, [c2, c1]), 'SL006')
    await ditolak(db.query(`update public.people set tree_id = gen_random_uuid() where id = $1`, [c1]), 'SL006')
  })
})

describe('anti-siklus', () => {
  it('seseorang tidak bisa menjadi anak dalam pernikahannya sendiri', async () => {
    await ditolak(h.anak(ua, a), 'SL001')
  })
  it('seseorang tidak bisa menjadi anak dari keturunannya', async () => {
    const istriC1 = await h.orang('Istri C1 Contoh', { sex: 'P' })
    const uc1 = await h.nikah(c1, istriC1)
    await ditolak(h.anak(uc1, a, 'angkat'), 'SL001')
    await ditolak(h.anak(uc1, kakek, 'angkat'), 'SL001')
  })
  it('pasangan sebuah pernikahan tidak bisa diganti dengan anaknya sendiri', async () => {
    await ditolak(db.query(`update public.unions set partner2_id = $1 where id = $2`, [c1, ua]), 'SL001')
  })
})

describe('pangkal dan pasangan', () => {
  it('pangkal tidak bisa diganti ke pernikahan yang pasangannya punya orang tua', async () => {
    await ditolak(h.aturPangkal(ua), 'SL002')
  })
  it('pasangan (bukan keturunan) tidak bisa diberi orang tua di silsilah utama', async () => {
    await ditolak(h.anak(ub, m, 'angkat'), 'SL004')
  })
  it('pernikahan di silsilah utama harus dicatat dari pihak keturunan', async () => {
    const orangLuar = await h.orang('Orang Luar Contoh')
    await ditolak(h.nikah(orangLuar, await h.orang('Pasangan Luar Contoh')), 'SL005')
    await ditolak(h.nikah(m, orangLuar), 'SL005') // menantu bukan keturunan
  })
})

describe('urutan lahir otomatis', () => {
  let ayah, ibu1, ibu2, u1, u2, k1960, k1955, kTanpa, k1958, k1965
  beforeAll(async () => {
    ayah = await h.orang('Ayah Urutan Contoh', { sex: 'L' })
    await h.anak(ub, ayah)
    ibu1 = await h.orang('Ibu Satu Contoh', { sex: 'P' })
    ibu2 = await h.orang('Ibu Dua Contoh', { sex: 'P' })
    u1 = await h.nikah(ayah, ibu1, { sort_order: 1 })
    u2 = await h.nikah(ayah, ibu2, { sort_order: 2 })
    k1960 = await h.orang('Lahir 1960 Contoh', { birth_y: 1960 })
    k1955 = await h.orang('Lahir 1955 Contoh', { birth_y: 1955 })
    kTanpa = await h.orang('Tanpa Tanggal Contoh')
    k1958 = await h.orang('Lahir 1958 Contoh', { birth_y: 1958 })
    k1965 = await h.orang('Lahir 1965 Contoh', { birth_y: 1965 })
    for (const k of [k1960, k1955, kTanpa, k1958]) await h.anak(u1, k)
    await h.anak(u2, k1965)
  })

  it('disisipkan menurut tanggal lahir; tanpa tanggal di belakang; lintas pernikahan', async () => {
    expect(await h.urutan(ayah)).toEqual([
      { child_id: k1955, rank: 1 },
      { child_id: k1958, rank: 2 },
      { child_id: k1960, rank: 3 },
      { child_id: kTanpa, rank: 4 },
      { child_id: k1965, rank: 5 },
    ])
  })

  it('pasangan yang bukan keturunan tidak mendapat urutan', async () => {
    expect(await h.urutan(ibu1)).toEqual([])
  })

  it('dibuang ke tempat sampah → urutan dirapikan; dipulihkan → kembali ke tempatnya', async () => {
    await db.query(`update public.children set deleted_at = now(), delete_batch = gen_random_uuid() where child_id = $1`, [k1958])
    expect((await h.urutan(ayah)).map((r) => r.child_id)).toEqual([k1955, k1960, kTanpa, k1965])
    await db.query(`update public.children set deleted_at = null, delete_batch = null where child_id = $1`, [k1958])
    expect((await h.urutan(ayah)).map((r) => r.child_id)).toEqual([k1955, k1958, k1960, kTanpa, k1965])
  })

  it('digeser manual; saudara lain ikut bergeser', async () => {
    await db.query(`select public.move_birth_rank($1, $2, 1)`, [ayah, kTanpa])
    expect((await h.urutan(ayah)).map((r) => r.child_id)).toEqual([kTanpa, k1955, k1958, k1960, k1965])
    await db.query(`select public.move_birth_rank($1, $2, 99)`, [ayah, kTanpa]) // dibatasi ke urutan terakhir
    expect((await h.urutan(ayah)).at(-1)).toEqual({ child_id: kTanpa, rank: 5 })
  })

  it('urutan yang bertentangan dengan tanggal lahir muncul sebagai peringatan', async () => {
    expect(await baris(db, `select * from public.birth_rank_warnings($1)`, [ayah])).toEqual([])
    await db.query(`select public.move_birth_rank($1, $2, 1)`, [ayah, k1965])
    const w = await baris(db, `select child_id, later_child_id from public.birth_rank_warnings($1)`, [ayah])
    expect(w.length).toBe(3) // 1965 di depan 1955, 1958, 1960
    expect(w.every((x) => x.child_id === k1965)).toBe(true)
    await db.query(`select public.move_birth_rank($1, $2, 4)`, [ayah, k1965])
  })

  it('anak yang dipindah ke orang tua lain pindah urutannya juga', async () => {
    const pamanBaru = await h.orang('Paman Contoh', { sex: 'L' })
    await h.anak(ub, pamanBaru)
    const up = await h.nikah(pamanBaru, null)
    await db.query(`update public.children set union_id = $1 where child_id = $2`, [up, k1958])
    expect((await h.urutan(ayah)).map((r) => r.child_id)).not.toContain(k1958)
    expect(await h.urutan(pamanBaru)).toEqual([{ child_id: k1958, rank: 1 }])
  })

  it('urutan lahir untuk anak yang bukan anak orang itu ditolak', async () => {
    await ditolak(db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, 9)`, [ibu2, c1]), 'SL007')
  })

  it('pergeseran urutan ikut menaikkan versinya', async () => {
    const r = await h.satu(`select max(version) as v from public.birth_ranks where parent_id = $1`, [ayah])
    expect(r.v).toBeGreaterThan(1)
  })
})

describe('urutan lahir hanya untuk anak kandung', () => {
  let ayah, ibu, u, ibuBaru, uBaru, kKandung, kSambungIbu, kSambungAyah, kAngkat, kKedua
  beforeAll(async () => {
    ayah = await h.orang('Ayah Kandung Contoh', { sex: 'L', birth_y: 1955 })
    await h.anak(ub, ayah)
    ibu = await h.orang('Ibu Kandung Contoh', { sex: 'P' })
    u = await h.nikah(ayah, ibu)
    kSambungIbu = await h.orang('Sambung Ibu Contoh', { birth_y: 1975 }) // anak ibu dari sebelumnya, LEBIH TUA
    kKandung = await h.orang('Kandung Contoh', { birth_y: 1980 })
    kAngkat = await h.orang('Angkat Contoh', { birth_y: 1982 })
    kKedua = await h.orang('Kandung Kedua Contoh', { birth_y: 1985 })
    await h.anak(u, kSambungIbu, 'sambung', 'partner2')
    await h.anak(u, kKandung)
    await h.anak(u, kAngkat, 'angkat')
    await h.anak(u, kKedua)
    // Anak ayah sendiri dari hubungan sebelumnya, dicatat sebagai anak sambung di pernikahan baru.
    ibuBaru = await h.orang('Ibu Baru Contoh', { sex: 'P' })
    uBaru = await h.nikah(ayah, ibuBaru)
    kSambungAyah = await h.orang('Sambung Ayah Contoh', { birth_y: 1990 })
    await h.anak(uBaru, kSambungAyah, 'sambung', 'partner1')
  })

  it('anak sambung (dari pasangan) dan anak angkat tidak bernomor; nomor hanya anak kandung', async () => {
    expect(await h.urutan(ayah)).toEqual([
      { child_id: kKandung, rank: 1 },
      { child_id: kKedua, rank: 2 },
      { child_id: kSambungAyah, rank: 3 }, // anak kandung ayah walaupun dicatat sebagai anak sambung ibu baru
    ])
  })

  it('urutan lahir untuk anak sambung atau angkat ditolak', async () => {
    await ditolak(db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, 9)`, [ayah, kSambungIbu]), 'SL007')
    await ditolak(db.query(`insert into public.birth_ranks (parent_id, child_id, rank) values ($1, $2, 9)`, [ayah, kAngkat]), 'SL007')
  })

  it('diubah menjadi anak angkat → urutannya hilang dan dirapikan; dikembalikan → bernomor lagi', async () => {
    await db.query(`update public.children set kind = 'angkat', biological_parent = null where child_id = $1`, [kKandung])
    expect(await h.urutan(ayah)).toEqual([{ child_id: kKedua, rank: 1 }, { child_id: kSambungAyah, rank: 2 }])
    await db.query(`update public.children set kind = 'kandung', biological_parent = 'keduanya' where child_id = $1`, [kKandung])
    expect((await h.urutan(ayah)).map((r) => r.child_id)).toEqual([kKandung, kKedua, kSambungAyah])
  })
})

describe('pernikahan baru tanpa menandai pernikahan sebelumnya berakhir', () => {
  it('diterima: tidak ada aturan yang melarang', async () => {
    const suami = await h.orang('Suami Dua Istri Contoh', { sex: 'L' })
    await h.anak(ub, suami)
    const u1 = await h.nikah(suami, await h.orang('Istri Pertama Contoh', { sex: 'P' }), { marriage_y: 1990 })
    const u2 = await h.nikah(suami, await h.orang('Istri Kedua Contoh', { sex: 'P' }), { marriage_y: 1995 })
    const r = await baris(db, `select status from public.unions where id in ($1, $2)`, [u1, u2])
    expect(r.map((x) => x.status)).toEqual(['menikah', 'menikah'])
  })
})

describe('pernikahan antarsepupu', () => {
  it('anak mendapat urutan untuk kedua orang tua', async () => {
    const uc = await h.nikah(c1, c2)
    const cicit = await h.orang('Cicit Contoh')
    await h.anak(uc, cicit)
    expect(await h.urutan(c1)).toEqual([{ child_id: cicit, rank: 1 }])
    expect(await h.urutan(c2)).toEqual([{ child_id: cicit, rank: 1 }])
  })
})

describe('tempat sampah', () => {
  it('anak tidak bisa ditambahkan ke pernikahan yang ada di tempat sampah', async () => {
    const uSampah = await h.nikah(a, await h.orang('Calon Contoh', { sex: 'P' }))
    await db.query(`update public.unions set deleted_at = now(), delete_batch = gen_random_uuid() where id = $1`, [uSampah])
    await ditolak(h.anak(uSampah, await h.orang('Anak Sampah Contoh')), 'SL008')
  })
})

describe('pohon keluarga asal', () => {
  let pohon, bapakM, ibuM, uOrtuM
  beforeAll(async () => {
    pohon = await h.pohonAsal(m)
    bapakM = await h.orang('Bapak M Contoh', { sex: 'L', tree_id: pohon })
    ibuM = await h.orang('Ibu M Contoh', { sex: 'P', tree_id: pohon })
    uOrtuM = await h.nikah(bapakM, ibuM)
  })

  it('pernikahan dan hubungan anak otomatis ikut pohonnya', async () => {
    expect((await h.satu(`select tree_id from public.unions where id = $1`, [uOrtuM])).tree_id).toBe(pohon)
  })

  it('pasangan khusus boleh menjadi anak di pohon keluarga asalnya sendiri', async () => {
    await h.anak(uOrtuM, m)
    const r = await h.satu(`select tree_id from public.children where child_id = $1 and union_id = $2`, [m, uOrtuM])
    expect(r.tree_id).toBe(pohon)
    // Urutan lahir di pohon keluarga asal: untuk kedua orang tua.
    expect(await h.urutan(bapakM)).toEqual([{ child_id: m, rank: 1 }])
    expect(await h.urutan(ibuM)).toEqual([{ child_id: m, rank: 1 }])
  })

  it('itu tidak membuatnya menjadi keturunan di silsilah utama', async () => {
    await ditolak(h.anak(ub, m, 'angkat'), 'SL004')
  })

  it('orang silsilah utama lain tidak bisa disambungkan ke pohon keluarga asal', async () => {
    await ditolak(h.anak(uOrtuM, c1, 'angkat'), 'SL003')
    await ditolak(h.nikah(bapakM, a), 'SL003')
  })

  it('pohon keluarga asal hanya untuk pasangan, bukan keturunan atau orang lain', async () => {
    await ditolak(h.pohonAsal(a), 'SL009')
    await ditolak(h.pohonAsal(await h.orang('Belum Menikah Contoh')), 'SL009')
    await ditolak(h.pohonAsal(bapakM), 'SL009')
  })

  it('pasangan khusus tidak bisa dipindah ke pohon lain', async () => {
    await ditolak(db.query(`update public.origin_trees set anchor_person_id = $1 where id = $2`, [n, pohon]), 'SL006')
  })
})

describe('pesan error', () => {
  it('berbahasa Indonesia dan memakai kode yang stabil', async () => {
    const e = await ditolak(h.anak(ua, a), 'SL001')
    expect(e.message).toMatch(/silsilah berputar/)
  })
})
