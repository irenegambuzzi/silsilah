import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App'

describe('App', () => {
  it('menampilkan halaman awal berbahasa Indonesia', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Silsilah Keluarga')
    expect(html).toContain('sedang dibangun')
  })
})
