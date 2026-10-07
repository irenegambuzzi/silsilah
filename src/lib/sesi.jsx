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
// Aplikasi tidak pernah menulis data apa pun di sini, kecuali lewat fungsi
// server untuk masuk dan keluar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { petakanGalat } from './galat.js'
import { bacaAnggotaSaya, bacaVersiDatabase, cekPerangkat, jalankanMasuk, keluarDariPerangkat } from './api.js'
import { hapusDataLokal } from './penyimpanan.js'
import { klienBawaan } from './supabase.js'
import { tafsirkanVersiDatabase } from './versiDatabase.js'

import { Konteks } from './konteksSesi.js'

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export function SesiProvider({ klien = klienBawaan, children }) {
  const [keadaan, setKeadaan] = useState({
    status: klien ? 'memuat' : 'belumDisiapkan',
    anggota: null,
    galat: null,
    alasanKeluar: null,
  })
  const sedangKeluar = useRef(false)

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
      setKeadaan({ status: 'tamu', anggota: null, galat: null, alasanKeluar: alasan })
      sedangKeluar.current = false
    },
    [klien]
  )

  const muat = useCallback(async () => {
    if (!klien) return
    try {
      const { data } = await klien.auth.getSession()
      if (!data?.session) {
        setKeadaan((s) => ({ ...s, status: 'tamu', anggota: null, galat: null }))
        return
      }
      const cek = await cekPerangkat(klien)
      if (cek.status === 'dicabut') return await akhiri('dicabut')
      if (cek.status === 'kedaluwarsa') return await akhiri('berakhir')
      if (cek.status !== 'ok') return await akhiri(null)

      const versi = tafsirkanVersiDatabase(await bacaVersiDatabase(klien), { online: online() })
      if (!versi.siap) {
        setKeadaan((s) => ({ ...s, status: 'galat', anggota: null, galat: versi }))
        return
      }
      const anggota = await bacaAnggotaSaya(klien)
      setKeadaan((s) => ({ ...s, status: 'masuk', anggota, galat: null }))
    } catch (e) {
      const galat = petakanGalat(e, { online: online() })
      if (galat.jenis === 'sesiHabis') return await akhiri('sesi')
      setKeadaan((s) => ({ ...s, status: 'galat', anggota: null, galat }))
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

  const akhiriRef = useRef(akhiri)
  useEffect(() => {
    akhiriRef.current = akhiri
  }, [akhiri])
  useEffect(() => {
    if (!klien) return undefined
    // Memeriksa sesi saat aplikasi dibuka; setState terjadi setelah jawaban server.
    // oxlint-disable-next-line react/set-state-in-effect
    muat()
    // Keluar dari tab lain, atau sesi tidak bisa diperbarui lagi.
    const { data } = klien.auth.onAuthStateChange((peristiwa) => {
      if (peristiwa === 'SIGNED_OUT' && !sedangKeluar.current) akhiriRef.current('sesi')
    })
    return () => data?.subscription?.unsubscribe()
  }, [klien, muat])

  const nilai = useMemo(
    () => ({ ...keadaan, klien, masuk, keluar, akhiri, coba, muat }),
    [keadaan, klien, masuk, keluar, akhiri, coba, muat]
  )
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}
