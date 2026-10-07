import { useEffect, useRef } from 'react'

// Judul layar. Fokus pindah ke sini saat layar terbuka, supaya pembaca
// layar langsung membacakan layar yang baru.
export function Judul({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1 ref={ref} tabIndex={-1} className={`text-3xl font-bold leading-tight outline-none ${className}`}>
      {children}
    </h1>
  )
}

export const Subjudul = ({ children, className = '' }) => (
  <h2 className={`text-2xl font-bold leading-tight ${className}`}>{children}</h2>
)
