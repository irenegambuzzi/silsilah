import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'

const tampil = (url) => {
  const Router = ({ children }) => <StaticRouter location={url}>{children}</StaticRouter>
  return renderToString(<App Router={Router} />)
}

describe('App', () => {
  it('menampilkan halaman awal berbahasa Indonesia', () => {
    const html = tampil('/')
    expect(html).toContain('Silsilah Keluarga')
    expect(html).toContain('sedang dibangun')
  })

  it('menampilkan pesan Indonesia untuk alamat yang tidak ada', () => {
    expect(tampil('/tidak-ada')).toContain('Halaman tidak ditemukan')
  })

  it('tidak menampilkan banner mode contoh secara bawaan', () => {
    expect(tampil('/')).not.toContain('MODE CONTOH')
  })
})
