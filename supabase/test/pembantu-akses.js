// Pembantu tes untuk anggota, perangkat, dan panggilan RPC seperti dari
// aplikasi atau Edge Function. Semua orang FIKTIF.
import { expect } from 'vitest'
import { baris, buatPengguna, klaimUntuk, sebagai } from './tiruan-supabase.js'

// Galat dengan kode tertentu (AK001, 42501, …).
export async function ditolak(janji, kode) {
  const e = await janji.then(() => null, (err) => err)
  expect(e, `seharusnya ditolak dengan ${kode}`).not.toBeNull()
  expect(e.code ?? e.message).toBe(kode)
  return e
}

// "select public.nama(p_a => $1, …)": argumen bernama, seperti supabase.rpc().
export async function panggilFungsi(tx, nama, args = {}) {
  const kunci = Object.keys(args)
  const nilai = kunci.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]))
  const daftar = kunci.map((k, i) => `${k} => $${i + 1}`).join(', ')
  const [r] = await baris(tx, `select public.${nama}(${daftar}) as hasil`, nilai)
  return r.hasil
}

export const pembantuAkses = (db) => {
  const lewatApi = (akun, fn, aal = 'aal1') => sebagai(db, 'authenticated', klaimUntuk(akun, aal), fn)
  return {
    lewatApi,
    // RPC dari aplikasi (role authenticated, klaim JWT akun itu).
    rpc: (akun, nama, args, aal = 'aal1') => lewatApi(akun, (tx) => panggilFungsi(tx, nama, args), aal),
    // RPC dari Edge Function (service_role).
    rpcServer: (nama, args) => sebagai(db, 'service_role', {}, (tx) => panggilFungsi(tx, nama, args)),
    siapa: async (akun) =>
      (await lewatApi(akun, (tx) => baris(tx, 'select public.current_member_id() as id')))[0].id,

    // Anggota + akun login + satu perangkat (dibuat lewat "SQL Editor").
    async anggota(personId, { role = 'anggota', permissions = [], isOwner = false, nama = 'Anggota Contoh', via = 'undangan', expiresAt = null } = {}) {
      const akun = await buatPengguna(db)
      const [m] = await baris(db,
        `insert into public.members (person_id, display_name, role, permissions, is_owner, auth_user_id)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [personId, nama, role, permissions, isOwner, akun.userId])
      const [d] = await baris(db,
        `insert into public.devices (member_id, session_id, via, expires_at) values ($1, $2, $3, $4) returning id`,
        [m.id, akun.sessionId, via, expiresAt])
      return { ...akun, memberId: m.id, deviceId: d.id }
    },

    // Sesi baru untuk akun yang sama (seperti setelah verifyOtp di perangkat baru).
    async sesiBaru(userId) {
      const [s] = await baris(db, `insert into auth.sessions (user_id) values ($1) returning id`, [userId])
      return { userId, sessionId: s.id }
    },

    // Kotak masuk admin utama: penanda posisi, lalu pesan yang masuk sesudahnya.
    penandaNotifikasi: async () =>
      (await baris(db, 'select coalesce(max(id), 0)::int as n from public.notifications'))[0].n,
    notifikasiAdminSejak: (penanda) =>
      baris(db, `select n.kind, n.title, n.body, n.priority from public.notifications n
                 join public.members m on m.id = n.member_id and m.is_owner
                 where n.id > $1 order by n.id`, [penanda]),
  }
}
