// Ikon hati di antara dua pasangan (seperti aplikasi lama). Pernikahan yang
// berakhir karena berpisah memakai hati PATAH: dua belahan dengan celah
// berliku di tengah. Ditinggal wafat atau masih menikah: hati utuh.
// Warnanya mengikuti warna tulisan induknya (token --c-hati).
const UTUH = 'M12 20.5C5 15.5 2 12 2 8.2 2 5.3 4.3 3 7 3c2 0 3.9 1.1 5 3 1.1-1.9 3-3 5-3 2.7 0 5 2.3 5 5.2 0 3.8-3 7.3-10 12.3z'
const KIRI = 'M12 6 10.6 10 13 13 11 16.5 12 20.5C5 15.5 2 12 2 8.2 2 5.3 4.3 3 7 3c2 0 3.9 1.1 5 3z'
const KANAN = 'M12 6c1.1-1.9 3-3 5-3 2.7 0 5 2.3 5 5.2 0 3.8-3 7.3-10 12.3L11 16.5 13 13 10.6 10z'

export function IkonHati({ patah = false, className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      {patah ? (
        <>
          <path d={KIRI} transform="translate(-1.1 0.4) rotate(-6 12 20)" />
          <path d={KANAN} transform="translate(1.1 0.4) rotate(6 12 20)" />
        </>
      ) : (
        <path d={UTUH} />
      )}
    </svg>
  )
}
