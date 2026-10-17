// Aplikasi dibuka baru (pemuatan halaman baru, bukan pindah menu) selalu
// mulai dari tampilan utama tanpa fokus cabang (putaran ketujuh, 3b), juga
// kalau alamatnya masih berisi fokus (tab yang dipulihkan, ikon di layar
// utama, tautan yang dibagikan). Pindah menu tidak memuat halaman baru, jadi
// fokus tetap (lib/fokus/konteksFokus.js).
//
// Mengembalikan hash tanpa fokus dan hitung ("#/bagan?pilih=x"), atau null
// kalau tidak ada yang perlu dibuang.
export function hashTanpaFokus(hash) {
  const [jalan, kueri = ''] = (hash ?? '').replace(/^#/, '').split('?')
  if (!kueri) return null
  const p = new URLSearchParams(kueri)
  if (!p.has('fokus') && !p.has('hitung')) return null
  p.delete('fokus')
  p.delete('hitung')
  const sisa = p.toString()
  return `#${jalan}${sisa ? `?${sisa}` : ''}`
}
