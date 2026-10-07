import { createContext, useContext } from 'react'

export const Konteks = createContext(null)

export function useSesi() {
  const k = useContext(Konteks)
  if (!k) throw new Error('SesiProvider belum dipasang')
  return k
}
