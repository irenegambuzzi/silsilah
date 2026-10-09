// Geser dan zoom Bagan dengan jari (satu jari menggeser, dua jari
// memperbesar/memperkecil), mouse (seret; Ctrl + roda atau cubit di trackpad
// untuk zoom), dan papan ketik (panah, + dan −, 0). Perilaku murni ada di pandang.js.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LEBAR_HP, geser, jagaTerlihat, pandangAwal, pandangHp, pusatkan, zoomDi } from './pandang.js'

const AMBANG_SERET_PX = 6
const LANGKAH_PANAH_PX = 80
const FAKTOR_TOMBOL = 1.25
const SKALA_TERBACA = 1

// Kartu (utama) seseorang di dalam isi bagan. Tanda kutip dan garis miring
// di id di-escape sendiri (CSS.escape tidak ada di semua lingkungan).
const kartuDi = (isi, id) => isi?.querySelector(`[data-orang="${String(id).replace(/["\\]/g, '\\$&')}"]`) ?? null

const jarak = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const tengah = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Letak kartu di dalam isi (sebelum zoom), dari rantai offsetParent.
function letakDiIsi(kartu, isi) {
  let x = kartu.offsetWidth / 2
  let y = kartu.offsetHeight / 2
  for (let e = kartu; e && e !== isi; e = e.offsetParent) {
    x += e.offsetLeft
    y += e.offsetTop
  }
  return { x, y }
}

// Kotak yang memuat kartu-kartu orang `ids` di dalam isi (sebelum zoom).
function kotakDiIsi(isi, ids) {
  const kotak = ids
    .map((id) => kartuDi(isi, id))
    .filter((k) => k && k.offsetWidth)
    .map((k) => {
      const t = letakDiIsi(k, isi)
      return { kiri: t.x - k.offsetWidth / 2, atas: t.y - k.offsetHeight / 2, kanan: t.x + k.offsetWidth / 2 }
    })
  if (kotak.length === 0) return null
  const kiri = Math.min(...kotak.map((k) => k.kiri))
  return { x: kiri, y: Math.min(...kotak.map((k) => k.atas)), lebar: Math.max(...kotak.map((k) => k.kanan)) - kiri }
}

// `kunci`: tampilan dikembalikan ke awal setiap kali kunci berubah (mis. pindah cabang).
// `pusat`: id orang yang diletakkan di tengah bingkai pada tampilan awal.
// `pangkal`: id kartu pasangan pangkal (atau pangkal cabang) yang di HP
//   diletakkan di tengah pada tampilan awal, dengan ukuran yang terbaca.
// `halangan(kotakBingkai)`: { atas, legenda } — bagian bingkai yang tertutup
//   bilah atas dan legenda; tampilan awal tidak meletakkan bagan di bawahnya.
export function useGeserZoom({ kunci, pusat = null, pangkal = [], halangan = null }) {
  const bingkai = useRef(null)
  const isi = useRef(null)
  const [pandang, setPandang] = useState({ x: 0, y: 0, k: 1 })
  const masukan = useRef({ pangkal, halangan })
  masukan.current = { pangkal, halangan }
  const titik = useRef(new Map())
  const gerak = useRef({ mulai: null, diseret: false, jarak: null, tengah: null })

  const ukuran = useCallback(() => {
    const b = bingkai.current
    const i = isi.current
    if (!b || !i || !b.clientWidth || !i.offsetWidth) return null
    return {
      bingkai: { lebar: b.clientWidth, tinggi: b.clientHeight },
      isi: { lebar: i.offsetWidth, tinggi: i.offsetHeight },
    }
  }, [])
  const jaga = useCallback(
    (p) => {
      const u = ukuran()
      return u ? jagaTerlihat(p, u.isi, u.bingkai) : p
    },
    [ukuran]
  )

  const ukurHalangan = useCallback(() => {
    const f = masukan.current.halangan
    return f && bingkai.current ? f(bingkai.current.getBoundingClientRect()) : {}
  }, [])
  // Tampilan awal: di HP pasangan pangkal di tengah dengan ukuran terbaca;
  // di layar lebar seluruh bagan, tidak tertutup legenda dan bilah atas.
  const awal = useCallback(() => {
    const u = ukuran()
    if (!u) return null
    const h = ukurHalangan()
    const kotak = u.bingkai.lebar < LEBAR_HP ? kotakDiIsi(isi.current, masukan.current.pangkal) : null
    return kotak ? jagaTerlihat(pandangHp(kotak, u.bingkai, h), u.isi, u.bingkai) : pandangAwal(u.isi, u.bingkai, h)
  }, [ukuran, ukurHalangan])

  useLayoutEffect(() => {
    let p = awal()
    if (!p) return
    const u = ukuran()
    const kartu = pusat && kartuDi(isi.current, pusat)
    if (kartu) p = jagaTerlihat(pusatkan({ ...p, k: Math.max(p.k, SKALA_TERBACA) }, letakDiIsi(kartu, isi.current), u.bingkai), u.isi, u.bingkai)
    setPandang(p)
  }, [kunci, pusat, ukuran, awal])

  useEffect(() => {
    const elemenBingkai = bingkai.current
    if (!elemenBingkai) return undefined
    const saatRoda = (e) => {
      e.preventDefault()
      const r = elemenBingkai.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const faktor = Math.exp(-e.deltaY * 0.01)
        setPandang((p) => jaga(zoomDi(p, faktor, { x: e.clientX - r.left, y: e.clientY - r.top })))
      } else {
        setPandang((p) => jaga(geser(p, -e.deltaX, -e.deltaY)))
      }
    }
    elemenBingkai.addEventListener('wheel', saatRoda, { passive: false })
    return () => elemenBingkai.removeEventListener('wheel', saatRoda)
  }, [jaga])

  const zoomTengah = useCallback(
    (faktor) => {
      const u = ukuran()
      setPandang((p) => jaga(zoomDi(p, faktor, u ? { x: u.bingkai.lebar / 2, y: u.bingkai.tinggi / 2 } : { x: 0, y: 0 })))
    },
    [jaga, ukuran]
  )
  const aksi = useMemo(
    () => ({
      perbesar: () => zoomTengah(FAKTOR_TOMBOL),
      perkecil: () => zoomTengah(1 / FAKTOR_TOMBOL),
      // "Pusatkan": kembali ke tampilan awal.
      pas: () => {
        const p = awal()
        if (p) setPandang(p)
      },
      // "Lihat seluruh bagan": seluruh pohon terlihat (di HP kartunya kecil).
      seluruh: () => {
        const u = ukuran()
        if (u) setPandang(pandangAwal(u.isi, u.bingkai, ukurHalangan()))
      },
      geser: (dx, dy) => setPandang((p) => jaga(geser(p, dx, dy))),
      // Melompat ke kartu seseorang (pencarian, kartu rujukan): kartu itu di
      // tengah bagian bingkai yang tidak tertutup panel (`tertutup`: piksel
      // di kanan dan di bawah), diperbesar sampai tulisannya terbaca.
      pusatkanKe: (id, tertutup = {}) => {
        const u = ukuran()
        const kartu = kartuDi(isi.current, id)
        if (!u || !kartu) return
        const terlihat = {
          lebar: Math.max(u.bingkai.lebar - (tertutup.kanan ?? 0), u.bingkai.lebar / 3),
          tinggi: Math.max(u.bingkai.tinggi - (tertutup.bawah ?? 0), u.bingkai.tinggi / 3),
        }
        setPandang((p) => jaga(pusatkan({ ...p, k: Math.max(p.k, SKALA_TERBACA) }, letakDiIsi(kartu, isi.current), terlihat)))
      },
    }),
    [awal, jaga, ukuran, ukurHalangan, zoomTengah]
  )

  const posisi = (e) => {
    const r = bingkai.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const g = gerak.current

  const props = {
    ref: bingkai,
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      titik.current.set(e.pointerId, posisi(e))
      if (titik.current.size === 1) {
        g.mulai = posisi(e)
        g.diseret = false
      } else if (titik.current.size === 2) {
        const [a, b] = [...titik.current.values()]
        g.jarak = jarak(a, b)
        g.tengah = tengah(a, b)
        g.diseret = true
      }
    },
    onPointerMove(e) {
      if (!titik.current.has(e.pointerId)) return
      const lama = titik.current.get(e.pointerId)
      const baru = posisi(e)
      titik.current.set(e.pointerId, baru)
      if (titik.current.size === 1) {
        if (!g.diseret) {
          if (jarak(baru, g.mulai) < AMBANG_SERET_PX) return
          g.diseret = true
          try {
            bingkai.current.setPointerCapture(e.pointerId)
          } catch {
            // tidak apa-apa: seretan tetap jalan selama jari/mouse di dalam bingkai
          }
        }
        setPandang((p) => jaga(geser(p, baru.x - lama.x, baru.y - lama.y)))
      } else if (titik.current.size === 2) {
        const [a, b] = [...titik.current.values()]
        const jarakBaru = jarak(a, b)
        const tengahBaru = tengah(a, b)
        if (g.jarak && jarakBaru > 0) {
          const faktor = jarakBaru / g.jarak
          const dx = tengahBaru.x - g.tengah.x
          const dy = tengahBaru.y - g.tengah.y
          setPandang((p) => jaga(geser(zoomDi(p, faktor, tengahBaru), dx, dy)))
        }
        g.jarak = jarakBaru
        g.tengah = tengahBaru
      }
    },
    onPointerUp: akhiri,
    onPointerCancel: akhiri,
    // Sesudah menyeret, ketukan yang menyusul tidak boleh membuka kartu.
    onClickCapture(e) {
      if (g.diseret) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
    onKeyDown(e) {
      if (e.target !== e.currentTarget) return
      const langkah = {
        ArrowLeft: [LANGKAH_PANAH_PX, 0],
        ArrowRight: [-LANGKAH_PANAH_PX, 0],
        ArrowUp: [0, LANGKAH_PANAH_PX],
        ArrowDown: [0, -LANGKAH_PANAH_PX],
      }[e.key]
      if (langkah) aksi.geser(...langkah)
      else if (e.key === '+' || e.key === '=') aksi.perbesar()
      else if (e.key === '-') aksi.perkecil()
      else if (e.key === '0') aksi.seluruh()
      else return
      e.preventDefault()
    },
  }
  function akhiri(e) {
    titik.current.delete(e.pointerId)
    g.jarak = null
    if (titik.current.size === 1) g.mulai = [...titik.current.values()][0]
    if (titik.current.size === 0) setTimeout(() => { g.diseret = false }, 50)
  }

  return { pandang, props, isi, aksi }
}
