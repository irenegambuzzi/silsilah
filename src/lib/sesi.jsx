// Pengelola sesi: siapa yang sedang masuk dari perangkat ini.
//
// status:
//   memuat          sedang memeriksa sesi dan perangkat
//   belumDisiapkan  alamat/kunci database belum diisi (tidak ada klien)
//   tamu            belum masuk
//   masuk           sudah masuk, perangkat terdaftar dan sah
//   galat           tidak bisa memeriksa (jaringan, server dijeda, database
//                   belum diperbarui); `galat` berisi hasil petakanGalat()
//
// `berakhir`: waktu (ISO) akses sementara di perangkat ini berakhir, atau
// null untuk akses biasa. Saat waktunya habis aplikasi keluar sendiri dan
// menghapus semua data aplikasi di perangkat. Kalau perangkat sedang mati
// atau aplikasi sedang ditutup, penghapusan dilakukan begitu aplikasi dibuka
// lagi (waktu berakhir disimpan di perangkat; server juga sudah menolak
// semua permintaan data sejak waktunya habis).
//
// `duaLangkah` (hanya untuk admin utama, null untuk anggota lain):
// { level: 'aal1' | 'aal2' | null, faktor: [...] | null }. Layar admin hanya
// dibuka kalau level 'aal2' (lihat components/KhususAdmin.jsx); server juga
// menolak fungsi admin tanpa itu. faktor null = status belum terbaca.
//
// Aplikasi tidak pernah menulis data apa pun di sini, kecuali lewat fungsi
// server untuk masuk dan keluar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { petakanGalat } from './galat.js'
import { bacaAnggotaSaya, bacaVersiDatabase, cekPerangkat, jalankanMasuk, keluarDariPerangkat, statusDuaLangkah } from './api.js'
import { Konteks } from './konteksSesi.js'
import { bacaAksesBerakhir, hapusDataLokal, simpanAksesBerakhir } from './penyimpanan.js'
import { klienBawaan } from './supabase.js'
import { tafsirkanVersiDatabase } from './versiDatabase.js'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine)
// Jarak minimal antar pemeriksaan ulang ke server saat aplikasi kembali dibuka.
const JEDA_PERIKSA_ULANG_MS = 60 * 1000

// Status dua langkah admin utama; kalau tidak terbaca, layar admin tetap
// tertutup dan layar verifikasi menawarkan "Coba lagi".
async function bacaDuaLangkah(klien, anggota) {
  if (!anggota?.pemilik) return null
  try {
    return await statusDuaLangkah(klien)
  } catch {
    return { level: null, faktor: null }
  }
}

export function SesiProvider({ klien = klienBawaan, children }) {
  const [keadaan, setKeadaan] = useState({
    status: klien ? 'memuat' : 'belumDisiapkan',
    anggota: null,
    duaLangkah: null,
    berakhir: null,
    galat: null,
    alasanKeluar: null,
  })
  const sedangKeluar = useRef(false)
  const keadaanRef = useRef(keadaan)
  useEffect(() => {
    keadaanRef.current = keadaan
  }, [keadaan])
  const terakhirPeriksa = useRef(0)

  // Menghapus sesi dan semua data aplikasi di perangkat ini.
  const akhiri = useCallback(
    async (alasan = null) => {
      sedangKeluar.current = true
      try {
        await klien?.auth.signOut({ scope: 'local' })
      } catch {
        // Sesi lokal dihapus supabase-js walaupun server tidak terjangkau.
      }
      await hapusDataLokal()
      setKeadaan({ status: 'tamu', anggota: null, duaLangkah: null, berakhir: null, galat: null, alasanKeluar: alasan })
      sedangKeluar.current = false
    },
    [klien]
  )

  const muat = useCallback(async () => {
    if (!klien) return
    try {
      const { data } = await klien.auth.getSession()
      if (!data?.session) {
        setKeadaan((s) => ({ ...s, status: 'tamu', anggota: null, duaLangkah: null, berakhir: null, galat: null }))
        return
      }
      const cek = await cekPerangkat(klien)
      terakhirPeriksa.current = Date.now()
      if (cek.status === 'dicabut') return await akhiri('dicabut')
      if (cek.status === 'kedaluwarsa') return await akhiri('berakhir')
      if (cek.status !== 'ok') return await akhiri(null)

      const versi = tafsirkanVersiDatabase(await bacaVersiDatabase(klien), { online: online() })
      if (!versi.siap) {
        setKeadaan((s) => ({ ...s, status: 'galat', anggota: null, duaLangkah: null, galat: versi }))
        return
      }
      const anggota = await bacaAnggotaSaya(klien)
      const duaLangkah = await bacaDuaLangkah(klien, anggota)
      const berakhir = cek.berakhir ?? null
      simpanAksesBerakhir(berakhir)
      setKeadaan((s) => ({ ...s, status: 'masuk', anggota, duaLangkah, berakhir, galat: null }))
    } catch (e) {
      const galat = petakanGalat(e, { online: online() })
      if (galat.jenis === 'sesiHabis') return await akhiri('sesi')
      setKeadaan((s) => ({ ...s, status: 'galat', anggota: null, duaLangkah: null, galat }))
    }
  }, [klien, akhiri])

  const coba = useCallback(() => {
    setKeadaan((s) => ({ ...s, status: 'memuat', galat: null }))
    return muat()
  }, [muat])

  // Memakai link undangan atau kode. Hasil: { ok: true, via, berakhir, nama }
  // atau { ok: false, alasan }; gangguan server/jaringan melempar galat.
  const masuk = useCallback(
    async (jenis, rahasia) => {
      const hasil = await jalankanMasuk(klien, jenis, rahasia)
      if (hasil.ok) await muat()
      return hasil
    },
    [klien, muat]
  )

  // Keluar dari perangkat ini, atau dari semua perangkat milik anggota ini.
  // Perangkat ini selalu keluar, walaupun server tidak terjangkau.
  const keluar = useCallback(
    async ({ semua = false } = {}) => {
      // Selama keluar, peristiwa SIGNED_OUT dari Supabase tidak boleh memicu
      // keluar kedua (akhiri() yang mengembalikan penanda ini).
      sedangKeluar.current = true
      let gagalPerangkatLain = false
      try {
        await keluarDariPerangkat(klien, semua)
      } catch {
        gagalPerangkatLain = semua
      }
      if (semua) {
        try {
          await klien.auth.signOut({ scope: 'global' })
        } catch {
          // Perangkat ini tetap dikeluarkan di bawah.
        }
      }
      await akhiri(gagalPerangkatLain ? 'keluarGagalLain' : 'keluar')
      return { gagalPerangkatLain }
    },
    [klien, akhiri]
  )

  // Dibaca ulang setelah memasukkan kode, mendaftarkan, atau menghapus authenticator.
  const perbaruiDuaLangkah = useCallback(async () => {
    const anggota = keadaanRef.current.anggota
    const duaLangkah = await bacaDuaLangkah(klien, anggota)
    setKeadaan((s) => (s.anggota === anggota ? { ...s, duaLangkah } : s))
    return duaLangkah
  }, [klien])

  const akhiriRef = useRef(akhiri)
  const muatRef = useRef(muat)
  useEffect(() => {
    akhiriRef.current = akhiri
    muatRef.current = muat
  }, [akhiri, muat])

  // Saat aplikasi dibuka: kalau akses sementara yang tersimpan sudah lewat,
  // hapus data DULU (tanpa menunggu server), baru periksa sesi.
  useEffect(() => {
    if (!klien) return undefined
    const tersimpan = bacaAksesBerakhir()
    const sudahLewat = tersimpan && Date.parse(tersimpan) <= Date.now()
    // Memeriksa sesi saat aplikasi dibuka; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    if (sudahLewat) akhiriRef.current('berakhir')
    else muatRef.current()
    // Keluar dari tab lain, atau sesi tidak bisa diperbarui lagi.
    const { data } = klien.auth.onAuthStateChange((peristiwa) => {
      if (peristiwa === 'SIGNED_OUT' && !sedangKeluar.current) akhiriRef.current('sesi')
    })
    return () => data?.subscription?.unsubscribe()
  }, [klien])

  // Selama masuk: keluar sendiri tepat saat akses sementara habis, dan saat
  // aplikasi kembali terlihat (pengatur waktu bisa tertunda di latar belakang)
  // periksa waktu lokal lalu tanyakan lagi ke server (dicabut? kedaluwarsa?).
  const { status, berakhir } = keadaan
  useEffect(() => {
    if (status !== 'masuk' || !klien) return undefined
    const tujuan = berakhir ? Date.parse(berakhir) : null
    const habis = () => tujuan != null && Date.now() >= tujuan
    const id = tujuan == null ? null : setTimeout(() => habis() && akhiriRef.current('berakhir'), Math.max(0, tujuan - Date.now()))

    const saatTampak = async () => {
      if (document.visibilityState !== 'visible') return
      if (habis()) return akhiriRef.current('berakhir')
      if (Date.now() - terakhirPeriksa.current < JEDA_PERIKSA_ULANG_MS) return
      terakhirPeriksa.current = Date.now()
      try {
        const cek = await cekPerangkat(klien)
        if (cek.status === 'dicabut') await akhiriRef.current('dicabut')
        else if (cek.status === 'kedaluwarsa') await akhiriRef.current('berakhir')
        else if (cek.status !== 'ok') await akhiriRef.current(null)
      } catch {
        // Tanpa internet: tetap di tempat; waktu lokal sudah diperiksa di atas.
      }
    }
    document.addEventListener('visibilitychange', saatTampak)
    return () => {
      if (id != null) clearTimeout(id)
      document.removeEventListener('visibilitychange', saatTampak)
    }
  }, [status, berakhir, klien])

  const nilai = useMemo(
    () => ({ ...keadaan, klien, masuk, keluar, akhiri, coba, muat, perbaruiDuaLangkah }),
    [keadaan, klien, masuk, keluar, akhiri, coba, muat, perbaruiDuaLangkah]
  )
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}
