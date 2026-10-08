// Geser dan zoom Bagan dengan jari (satu jari menggeser, dua jari
// memperbesar/memperkecil), mouse (seret; Ctrl + roda atau cubit di trackpad
// untuk zoom), dan papan ketik (panah, + dan −, 0). Perilaku murni ada di pandang.js.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { geser, jagaTerlihat, pandangAwal, pasDiLayar, pusatkan, zoomDi } from './pandang.js'

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

// `kunci`: tampilan dikembalikan ke awal setiap kali kunci berubah (mis. pindah cabang).
// `pusat`: id orang yang diletakkan di tengah bingkai pada tampilan awal.
export function useGeserZoom({ kunci, pusat = null }) {
  const bingkai = useRef(null)
  const isi = useRef(null)
  const [pandang, setPandang] = useState({ x: 0, y: 0, k: 1 })
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

  useLayoutEffect(() => {
    const u = ukuran()
    if (!u) return
    let p = pandangAwal(u.isi, u.bingkai)
    const kartu = pusat && kartuDi(isi.current, pusat)
    if (kartu) p = jagaTerlihat(pusatkan({ ...p, k: Math.max(p.k, SKALA_TERBACA) }, letakDiIsi(kartu, isi.current), u.bingkai), u.isi, u.bingkai)
    setPandang(p)
  }, [kunci, pusat, ukuran])

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
      pas: () => {
        const u = ukuran()
        if (u) setPandang(pasDiLayar(u.isi, u.bingkai))
      },
      geser: (dx, dy) => setPandang((p) => jaga(geser(p, dx, dy))),
      // Melompat ke kartu seseorang (pencarian, kartu rujukan): kartu itu di
      // tengah bingkai, diperbesar sampai tulisannya terbaca.
      pusatkanKe: (id) => {
        const u = ukuran()
        const kartu = kartuDi(isi.current, id)
        if (!u || !kartu) return
        setPandang((p) => jaga(pusatkan({ ...p, k: Math.max(p.k, SKALA_TERBACA) }, letakDiIsi(kartu, isi.current), u.bingkai)))
      },
    }),
    [jaga, ukuran, zoomTengah]
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
      else if (e.key === '0') aksi.pas()
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
