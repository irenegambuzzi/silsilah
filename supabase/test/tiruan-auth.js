// Tiruan bagian Supabase yang dipakai Edge Function: supabase.auth.admin
// (createUser, generateLink, getUserById) + verifyOtp di aplikasi, dan
// supabase.rpc() sebagai service_role. Semua di atas database tes.
import { expect } from 'vitest'
import { sebagai } from './tiruan-supabase.js'
import { panggilFungsi } from './pembantu-akses.js'

// Query sebagai pemilik database, aman walaupun permintaan lain sedang
// berjalan bersamaan (PGlite tidak mengembalikan peran sesi setelah transaksi).
const sebagaiPemilik = (db, sql, params) =>
  db.transaction(async (tx) => {
    await tx.exec('set local session authorization postgres; reset role')
    return (await tx.query(sql, params)).rows
  })

// Tiruan supabase.auth.admin di atas tabel auth.users database tes.
export function buatTiruanAuth(db) {
  const tautan = new Map()
  const t = {
    gangguan: null, // nama metode yang dibuat gagal (gangguan server)
    async getUserById(id) {
      if (t.gangguan === 'getUserById') return { data: { user: null }, error: { status: 500, message: 'Internal Server Error' } }
      const [u] = await sebagaiPemilik(db, 'select id, email from auth.users where id = $1', [id])
      return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { code: 'user_not_found', status: 404 } }
    },
    async createUser({ email }) {
      if (t.gangguan === 'createUser') return { data: { user: null }, error: { status: 500, message: 'Internal Server Error' } }
      try {
        const [u] = await sebagaiPemilik(db, 'insert into auth.users (email) values ($1) returning id, email', [email])
        return { data: { user: u }, error: null }
      } catch (e) {
        if (e.code !== '23505') throw e
        return { data: { user: null }, error: { code: 'email_exists', status: 422, message: 'A user with this email address has already been registered' } }
      }
    },
    async generateLink({ type, email }) {
      if (t.gangguan === 'generateLink') return { data: { properties: null, user: null }, error: { status: 500, message: 'Internal Server Error' } }
      expect(type).toBe('magiclink')
      const [u] = await sebagaiPemilik(db, 'select id, email from auth.users where email = $1', [email])
      if (!u) return { data: { properties: null, user: null }, error: { code: 'user_not_found', status: 404 } }
      const hashed_token = crypto.randomUUID().replaceAll('-', '')
      tautan.set(hashed_token, u.id)
      return { data: { properties: { hashed_token }, user: u }, error: null }
    },
    // Seperti supabase.auth.verifyOtp({ token_hash, type }) di aplikasi:
    // sekali pakai, menghasilkan sesi baru.
    async verifyOtp(tokenHash) {
      const userId = tautan.get(tokenHash)
      if (!userId) throw new Error('token_hash tidak berlaku')
      tautan.delete(tokenHash)
      const [s] = await sebagaiPemilik(db, 'insert into auth.sessions (user_id) values ($1) returning id', [userId])
      return { userId, sessionId: s.id }
    },
  }
  return t
}

// Tiruan supabase.rpc() dari Edge Function: role service_role.
export const rpcLayanan = (db) => (nama, args) =>
  sebagai(db, 'service_role', {}, (tx) => panggilFungsi(tx, nama, args)).then(
    (data) => ({ data, error: null }),
    (e) => ({ data: null, error: { code: e.code, message: e.message } }),
  )
