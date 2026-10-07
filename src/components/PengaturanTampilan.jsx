import { useState } from 'react'
import { Check, Contrast } from 'lucide-react'
import { UKURAN_HURUF, bacaTampilan, simpanTampilan } from '../lib/tampilan.js'
import { teks } from '../teks/id.js'

// Pilihan ukuran huruf dan kontras. Perubahan langsung terlihat dan
// tersimpan di perangkat. Memakai radio dan tombol saklar asli, jadi
// papan ketik dan pembaca layar bekerja tanpa tambahan.
export function PilihanUkuranHuruf() {
  const [tampilan, setTampilan] = useState(bacaTampilan)
  const pilih = (ukuran) => {
    // Dibaca ulang dari penyimpanan: pengaturan lain (kontras) mungkin baru berubah.
    const baru = { ...bacaTampilan(), ukuran }
    setTampilan(baru)
    simpanTampilan(baru)
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-semibold">{teks.saya.ukuranHuruf}</legend>
      {UKURAN_HURUF.map((u) => {
        const dipilih = tampilan.ukuran === u
        return (
          <label
            key={u}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2 text-lg font-semibold ${
              dipilih ? 'border-utama bg-utama text-utama-teks' : 'border-garis bg-kertas'
            } has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fokus`}
          >
            <input
              type="radio"
              name="ukuran-huruf"
              value={u}
              checked={dipilih}
              onChange={() => pilih(u)}
              className="sr-only"
            />
            <span aria-hidden="true" className="flex size-6 items-center justify-center">
              {dipilih && <Check className="size-6" />}
            </span>
            {teks.saya.ukuran[u]}
          </label>
        )
      })}
    </fieldset>
  )
}

export function SakelarKontras() {
  const [tampilan, setTampilan] = useState(bacaTampilan)
  const balik = () => {
    const baru = { ...bacaTampilan(), kontras: !tampilan.kontras }
    setTampilan(baru)
    simpanTampilan(baru)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold">{teks.saya.kontras}</p>
      <p className="text-base text-redup">{teks.saya.kontrasIsi}</p>
      <button
        type="button"
        role="switch"
        aria-checked={tampilan.kontras}
        onClick={balik}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-garis bg-kertas px-5 py-3 text-lg font-semibold sm:w-auto"
      >
        <Contrast aria-hidden="true" className="size-6" />
        {teks.saya.kontras}: {tampilan.kontras ? teks.saya.kontrasMenyala : teks.saya.kontrasMati}
      </button>
    </div>
  )
}
