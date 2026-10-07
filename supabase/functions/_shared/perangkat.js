// Jenis perangkat dan browser dari User-Agent, untuk daftar perangkat
// ("iPhone · Safari") dan log login. Hanya perkiraan; tidak dipakai untuk
// keputusan keamanan.

const BROWSER = [
  [/FBAN|FBAV|FB_IAB/, 'Facebook'],
  [/Instagram/, 'Instagram'],
  [/Line\//, 'LINE'],
  [/EdgA?\/|EdgiOS\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\/|OPiOS\//, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

function jenisPerangkat(ua) {
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Tablet Android'
  if (/CrOS/.test(ua)) return 'Chromebook'
  if (/Windows/.test(ua)) return 'Laptop Windows'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Komputer Linux'
  return 'Perangkat lain'
}

// Hasil: { device_type, label } dengan nama kolom seperti di database.
export function kenaliPerangkat(userAgent) {
  const ua = String(userAgent ?? '').slice(0, 1000)
  const device_type = jenisPerangkat(ua)
  const browser = BROWSER.find(([pola]) => pola.test(ua))?.[1] ?? 'Browser lain'
  return { device_type, label: `${device_type} · ${browser}` }
}
