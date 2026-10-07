import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'

// Tampilan pertama (sebelum apa pun dimuat), dirender di server tanpa
// jaringan. Alur lengkap dites di src/pages/*.test.jsx dengan klien tiruan.
const tampil = (url, klien = null) => {
  const Router = ({ children }) => <StaticRouter location={url}>{children}</StaticRouter>
  return renderToString(<App Router={Router} klien={klien} />)
}

describe('App', () => {
  it('tanpa database yang tersambung: "Aplikasi belum siap", tanpa data apa pun', () => {
    const html = tampil('/')
    expect(html).toContain('Aplikasi belum siap')
    expect(html).toContain('belum tersambung ke database')
  })

  it('halaman Privasi bisa dibuka tanpa login', () => {
    const html = tampil('/privasi')
    expect(html).toContain('Privasi')
    expect(html).toContain('Tidak ada GPS')
  })

  it('menampilkan pesan Indonesia untuk alamat yang tidak ada', () => {
    expect(tampil('/tidak-ada')).toContain('Halaman tidak ditemukan')
  })

  it('tidak menampilkan banner mode contoh secara bawaan', () => {
    expect(tampil('/')).not.toContain('MODE CONTOH')
  })

  it('bahasa Indonesia dan tanpa nama keluarga di halaman pertama', () => {
    const html = tampil('/masuk')
    expect(html).toContain('Aplikasi belum siap')
    expect(html).not.toMatch(/undefined|\[object/)
  })
})
