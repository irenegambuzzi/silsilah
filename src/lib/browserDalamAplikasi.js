// Mengenali browser yang tertanam di aplikasi lain (Instagram, Facebook,
// dst.). Link sekali pakai sebaiknya dibuka di Chrome/Safari biasa, supaya
// tidak "tertinggal" di browser mini yang sesi dan penyimpanannya terpisah.
// Hanya perkiraan dari User-Agent.

const DAFTAR = [
  [/FBAN|FBAV|FB_IAB|FBIOS/, 'Facebook'],
  [/Instagram/i, 'Instagram'],
  [/\bLine\//, 'LINE'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/Twitter for|TwitterAndroid/i, 'Twitter'],
  [/MicroMessenger/i, 'WeChat'],
  [/KAKAOTALK/i, 'KakaoTalk'],
  [/GSA\//, 'aplikasi Google'],
]

// Hasil: nama aplikasinya, 'aplikasi lain' untuk WebView Android umum, atau null.
export function deteksiBrowserDalamAplikasi(userAgent) {
  const ua = String(userAgent ?? '')
  const dikenal = DAFTAR.find(([pola]) => pola.test(ua))
  if (dikenal) return dikenal[1]
  // WebView Android umum: "...; wv) ... Version/4.0 ..."
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return 'aplikasi lain'
  return null
}
