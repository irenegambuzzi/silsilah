import { createContext, useContext } from 'react'

export const KonteksData = createContext(null)

export function useDataSilsilah() {
  const k = useContext(KonteksData)
  if (!k) throw new Error('DataSilsilahProvider belum dipasang')
  return k
}
