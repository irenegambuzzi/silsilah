import { useMemo } from 'react'
import QRCode from 'qrcode'

// Kode QR dibuat di perangkat ini (tanpa jaringan) sebagai gambar SVG.
// Selalu hitam di atas putih, apa pun tema, supaya mudah dipindai kamera.
const TEPI = 4

export function KodeQr({ nilai, label, ukuran = 256 }) {
  const jalur = useMemo(() => {
    const { modules } = QRCode.create(nilai, { errorCorrectionLevel: 'M' })
    const bagian = []
    for (let b = 0; b < modules.size; b++) {
      for (let k = 0; k < modules.size; k++) {
        if (modules.get(b, k)) bagian.push(`M${k + TEPI} ${b + TEPI}h1v1h-1z`)
      }
    }
    return { d: bagian.join(''), sisi: modules.size + TEPI * 2 }
  }, [nilai])
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${jalur.sisi} ${jalur.sisi}`}
      width={ukuran}
      height={ukuran}
      shapeRendering="crispEdges"
      className="mx-auto max-w-full rounded-xl border-2 border-garis"
      style={{ background: '#ffffff' }}
    >
      <path d={jalur.d} fill="#000000" />
    </svg>
  )
}
