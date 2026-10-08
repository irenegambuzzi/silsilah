// Lapisan data silsilah untuk semua layar.
//
// Setelah masuk, SEMUA data silsilah yang boleh dibaca anggota ini dimuat
// sekali, lalu diperbarui secara live (Realtime). Data diambil ulang saat
// internet tersambung lagi, saat sambungan live pulih, dan saat aplikasi
// kembali dibuka setelah lebih dari 1 menit.
//
// status:
//   nonaktif  belum masuk
//   memuat    memuat pertama kali (belum ada yang bisa ditampilkan)
//   siap      data tersedia (dari server, atau dari salinan saat offline)
//   kosong    silsilah utama belum berisi siapa pun: "Belum ada data, hubungi admin"
//   galat     tidak bisa dimuat dan tidak ada salinan; `galat` = hasil petakanGalat()
// sumber: 'server' | 'salinan'. waktu: kapan data itu diambil (ISO).
// galat juga terisi saat data masih tampil tetapi pembaruan gagal.
// live: true selama sambungan Realtime aktif.
//
// LAPISAN INI TIDAK PERNAH MENULIS KE DATABASE. Gagal memuat, offline, dan
// database kosong hanya menghasilkan layar keterangan; tidak ada data bawaan
// yang dibuat, dan data contoh tidak pernah dipakai sebagai pengganti (mode
// contoh hanya ada di build pengembangan). Satu-satunya yang ditulis adalah
// salinan offline DI PERANGKAT (salinan.js), tanpa data kontak, dan tidak
// sama sekali di perangkat dengan akses sementara.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { petakanGalat } from '../galat.js'
import { useSesi } from '../konteksSesi.js'
import { generasiPenghapusan } from '../penyimpanan.js'
import { KonteksData } from './konteksData.js'
import { dataKosong } from './kolom.js'
import { muatSemua } from './muat.js'
import { terapkanPerubahan } from './perubahan.js'
import { dengarkanPerubahan } from './realtime.js'
import { GALAT_PAKAI_SALINAN, bacaSalinanUntuk, tulisSalinan } from './salinan.js'

const AWAL = { status: 'nonaktif', data: null, sumber: null, waktu: null, galat: null, live: false }
const JEDA_MUAT_ULANG_MS = 60 * 1000
const JEDA_SIMPAN_MS = 2000
const PUTUS = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])
const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine)
const statusDari = (data) => (dataKosong(data) ? 'kosong' : 'siap')

export function DataSilsilahProvider({ children }) {
  const sesi = useSesi()
  const { status: statusSesi, klien, akun, anggota, berakhir } = sesi
  const aktif = (statusSesi === 'masuk' || statusSesi === 'offline') && Boolean(klien) && Boolean(akun)
  const idAnggota = anggota?.id ?? null
  // Perangkat pinjaman (akses sementara) tidak menyimpan salinan.
  const bolehSimpan = berakhir == null

  const [keadaan, setKeadaan] = useState(AWAL)
  const kendali = useRef(null)
  const terkini = useRef({ anggota, galatSesi: sesi.galat, akhiri: sesi.akhiri })
  useEffect(() => {
    terkini.current = { anggota, galatSesi: sesi.galat, akhiri: sesi.akhiri }
  }, [anggota, sesi.galat, sesi.akhiri])

  useEffect(() => {
    if (!aktif) return undefined
    let batal = false
    let data = null
    let antrean = null // perubahan live yang tiba selama memuat
    let sedangMuat = false
    let terakhirMuat = 0
    let putus = false
    let pewaktuSimpan = null
    const gen = generasiPenghapusan()

    // Setiap keadaan ditandai pemilik dan generasinya; nilai di bawah tidak
    // menampilkan keadaan milik akun lain atau dari sebelum keluar.
    const tampilkan = (isi) => {
      if (!batal) setKeadaan((s) => ({ ...s, ...isi, akun, gen }))
    }
    // Keluar (data lokal dihapus): data di memori juga dibuang. Sekadar
    // berpindah dari offline ke online: data lama tetap tampil sampai yang
    // baru masuk.
    const bersihkan = () => {
      if (generasiPenghapusan() !== gen) setKeadaan(AWAL)
    }
    const simpanNanti = () => {
      if (!bolehSimpan) return
      clearTimeout(pewaktuSimpan)
      pewaktuSimpan = setTimeout(() => {
        if (!batal && data) tulisSalinan({ akun, anggota: terkini.current.anggota, data }, gen)
      }, JEDA_SIMPAN_MS)
    }

    const pakaiSalinan = async (galat) => {
      const s = bolehSimpan ? await bacaSalinanUntuk(akun) : null
      if (batal) return
      if (s) {
        data = s.data
        tampilkan({ status: statusDari(s.data), data: s.data, sumber: 'salinan', waktu: s.disimpanPada, galat })
      } else {
        tampilkan({ status: 'galat', data: null, sumber: null, waktu: null, galat })
      }
    }

    const muatUlang = async () => {
      if (sedangMuat || batal) return
      sedangMuat = true
      antrean = []
      try {
        let baru = await muatSemua(klien)
        if (batal) return
        for (const p of antrean) baru = terapkanPerubahan(baru, p)
        data = baru
        terakhirMuat = Date.now()
        tampilkan({ status: statusDari(baru), data: baru, sumber: 'server', waktu: new Date().toISOString(), galat: null })
        simpanNanti()
      } catch (e) {
        if (batal) return
        const galat = petakanGalat(e, { online: online() })
        if (galat.jenis === 'sesiHabis') {
          terkini.current.akhiri?.('sesi')
        } else if (data) {
          tampilkan({ galat })
        } else if (GALAT_PAKAI_SALINAN.has(galat.jenis)) {
          await pakaiSalinan(galat)
        } else {
          tampilkan({ status: 'galat', galat })
        }
      } finally {
        antrean = null
        sedangMuat = false
      }
    }

    const saatPerubahan = (p) => {
      if (batal) return
      if (antrean) {
        antrean.push(p)
        return
      }
      if (!data) return
      data = terapkanPerubahan(data, p)
      tampilkan({ status: statusDari(data), data })
      simpanNanti()
    }
    const saatStatus = (s) => {
      if (batal) return
      if (s === 'SUBSCRIBED') {
        tampilkan({ live: true })
        // Perubahan selama terputus tidak terkirim: ambil ulang semuanya.
        if (putus) {
          putus = false
          muatUlang()
        }
      } else if (PUTUS.has(s)) {
        putus = true
        tampilkan({ live: false })
      }
    }

    if (statusSesi === 'offline') {
      // Sesi tidak bisa diperiksa ke server: hanya salinan di perangkat.
      kendali.current = null
      pakaiSalinan(terkini.current.galatSesi)
      return () => {
        batal = true
        bersihkan()
      }
    }

    const lepas = dengarkanPerubahan(klien, { saatPerubahan, saatStatus })
    kendali.current = { muatUlang }
    muatUlang()
    const saatOnline = () => muatUlang()
    const saatTampak = () => {
      if (document.visibilityState === 'visible' && Date.now() - terakhirMuat >= JEDA_MUAT_ULANG_MS) muatUlang()
    }
    window.addEventListener('online', saatOnline)
    document.addEventListener('visibilitychange', saatTampak)
    return () => {
      batal = true
      clearTimeout(pewaktuSimpan)
      lepas()
      kendali.current = null
      window.removeEventListener('online', saatOnline)
      document.removeEventListener('visibilitychange', saatTampak)
      bersihkan()
    }
  }, [aktif, statusSesi, klien, akun, idAnggota, bolehSimpan])

  // Tombol "Coba lagi". Saat offline, yang dicoba lagi adalah sambungan ke server.
  const { muat: muatSesi } = sesi
  const coba = useCallback(() => {
    if (statusSesi === 'offline') return muatSesi()
    setKeadaan((s) => (s.data ? s : { ...s, status: 'memuat', galat: null }))
    return kendali.current?.muatUlang()
  }, [statusSesi, muatSesi])

  const nilai = useMemo(() => {
    if (!aktif) return { ...AWAL, coba }
    if (keadaan.akun !== akun || keadaan.gen !== generasiPenghapusan()) return { ...AWAL, status: 'memuat', coba }
    const { status, data, sumber, waktu, galat, live } = keadaan
    return { status: status === 'nonaktif' ? 'memuat' : status, data, sumber, waktu, galat, live, coba }
  }, [aktif, akun, keadaan, coba])
  return <KonteksData.Provider value={nilai}>{children}</KonteksData.Provider>
}
