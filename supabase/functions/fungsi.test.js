// Bentuk folder Edge Functions: setiap fungsi punya pengaturan, library
// dipatok persis, dan kode bersama tidak memakai apa pun yang khusus Node
// (supaya berjalan sama di Deno).
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const dir = import.meta.dirname
const fungsi = fs.readdirSync(dir).filter((f) => !f.startsWith('_') && fs.statSync(path.join(dir, f)).isDirectory())
const config = fs.readFileSync(path.join(dir, '..', 'config.toml'), 'utf8')

describe('Edge Functions', () => {
  it('ada pakai-undangan, pakai-kode, dan cek-perangkat', () => {
    expect(fungsi.sort()).toEqual(['cek-perangkat', 'pakai-kode', 'pakai-undangan'])
  })

  it.each(fungsi)('%s: verify_jwt mati dan entrypoint index.js di config.toml', (f) => {
    const bagian = config.split(`[functions.${f}]`)[1]?.split('[')[0] ?? ''
    expect(bagian).toMatch(/^verify_jwt = false$/m)
    expect(bagian).toContain(`entrypoint = "./functions/${f}/index.js"`)
  })

  it.each(fungsi)('%s: library dari npm dipatok persis', (f) => {
    const isi = fs.readFileSync(path.join(dir, f, 'index.js'), 'utf8')
    const impor = [...isi.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    for (const i of impor) {
      expect(i.startsWith('../_shared/') || /^npm:@?[\w/-]+@\d+\.\d+\.\d+$/.test(i), i).toBe(true)
    }
  })

  it('kode bersama hanya mengimpor sesamanya (tanpa node:, npm:, atau URL)', () => {
    const bersama = path.join(dir, '_shared')
    for (const f of fs.readdirSync(bersama).filter((x) => x.endsWith('.js') && !x.endsWith('.test.js'))) {
      const isi = fs.readFileSync(path.join(bersama, f), 'utf8')
      for (const [, i] of isi.matchAll(/from '([^']+)'/g)) expect(i, `${f}: ${i}`).toMatch(/^\.\/[\w-]+\.js$/)
      expect(isi, f).not.toMatch(/\bprocess\.|\brequire\(|\bBuffer\b/)
    }
  })

  it('kode bersama tidak memanggil jaringan sendiri (IP tidak pernah dikirim ke layanan luar)', () => {
    const bersama = path.join(dir, '_shared')
    for (const f of fs.readdirSync(bersama).filter((x) => x.endsWith('.js') && !x.endsWith('.test.js'))) {
      // Tanpa komentar: yang diperiksa hanya kode.
      const kode = fs.readFileSync(path.join(bersama, f), 'utf8').split('\n').filter((b) => !b.trim().startsWith('//')).join('\n')
      expect(kode, f).not.toMatch(/\bfetch\s*\(|https?:\/\/|XMLHttpRequest|WebSocket|Deno\.connect/)
    }
  })
})
