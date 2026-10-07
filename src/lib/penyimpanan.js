// Penyimpanan di perangkat dan penghapusannya.
//
// Alamat situs di GitHub Pages dipakai bersama semua proyek milik akun yang
// sama (origin-nya sama), jadi SEMUA yang disimpan aplikasi ini diberi
// awalan "silsilah", dan saat keluar HANYA yang berawalan itu yang dihapus.
// Data proyek lain di alamat yang sama tidak tersentuh.
//
// Yang dihapus saat keluar, akses sementara habis, atau perangkat dicabut:
// sesi login, salinan data (nanti, langkah 1.20), dan semua penyimpanan
// berawalan "silsilah". Satu pengecualian: pilihan tampilan (ukuran huruf
// dan kontras) bukan data keluarga, jadi tetap ada.

export const AWALAN = 'silsilah'
export const KUNCI = {
  auth: 'silsilah-auth',
  tampilan: 'silsilah-tampilan',
  aksesBerakhir: 'silsilah-akses-berakhir',
}
const DIPERTAHANKAN = new Set([KUNCI.tampilan])

const aman = (fn, cadangan = null) => {
  try {
    return fn()
  } catch {
    return cadangan
  }
}
// Sama, untuk pekerjaan asinkron: galat yang datang belakangan juga ditelan.
const amanAsinkron = async (fn) => {
  try {
    await fn()
  } catch {
    // Bagian lain tetap dijalankan.
  }
}

export const bacaTersimpan = (kunci, penyimpanan = globalThis.localStorage) => aman(() => penyimpanan.getItem(kunci))
export const tulisTersimpan = (kunci, nilai, penyimpanan = globalThis.localStorage) =>
  aman(() => (nilai == null ? penyimpanan.removeItem(kunci) : penyimpanan.setItem(kunci, nilai)))

// Kapan akses sementara di perangkat ini berakhir (ISO). Disimpan supaya
// data bisa dihapus saat aplikasi dibuka lagi walaupun tidak ada internet.
export const bacaAksesBerakhir = () => {
  const t = Date.parse(bacaTersimpan(KUNCI.aksesBerakhir) ?? '')
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}
export const simpanAksesBerakhir = (iso) => tulisTersimpan(KUNCI.aksesBerakhir, iso)

function hapusKunciBerawalan(penyimpanan) {
  if (!penyimpanan) return 0
  const kunci = []
  for (let i = 0; i < penyimpanan.length; i++) kunci.push(penyimpanan.key(i))
  const dihapus = kunci.filter((k) => k && k.startsWith(AWALAN) && !DIPERTAHANKAN.has(k))
  dihapus.forEach((k) => penyimpanan.removeItem(k))
  return dihapus.length
}

const NAMA_IDB_BAWAAN = ['silsilah']

// Menghapus semua data aplikasi di perangkat ini. Tidak pernah melempar
// galat: setiap bagian dicoba sendiri-sendiri. Hasil: ringkasan jumlah.
export async function hapusDataLokal(env = globalThis) {
  const hasil = { penyimpananLokal: 0, penyimpananSesi: 0, basisData: 0, cache: 0 }
  hasil.penyimpananLokal = aman(() => hapusKunciBerawalan(env.localStorage), 0)
  hasil.penyimpananSesi = aman(() => hapusKunciBerawalan(env.sessionStorage), 0)

  await amanAsinkron(async () => {
    const idb = env.indexedDB
    if (!idb) return
    let nama = NAMA_IDB_BAWAAN
    if (typeof idb.databases === 'function') nama = (await idb.databases()).map((d) => d.name)
    for (const n of nama.filter((x) => x && x.startsWith(AWALAN))) {
      await new Promise((selesai) => {
        const r = idb.deleteDatabase(n)
        r.onsuccess = r.onerror = r.onblocked = () => selesai()
      })
      hasil.basisData++
    }
  })

  await amanAsinkron(async () => {
    if (!env.caches) return
    for (const n of (await env.caches.keys()).filter((x) => x.startsWith(AWALAN))) {
      await env.caches.delete(n)
      hasil.cache++
    }
  })
  return hasil
}
