// Memasang aplikasi UTUH (App) dengan router di memori dan klien tiruan.
import { render, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach } from 'vitest'
import App from '../App.jsx'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.ukuran
  delete document.documentElement.dataset.kontras
})

export const lokasiSaatIni = { pathname: '', search: '' }
function Pengintai() {
  const l = useLocation()
  lokasiSaatIni.pathname = l.pathname
  lokasiSaatIni.search = l.search
  return null
}

export function pasang(url, klien) {
  const Router = ({ children }) => (
    <MemoryRouter initialEntries={[url]}>
      <Pengintai />
      {children}
    </MemoryRouter>
  )
  const aksi = userEvent.setup()
  const hasil = render(<App Router={Router} klien={klien} />)
  return { ...hasil, aksi }
}
