// Aturan dasar repo: versi library dipatok persis, dan data pribadi
// serta rahasia tidak pernah bisa ikut ter-commit.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')

describe('kerangka repo', () => {
  it('semua versi library dipatok persis (tanpa ^, ~, *, atau rentang)', () => {
    const pkg = JSON.parse(read('package.json'))
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    const loose = Object.entries(all).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v))
    expect(loose).toEqual([])
  })

  it('npm menyimpan versi persis dan memaksa versi Node', () => {
    const npmrc = read('.npmrc')
    expect(npmrc).toMatch(/^save-exact=true$/m)
    expect(npmrc).toMatch(/^engine-strict=true$/m)
    expect(read('.nvmrc').trim()).toBe('22')
  })

  it('.gitignore mengecualikan data pribadi dan rahasia', () => {
    const lines = read('.gitignore').split('\n').map((l) => l.trim())
    expect(lines).toContain('data-pribadi/')
    expect(lines).toContain('.env')
    expect(lines).toContain('.env.*')
  })

  it('halaman tidak diindeks mesin pencari dan berbahasa Indonesia', () => {
    const html = read('index.html')
    expect(html).toContain('<html lang="id">')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />')
  })
})
