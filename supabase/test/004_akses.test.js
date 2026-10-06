// Tes anggota, perangkat, undangan, dan log login. Semua orang FIKTIF.
import { beforeAll, describe, expect, it } from 'vitest'
import {
  baris, buatDatabase, buatPengguna, jalankanFileDanPeriksa, klaimUntuk, sebagai,
} from './tiruan-supabase.js'
import { pembantuSilsilah } from './pembantu-silsilah.js'

let db, h
const tahunIni = new Date().getUTCFullYear()
const hash = (n) => n.toString(16).padStart(64, '0')
let nomorHash = 1

const ditolak = async (janji, kode) => {
  const e = await janji.then(() => null, (err) => err)
  expect(e, `seharusnya ditolak dengan ${kode}`).not.toBeNull()
  expect(e.code ?? e.message).toBe(kode)
  return e
}

// Anggota + akun login + satu perangkat (dibuat lewat "SQL Editor").
async function anggota(personId, { role = 'anggota', permissions = [], isOwner = false, nama = 'Anggota Contoh' } = {}) {
  const akun = await buatPengguna(db)
  const m = await h.satu(
    `insert into public.members (person_id, display_name, role, permissions, is_owner, auth_user_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [personId, nama, role, permissions, isOwner, akun.userId]
  )
  const d = await h.satu(
    `insert into public.devices (member_id, session_id, via) values ($1, $2, 'undangan') returning id`,
    [m.id, akun.sessionId]
  )
  return { ...akun, memberId: m.id, deviceId: d.id }
}

const lewatApi = (akun, fn, aal = 'aal1') => sebagai(db, 'authenticated', klaimUntuk(akun, aal), fn)
const siapaSaya = async (akun, aal = 'aal1') =>
  (await lewatApi(akun, (tx) => baris(tx, `select public.current_member_id() as id, public.can_edit() as edit,
    public.is_owner() as owner, public.has_perm('bendahara') as bendahara, public.has_perm('unduh_kontak') as unduh`), aal))[0]
// Meniru fungsi aplikasi (security definer) yang dipanggil lewat API.
const jalankanLewatApi = (akun, sql, aal = 'aal1') =>
  lewatApi(akun, (tx) => tx.query(`select public.uji_jalankan($1)`, [sql]), aal)

let kakek, nenek, akar, a, m, ua, c16, c17nikah, cTanpa, c18Tahun, c19Tahun, cWafat, orangLepas
let owner, asisten, biasa, lihat

beforeAll(async () => {
  db = await buatDatabase()
  for (const f of ['001_dasar_keamanan.sql', '002_silsilah.sql', '003_aturan_silsilah.sql']) {
    expect(await jalankanFileDanPeriksa(db, f)).toEqual([])
  }
  expect(await jalankanFileDanPeriksa(db, '004_akses.sql')).toEqual([])
  h = pembantuSilsilah(db)

  kakek = await h.orang('Kakek Contoh', { sex: 'L', birth_y: 1920 })
  nenek = await h.orang('Nenek Contoh', { sex: 'P', birth_y: 1925 })
  akar = await h.nikah(kakek, nenek)
  await h.aturPangkal(akar)
  a = await h.orang('Anak A Contoh', { sex: 'L', birth_y: 1950 })
  await h.anak(akar, a)
  m = await h.orang('Menantu M Contoh', { sex: 'P' })
  ua = await h.nikah(a, m)
  const cucu = async (nama, extra) => { const id = await h.orang(nama, extra); await h.anak(ua, id); return id }
  c16 = await cucu('Cucu 16 Contoh', { birth_y: tahunIni - 16, birth_m: 1, birth_d: 1 })
  c17nikah = await cucu('Cucu 17 Menikah Contoh', { birth_y: tahunIni - 17 })
  await h.nikah(c17nikah, await h.orang('Pasangan Muda Contoh'))
  cTanpa = await cucu('Cucu Tanpa Tanggal Contoh')
  c18Tahun = await cucu('Cucu Tahun 18 Contoh', { birth_y: tahunIni - 18 })
  c19Tahun = await cucu('Cucu Tahun 19 Contoh', { birth_y: tahunIni - 19 })
  cWafat = await cucu('Cucu Wafat Contoh', { birth_y: 1970, is_deceased: true })
  orangLepas = await h.orang('Orang Lepas Contoh')

  owner = await anggota(kakek, { isOwner: true, nama: 'Admin Utama Contoh' })
  asisten = await anggota(nenek, { role: 'asisten', permissions: ['bendahara'], nama: 'Asisten Contoh' })
  biasa = await anggota(a, { nama: 'Anggota Biasa Contoh' })
  lihat = await anggota(m, { role: 'lihat', nama: 'Hanya Melihat Contoh' })

  await db.exec(`
    create function public.uji_jalankan(q text) returns void language plpgsql security definer
      set search_path = '' as $$ begin execute q; end $$;
    revoke all on function public.uji_jalankan(text) from public, anon;
    grant execute on function public.uji_jalankan(text) to authenticated;
    -- Tabel uji: hanya anggota yang sah (perangkat sah) yang melihat isinya.
    create table public.rahasia_uji (isi text);
    insert into public.rahasia_uji values ('isi rahasia');
    alter table public.rahasia_uji enable row level security;
    create policy hanya_anggota on public.rahasia_uji for select to authenticated
      using (public.current_member_id() is not null);
    grant select on public.rahasia_uji to authenticated;
  `)
}, 60000)

const isiRahasia = (akun) => lewatApi(akun, (tx) => baris(tx, 'select isi from public.rahasia_uji'))

describe('004_akses.sql', () => {
  it('semua pemeriksaan sesuai, dan aman dijalankan ulang', async () => {
    expect(await jalankanFileDanPeriksa(db, '004_akses.sql')).toEqual([])
  })
})

describe('siapa yang sedang login', () => {
  it('anggota dengan perangkat sah dikenali; "hanya melihat" tidak bisa mengedit', async () => {
    expect(await siapaSaya(biasa)).toMatchObject({ id: biasa.memberId, edit: true, owner: false })
    expect(await siapaSaya(lihat)).toMatchObject({ id: lihat.memberId, edit: false })
  })

  it('tanpa login, atau akun tanpa perangkat terdaftar: bukan siapa-siapa', async () => {
    const r = await sebagai(db, 'anon', {}, (tx) => baris(tx, 'select 1 as x'))
    expect(r).toEqual([{ x: 1 }])
    const tanpaPerangkat = await buatPengguna(db)
    expect((await siapaSaya(tanpaPerangkat)).id).toBeNull()
    expect(await isiRahasia(tanpaPerangkat)).toEqual([])
  })

  it('sesi milik perangkat anggota lain tidak bisa dipakai', async () => {
    const penyusup = await buatPengguna(db)
    expect((await siapaSaya({ userId: penyusup.userId, sessionId: biasa.sessionId })).id).toBeNull()
  })

  it('perangkat yang dicabut LANGSUNG kehilangan akses', async () => {
    const x = await anggota(c19Tahun, { nama: 'Akan Dicabut Contoh' })
    expect(await isiRahasia(x)).toEqual([{ isi: 'isi rahasia' }])
    await db.query(`update public.devices set revoked_at = now() where id = $1`, [x.deviceId])
    expect(await isiRahasia(x)).toEqual([])
    expect((await siapaSaya(x)).id).toBeNull()
  })

  it('akses sementara berlaku sampai waktunya, lalu hilang sendiri', async () => {
    // Perangkat sementara untuk anggota biasa (akun yang sama, sesi baru).
    const sesiBaru = (await h.satu(`insert into auth.sessions (user_id) values ($1) returning id`, [biasa.userId])).id
    const d = (await h.satu(
      `insert into public.devices (member_id, session_id, via, expires_at) values ($1, $2, 'sementara', now() + interval '30 minutes') returning id`,
      [biasa.memberId, sesiBaru])).id
    const sementara = { userId: biasa.userId, sessionId: sesiBaru }
    expect(await isiRahasia(sementara)).toEqual([{ isi: 'isi rahasia' }])
    await db.query(`update public.devices set expires_at = now() - interval '1 second' where id = $1`, [d])
    expect(await isiRahasia(sementara)).toEqual([])
    expect(await isiRahasia(biasa)).toEqual([{ isi: 'isi rahasia' }]) // perangkat lain tidak terpengaruh
  })

  it('anggota yang dicabut kehilangan akses di semua perangkatnya', async () => {
    const x = await anggota(cTanpa, { nama: 'Dicabut Contoh' })
    await db.query(`update public.members set status = 'dicabut', revoked_at = now() where id = $1`, [x.memberId])
    expect(await isiRahasia(x)).toEqual([])
  })

  it('akses sementara wajib punya batas waktu', async () => {
    await expect(db.query(`insert into public.devices (member_id, session_id, via) values ($1, gen_random_uuid(), 'sementara')`, [biasa.memberId]))
      .rejects.toThrow(/devices_temporary_has_expiry/)
  })
})

describe('admin utama dan izin', () => {
  it('admin utama TANPA verifikasi dua langkah diperlakukan seperti anggota biasa', async () => {
    expect(await siapaSaya(owner, 'aal1')).toMatchObject({ edit: true, owner: false, bendahara: false })
  })
  it('admin utama DENGAN verifikasi dua langkah punya semua izin', async () => {
    expect(await siapaSaya(owner, 'aal2')).toMatchObject({ owner: true, bendahara: true, unduh: true })
  })
  it('asisten hanya punya izin yang dicentang', async () => {
    expect(await siapaSaya(asisten)).toMatchObject({ owner: false, bendahara: true, unduh: false })
    expect(await siapaSaya(biasa)).toMatchObject({ bendahara: false, unduh: false })
  })
  it('izin hanya untuk asisten, dan hanya izin yang dikenal', async () => {
    await expect(db.query(`update public.members set permissions = '{bendahara}' where id = $1`, [biasa.memberId])).rejects.toThrow(/members_permissions_only_assistant/)
    await expect(db.query(`update public.members set permissions = '{izin_palsu}' where id = $1`, [asisten.memberId])).rejects.toThrow(/members_permissions_known/)
  })
})

describe('admin utama tidak bisa diubah lewat aplikasi', () => {
  it('asisten tidak bisa mencabut atau menurunkan admin utama', async () => {
    await ditolak(jalankanLewatApi(asisten, `update public.members set status = 'dicabut', revoked_at = now() where is_owner`), 'AK001')
  })
  it('admin utama sendiri pun tidak bisa mencabut dirinya atau melepas statusnya', async () => {
    await ditolak(jalankanLewatApi(owner, `update public.members set status = 'dicabut', revoked_at = now() where is_owner`, 'aal2'), 'AK001')
    await ditolak(jalankanLewatApi(owner, `update public.members set is_owner = false where is_owner`, 'aal2'), 'AK001')
    await ditolak(jalankanLewatApi(owner, `update public.members set hold_until = 'infinity' where is_owner`, 'aal2'), 'AK001')
  })
  it('tidak ada yang bisa menjadikan dirinya (atau orang lain) admin utama lewat aplikasi', async () => {
    await ditolak(jalankanLewatApi(owner, `update public.members set is_owner = true where id = '${biasa.memberId}'`, 'aal2'), 'AK001')
    await ditolak(jalankanLewatApi(biasa, `update public.members set is_owner = true where id = '${biasa.memberId}'`), 'AK001')
  })
  it('admin utama tetap bisa mengganti nama tampilannya sendiri', async () => {
    await jalankanLewatApi(owner, `update public.members set display_name = 'Admin Baru Contoh' where is_owner`)
    expect((await h.satu(`select display_name from public.members where is_owner`)).display_name).toBe('Admin Baru Contoh')
  })
  it('anggota tidak bisa dihapus lewat aplikasi', async () => {
    await ditolak(jalankanLewatApi(owner, `delete from public.members where id = '${lihat.memberId}'`, 'aal2'), 'AK002')
    await ditolak(jalankanLewatApi(owner, `delete from public.members where is_owner`, 'aal2'), 'AK001')
  })
  it('akun login seorang anggota tidak bisa diganti', async () => {
    const lain = await buatPengguna(db)
    await ditolak(jalankanLewatApi(owner, `update public.members set auth_user_id = '${lain.userId}' where id = '${biasa.memberId}'`, 'aal2'), 'AK011')
  })
  it('lewat SQL Editor, admin utama bisa dipindahkan; dua admin utama tidak mungkin', async () => {
    await expect(db.query(`update public.members set is_owner = true where id = $1`, [biasa.memberId])).rejects.toThrow(/members_one_owner/)
    await db.transaction(async (tx) => {
      await tx.query(`update public.members set is_owner = false where id = $1`, [owner.memberId])
      await tx.query(`update public.members set is_owner = true where id = $1`, [biasa.memberId])
    })
    expect((await h.satu(`select id from public.members where is_owner`)).id).toBe(biasa.memberId)
    await db.transaction(async (tx) => {
      await tx.query(`update public.members set is_owner = false where id = $1`, [biasa.memberId])
      await tx.query(`update public.members set is_owner = true where id = $1`, [owner.memberId])
    })
  })
})

describe('peran, izin, dan status hanya diatur admin utama', () => {
  const jadikanAsisten = `update public.members set role = 'asisten', permissions = '{tempat_sampah}' where id = `
  it('asisten dan admin utama tanpa verifikasi dua langkah ditolak', async () => {
    await ditolak(jalankanLewatApi(asisten, `${jadikanAsisten}'${biasa.memberId}'`), 'AK002')
    await ditolak(jalankanLewatApi(owner, `${jadikanAsisten}'${biasa.memberId}'`, 'aal1'), 'AK002')
    await ditolak(jalankanLewatApi(biasa, `update public.members set role = 'anggota' where id = '${lihat.memberId}'`), 'AK002')
  })
  it('admin utama dengan verifikasi dua langkah bisa', async () => {
    await jalankanLewatApi(owner, `${jadikanAsisten}'${biasa.memberId}'`, 'aal2')
    expect((await siapaSaya(biasa))).toMatchObject({ bendahara: false })
    await jalankanLewatApi(owner, `update public.members set role = 'anggota', permissions = '{}' where id = '${biasa.memberId}'`, 'aal2')
  })
  it('anggota baru lewat aplikasi tidak bisa langsung menjadi asisten atau admin utama', async () => {
    await ditolak(jalankanLewatApi(asisten, `insert into public.members (person_id, display_name, role) values ('${c19Tahun}', 'X', 'asisten')`), 'AK002')
    await ditolak(jalankanLewatApi(owner, `insert into public.members (person_id, display_name, is_owner) values ('${c19Tahun}', 'X', true)`, 'aal2'), 'AK001')
  })
  it('anggota harus orang di silsilah utama', async () => {
    const pohon = await h.pohonAsal(m)
    const orangPohon = await h.orang('Orang Pohon Asal Contoh', { tree_id: pohon })
    await ditolak(db.query(`insert into public.members (person_id, display_name) values ($1, 'X')`, [orangPohon]), 'AK003')
  })
})

describe('perangkat', () => {
  it('perangkat yang dicabut tidak bisa diaktifkan lagi, masa berlaku tidak bisa diubah', async () => {
    const x = await anggota(c17nikah, { nama: 'Perangkat Contoh' })
    await jalankanLewatApi(x, `update public.devices set last_seen_at = now(), label = 'HP Contoh' where id = '${x.deviceId}'`)
    await ditolak(jalankanLewatApi(x, `update public.devices set expires_at = now() + interval '1 year' where id = '${x.deviceId}'`), 'AK007')
    await jalankanLewatApi(owner, `update public.devices set revoked_at = now() where id = '${x.deviceId}'`, 'aal2')
    await ditolak(jalankanLewatApi(owner, `update public.devices set revoked_at = null where id = '${x.deviceId}'`, 'aal2'), 'AK007')
  })
  it('perangkat tidak bisa didaftarkan untuk anggota yang dicabut', async () => {
    const dicabut = (await h.satu(`select id from public.members where status = 'dicabut' limit 1`)).id
    await ditolak(db.query(`insert into public.devices (member_id, session_id, via) values ($1, gen_random_uuid(), 'undangan')`, [dicabut]), 'AK007')
  })
})

describe('undangan', () => {
  const undang = async (personId, { konfirmasi = false } = {}) => {
    const mem = (await h.satu(`select id from public.members where person_id = $1`, [personId]))
      ?? (await h.satu(`insert into public.members (person_id, display_name) values ($1, 'Diundang Contoh') returning id`, [personId]))
    return (await h.satu(
      `insert into private.invites (member_id, token_hash, adult_confirmed_by) values ($1, $2, $3) returning id`,
      [mem.id, hash(nomorHash++), konfirmasi ? owner.memberId : null])).id
  }

  it('dewasa (tahun lahir pasti ≥ 18 tahun lalu) dan menantu boleh diundang', async () => {
    expect(await undang(c19Tahun)).toBeTruthy()
    expect(await undang(m)).toBeTruthy()
  })
  it('di bawah 18 dan belum menikah ditolak; menikah walau 17 tahun boleh', async () => {
    await ditolak(undang(c16), 'AK004')
    expect(await undang(c17nikah)).toBeTruthy()
  })
  it('hanya tahun lahir yang diketahui: dihitung hati-hati (belum tentu 18)', async () => {
    await ditolak(undang(c18Tahun), 'AK004')
  })
  it('tanggal lahir tidak diketahui: perlu konfirmasi pembuat undangan', async () => {
    const x = await h.orang('Cucu Tanpa Tanggal Dua Contoh')
    await h.anak(ua, x)
    await ditolak(undang(x), 'AK005')
    expect(await undang(x, { konfirmasi: true })).toBeTruthy()
  })
  it('anggota yang aksesnya dicabut tidak bisa diundang lagi tanpa diaktifkan admin utama', async () => {
    await ditolak(undang(cTanpa, { konfirmasi: true }), 'AK012')
  })
  it('yang sudah wafat, atau bukan keturunan/menantu, ditolak', async () => {
    await ditolak(undang(cWafat), 'AK010')
    await ditolak(undang(orangLepas), 'AK003')
  })
  it('token hanya disimpan sebagai hash SHA-256', async () => {
    await expect(db.query(`insert into private.invites (member_id, token_hash) values ($1, 'token-asli')`, [biasa.memberId])).rejects.toThrow(/check/)
  })
  it('SEKALI PAKAI: setelah dipakai tidak bisa dipakai lagi', async () => {
    const id = await undang(c19Tahun)
    await db.query(`update private.invites set used_at = now() where id = $1`, [id])
    await ditolak(db.query(`update private.invites set used_at = now() + interval '1 minute' where id = $1`, [id]), 'AK006')
    await ditolak(db.query(`update private.invites set used_at = null where id = $1`, [id]), 'AK006')
  })
  it('link kedaluwarsa (7 hari) atau dicabut tidak bisa dipakai', async () => {
    const lama = await undang(c19Tahun)
    await db.exec(`alter table private.invites disable trigger b_guard`)
    await db.query(`update private.invites set expires_at = now() - interval '1 minute' where id = $1`, [lama])
    await db.exec(`alter table private.invites enable trigger b_guard`)
    await ditolak(db.query(`update private.invites set used_at = now() where id = $1`, [lama]), 'AK006')
    const dicabut = await undang(c19Tahun)
    await db.query(`update private.invites set revoked_at = now() where id = $1`, [dicabut])
    await ditolak(db.query(`update private.invites set used_at = now() where id = $1`, [dicabut]), 'AK006')
  })
  it('berlaku 7 hari secara bawaan', async () => {
    const r = await h.satu(`select extract(epoch from (expires_at - created_at)) / 86400 as hari from private.invites limit 1`)
    expect(Number(r.hari)).toBeCloseTo(7, 3)
  })
})

describe('kode perangkat dan akses sementara', () => {
  const kode = (extra = {}) => {
    const kolom = { member_id: biasa.memberId, code_hash: hash(nomorHash++), kind: 'tambah_perangkat', ...extra }
    const k = Object.keys(kolom)
    return h.satu(`insert into private.device_codes (${k.join(', ')}) values (${k.map((_, i) => `$${i + 1}`).join(', ')}) returning id`, Object.values(kolom))
  }
  it('berlaku 10 menit dan sekali pakai', async () => {
    const { id } = await kode()
    const r = await h.satu(`select extract(epoch from (expires_at - created_at)) / 60 as menit from private.device_codes where id = $1`, [id])
    expect(Number(r.menit)).toBeCloseTo(10, 3)
    await db.query(`update private.device_codes set used_at = now() where id = $1`, [id])
    await ditolak(db.query(`update private.device_codes set used_at = now() + interval '1 second' where id = $1`, [id]), 'AK008')
  })
  it('akses sementara: wajib punya durasi, dan tidak boleh melebihi batas admin', async () => {
    await expect(kode({ kind: 'akses_sementara' })).rejects.toThrow(/device_codes_minutes_match_kind/)
    expect(await kode({ kind: 'akses_sementara', access_minutes: 1440 })).toBeTruthy()
    await ditolak(kode({ kind: 'akses_sementara', access_minutes: 1500 }), 'AK009')
  })
  it('hitungan percobaan salah tidak bisa dikurangi', async () => {
    const { id } = await kode()
    await db.query(`update private.device_codes set attempts = 3 where id = $1`, [id])
    await ditolak(db.query(`update private.device_codes set attempts = 0 where id = $1`, [id]), 'AK008')
  })
})

describe('log login dan alamat IP', () => {
  it('IP mentah berumur lebih dari 30 hari dihapus; kota/negara di log tetap ada', async () => {
    const ev = await h.satu(`insert into private.auth_events (member_id, event, device_type, approx_city, approx_country)
      values ($1, 'undangan_dipakai', 'iPhone', 'Kota Contoh', 'ID') returning id`, [biasa.memberId])
    await db.query(`insert into private.login_ips (event_id, ip, at) values ($1, '203.0.113.7', now() - interval '31 days'),
      ($1, '203.0.113.8', now() - interval '29 days')`, [ev.id])
    const [r] = await baris(db, `select private.purge_old_login_ips() as dihapus`)
    expect(r.dihapus).toBe(1)
    const sisa = await baris(db, `select host(ip) as ip from private.login_ips where event_id = $1`, [ev.id])
    expect(sisa).toEqual([{ ip: '203.0.113.8' }])
    expect((await h.satu(`select approx_city from private.auth_events where id = $1`, [ev.id])).approx_city).toBe('Kota Contoh')
  })
  it('kode negara harus 2 huruf besar (ISO)', async () => {
    await expect(db.query(`insert into private.auth_events (event, approx_country) values ('keluar', 'Indonesia')`)).rejects.toThrow(/check/)
  })
})

describe('pelaku perubahan tercatat', () => {
  it('created_by/updated_by terisi anggota yang sedang login', async () => {
    await jalankanLewatApi(biasa, `insert into public.people (full_name) values ('Dibuat Lewat Aplikasi Contoh')`)
    const r = await h.satu(`select created_by, updated_by from public.people where full_name = 'Dibuat Lewat Aplikasi Contoh'`)
    expect(r).toEqual({ created_by: biasa.memberId, updated_by: biasa.memberId })
  })
  it('lewat SQL Editor pelakunya kosong', async () => {
    const id = await h.orang('Dibuat Lewat SQL Contoh')
    expect((await h.satu(`select created_by from public.people where id = $1`, [id])).created_by).toBeNull()
  })
})

describe('tertutup lewat API (policy datang di 005)', () => {
  it('anon dan authenticated belum bisa membaca tabel akses', async () => {
    for (const t of ['public.members', 'public.devices', 'private.invites', 'private.device_codes', 'private.auth_events', 'private.login_ips']) {
      await expect(sebagai(db, 'anon', {}, (tx) => baris(tx, `select * from ${t}`))).rejects.toThrow(/permission denied/)
      await expect(lewatApi(owner, (tx) => baris(tx, `select * from ${t}`), 'aal2')).rejects.toThrow(/permission denied/)
    }
  })
})
