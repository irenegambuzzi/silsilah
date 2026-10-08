import { useEffect, useRef } from 'react'

// Judul layar (Cinzel, emas, seperti aplikasi lama). Fokus pindah ke sini
// saat layar terbuka, supaya pembaca layar langsung membacakan layar yang baru.
export function Judul({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className={`font-judul text-3xl font-bold leading-tight tracking-wide text-emas-teks outline-none ${className}`}
    >
      {children}
    </h1>
  )
}

export const Subjudul = ({ children, className = '' }) => (
  <h2 className={`font-judul text-xl font-bold leading-tight tracking-wide text-emas-teks ${className}`}>{children}</h2>
)
