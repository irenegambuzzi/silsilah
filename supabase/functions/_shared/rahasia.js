// Bentuk dan hash token undangan serta kode perangkat. Dipakai Edge
// Function (Deno) dan tes (Node); hanya memakai Web Crypto, yang ada di
// keduanya. Hash di sini HARUS sama dengan private.sha256_hex() di SQL 009.

// Token undangan: 32 byte acak dalam base64url (43 karakter).
export const BENTUK_TOKEN = /^[A-Za-z0-9_-]{43}$/

// Kode perangkat: 8 karakter tanpa 0/O dan 1/I (lihat private.random_code()).
export const BENTUK_KODE = /^[2-9A-HJ-NP-Z]{8}$/

// "abcd-2345", "ABCD 2345" → "ABCD2345".
export const rapikanKode = (masukan) => String(masukan ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

export async function sha256Hex(teks) {
  const hasil = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks))
  return Array.from(new Uint8Array(hasil), (b) => b.toString(16).padStart(2, '0')).join('')
}
