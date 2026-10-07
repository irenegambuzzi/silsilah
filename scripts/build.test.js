// Tes build produksi sungguhan: base path, dan mode contoh tidak boleh
// ikut terkirim ke pengguna.
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const vite = path.join(root, 'node_modules', '.bin', 'vite')
let tmp

function bangun(nama, env) {
  const out = path.join(tmp, nama)
  execFileSync(vite, ['build', '--outDir', out, '--emptyOutDir'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', ...env },
    stdio: 'pipe',
  })
  return out
}
const semuaIsi = (dir) =>
  fs
    .readdirSync(dir, { recursive: true })
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).isFile())
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n')

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'silsilah-build-'))
}, 30000)
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('build produksi', () => {
  it('tidak memuat mode contoh walaupun VITE_MODE_CONTOH=1', () => {
    const out = bangun('contoh', { VITE_MODE_CONTOH: '1' })
    const isi = semuaIsi(out)
    expect(isi).not.toContain('KELUARGA-CONTOH-FIKTIF')
    expect(isi).not.toContain('KLIEN-CONTOH-FIKTIF')
    expect(isi).not.toContain('Bu Contoh')
    expect(isi).not.toContain('MODE CONTOH')
  }, 60000)

  it('memakai VITE_BASE_PATH sebagai alamat dasar di satu tempat', () => {
    const out = bangun('basis', { VITE_BASE_PATH: '/silsilah/' })
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
    expect(html).toMatch(/src="\/silsilah\/assets\//)
    expect(html).not.toMatch(/src="\/assets\//)
  }, 60000)

  it('bawaannya "/" (domain sendiri) dan tetap noindex', () => {
    const out = bangun('akar', { VITE_BASE_PATH: '' })
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
    expect(html).toMatch(/src="\/assets\//)
    expect(html).toContain('noindex, nofollow')
  }, 60000)
})
