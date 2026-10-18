// Tes middleware halaman uji nama asli. Semua nama di sini FIKTIF.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ALAMAT_DATA, bacaCsv, middlewareNamaAsli, ratakanPohon, tolakDataPribadi, ujiNamaAsli } from './plugin.mjs'

const pohon = {
  name: 'Zorvak Talindra', gender: 'male', deathDate: '1990', id: 'a',
  spouse: { name: 'Merila Osvat', deathDate: '1995' },
  children: [
    { name: 'Kelvara', gender: 'female', id: 'b', spouse: 'Dorin Ashvel', marriages: [{ spouse: 'Dorin Ashvel', status: 'x', children: [{ name: 'Pirun', gender: '?', id: 'c' }] }] },
    { name: 'Talvo, S.Pd.', gender: 'Laki-laki', id: 'd', marriages: [{ spouse: 'Asmira', children: [] }, { spouse: { name: 'Lunevi', deathDate: '' } }] },
  ],
}

describe('ratakanPohon', () => {
  const orang = ratakanPohon(pohon)
  const cari = (nama) => orang.find((o) => o.nama === nama)

  it('mengambil semua keturunan (juga anak di bawah pernikahan) dan semua pasangan, sekali saja', () => {
    expect(orang.map((o) => o.nama)).toEqual(['Zorvak Talindra', 'Merila Osvat', 'Kelvara', 'Dorin Ashvel', 'Pirun', 'Talvo, S.Pd.', 'Asmira', 'Lunevi'])
  })

  it('jenis kelamin dari data; pasangan diperkirakan lawan pasangannya; yang tidak dikenal kosong', () => {
    expect(cari('Zorvak Talindra')).toMatchObject({ sex: 'L', sexDari: 'data', peran: 'keturunan' })
    expect(cari('Kelvara')).toMatchObject({ sex: 'P', sexDari: 'data' })
    expect(cari('Talvo, S.Pd.')).toMatchObject({ sex: 'L', sexDari: 'data' })
    expect(cari('Merila Osvat')).toMatchObject({ sex: 'P', sexDari: 'perkiraan', peran: 'pasangan' })
    expect(cari('Dorin Ashvel')).toMatchObject({ sex: 'L', sexDari: 'perkiraan' })
    expect(cari('Pirun')).toMatchObject({ sex: null, sexDari: null })
  })

  it('wafat dari tanggal wafat (juga pada pasangan berbentuk objek)', () => {
    expect(orang.filter((o) => o.wafat).map((o) => o.nama)).toEqual(['Zorvak Talindra', 'Merila Osvat'])
  })
})

describe('bacaCsv', () => {
  it('membaca sel berkutip dengan koma, kutip ganda, dan baris baru', () => {
    expect(bacaCsv('id,data\r\n1,"{""a"": ""x, y""}"\n')).toEqual([['id', 'data'], ['1', '{"a": "x, y"}']])
  })
})

describe('middleware', () => {
  let dir
  const log = []
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-nama-asli-'))
    const sel = JSON.stringify(pohon).replaceAll('"', '""')
    fs.writeFileSync(path.join(dir, 'contoh.csv'), `id,data\n1,"${sel}"\n`)
    for (const f of ['log', 'info', 'warn', 'error']) vi.spyOn(console, f).mockImplementation((...a) => log.push(a))
  })
  afterEach(() => expect(log).toEqual([]))
  afterAll(() => {
    vi.restoreAllMocks()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const panggil = (folder, { url = ALAMAT_DATA, alamat = '127.0.0.1', method = 'GET' } = {}) =>
    new Promise((selesai) => {
      const res = {
        header: {},
        setHeader(k, v) { this.header[k] = v },
        end(isi) { selesai({ status: this.statusCode, header: this.header, isi: JSON.parse(isi) }) },
      }
      middlewareNamaAsli(folder)({ url, method, socket: { remoteAddress: alamat } }, res, () => selesai('lanjut'))
    })

  it('mengirim nama dari CSV saat diminta, tanpa cache, dan tanpa mencetak apa pun', async () => {
    const r = await panggil(dir)
    expect(r.status).toBe(200)
    expect(r.header['Cache-Control']).toBe('no-store')
    expect(r.isi.orang).toHaveLength(8)
  })

  it('membaca ulang setiap kali (tidak menyimpan salinan)', async () => {
    const lain = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-nama-asli-'))
    fs.writeFileSync(path.join(lain, 'a.csv'), `id,data\n1,"${JSON.stringify({ name: 'Satu' }).replaceAll('"', '""')}"\n`)
    expect((await panggil(lain)).isi.orang.map((o) => o.nama)).toEqual(['Satu'])
    fs.writeFileSync(path.join(lain, 'a.csv'), `id,data\n1,"${JSON.stringify({ name: 'Dua' }).replaceAll('"', '""')}"\n`)
    expect((await panggil(lain)).isi.orang.map((o) => o.nama)).toEqual(['Dua'])
    fs.rmSync(lain, { recursive: true, force: true })
  })

  it('hanya untuk komputer ini dan hanya GET', async () => {
    expect((await panggil(dir, { alamat: '192.168.1.20' })).status).toBe(403)
    expect((await panggil(dir, { method: 'POST' })).status).toBe(403)
    expect((await panggil(dir, { alamat: '::1' })).status).toBe(200)
  })

  it('galat tanpa rincian kalau CSV tidak ada atau rusak', async () => {
    const kosong = fs.mkdtempSync(path.join(os.tmpdir(), 'uji-nama-asli-'))
    expect(await panggil(kosong)).toMatchObject({ status: 500, isi: { galat: 'Data tidak bisa dibaca.' } })
    fs.writeFileSync(path.join(kosong, 'b.csv'), 'id,data\n1,{rusak\n')
    expect(await panggil(kosong)).toMatchObject({ status: 500, isi: { galat: 'Data tidak bisa dibaca.' } })
    fs.rmSync(kosong, { recursive: true, force: true })
  })

  it('alamat lain diteruskan', async () => {
    expect(await panggil(dir, { url: '/src/main.jsx' })).toBe('lanjut')
  })

  it('permintaan langsung ke folder data pribadi ditolak tanpa mencetak jalurnya', () => {
    for (const url of ['/data-pribadi/a.csv', '/@fs/x/data-pribadi/b.csv', '/%64ata-pribadi/c.txt', '/DATA-PRIBADI/d']) {
      let status = null
      let lanjut = false
      tolakDataPribadi()({ url }, { setHeader() {}, end() { status = this.statusCode } }, () => { lanjut = true })
      expect([url, status, lanjut]).toEqual([url, 403, false])
    }
    let lanjut = false
    tolakDataPribadi()({ url: '/src/main.jsx' }, {}, () => { lanjut = true })
    expect(lanjut).toBe(true)
  })

  it('plugin hanya untuk server pengembangan', () => {
    expect(ujiNamaAsli({ folder: dir }).apply).toBe('serve')
  })
})
