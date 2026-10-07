import { describe, expect, it } from 'vitest'
import { bangunKeluargaFiktif } from './keluargaFiktif.js'
import { bangunGraf } from './graf.js'
import { istilahKerabat, labelKartuAsal, semuaKerabat } from './kerabat.js'

const muat = (data = bangunKeluargaFiktif()) => bangunGraf(data, { pohon: 'T1' })
const graf = muat()
const istilah = (id) => istilahKerabat(graf, 'eka', id)

describe('istilah kerabat di pohon keluarga asal (dari sudut pandang Eka)', () => {
  it('Bapak dan Ibu', () => {
    expect(istilah('salim')).toBe('Bapak')
    expect(istilah('marni')).toBe('Ibu')
  })

  it('Mbah, Mbah buyut, dan seterusnya', () => {
    expect(istilah('kasan')).toBe('Mbah')
    expect(istilah('siti')).toBe('Mbah')
    expect(istilah('karto')).toBe('Mbah buyut')
    expect(istilah('sumi')).toBe('Mbah buyut')
  })

  it('Kakak dan Adik dari urutan lahir', () => {
    expect(istilah('ratna')).toBe('Kakak')
    expect(istilah('jaya')).toBe('Adik')
  })

  it('Pakdhe/Budhe (lebih tua dari orang tua) dan Paklik/Bulik (lebih muda)', () => {
    expect(istilah('kardi')).toBe('Pakdhe')
    expect(istilah('murni')).toBe('Budhe')
    expect(istilah('lukman')).toBe('Paklik')
  })

  it('pasangan mereka mengikuti jenis kelaminnya', () => {
    expect(istilah('wiwik')).toBe('Budhe') // istri Pakdhe
    expect(istilah('parno')).toBe('Pakdhe') // suami Budhe
    expect(istilah('tini')).toBe('Bulik') // istri Paklik
  })

  it('urutan lahir tidak diketahui: Pakdhe/Paklik dan Budhe/Bulik', () => {
    expect(istilah('darma')).toBe('Pakdhe/Paklik')
    expect(istilah('ening')).toBe('Budhe/Bulik') // istri Darma
  })

  it('Sepupu dan Keponakan', () => {
    expect(istilah('dwi')).toBe('Sepupu')
    expect(istilah('eko')).toBe('Keponakan')
  })

  it('tanpa istilah baku ditulis dengan jalurnya', () => {
    expect(istilah('fani')).toBe('Anak dari Sepupu')
    expect(istilah('brenno')).toBe('Pasangan dari Sepupu')
    expect(istilah('hari')).toBe('Ipar')
  })

  it('diri sendiri, dan orang yang tidak terhubung', () => {
    expect(istilah('eka')).toBe('Diri sendiri')
    expect(istilah('asing')).toBeNull()
    expect(istilah('bima')).toBeNull() // orang silsilah utama bukan bagian pohon ini
  })

  it('urutan lahir dibaca dari birth_ranks: kalau Kardi dan Salim ditukar, istilah ikut berubah', () => {
    const d = bangunKeluargaFiktif()
    const baris = (p, c) => d.birth_ranks.find((r) => r.parent_id === p && r.child_id === c)
    for (const ortu of ['kasan', 'siti']) {
      baris(ortu, 'kardi').rank = 3
      baris(ortu, 'salim').rank = 1
    }
    const g = muat(d)
    expect(istilahKerabat(g, 'eka', 'kardi')).toBe('Paklik')
    expect(istilahKerabat(g, 'eka', 'wiwik')).toBe('Bulik')
  })

  it('Mbah canggah dan Mbah wareng, lalu jalurnya', () => {
    const d = bangunKeluargaFiktif()
    let anak = 'karto'
    const nama = ['canggah1', 'wareng1', 'lebih1']
    nama.forEach((id, i) => {
      d.people.push({ id, tree_id: 'T1', full_name: id, sex: 'L', deleted_at: null })
      d.people.push({ id: `${id}p`, tree_id: 'T1', full_name: `${id}p`, sex: 'P', deleted_at: null })
      d.unions.push({ id: `ox${i}`, tree_id: 'T1', partner1_id: id, partner2_id: `${id}p`, deleted_at: null })
      d.children.push({ id: `cx${i}`, tree_id: 'T1', union_id: `ox${i}`, child_id: anak, kind: 'kandung', deleted_at: null })
      anak = id
    })
    const g = muat(d)
    expect(istilahKerabat(g, 'eka', 'canggah1')).toBe('Mbah canggah')
    expect(istilahKerabat(g, 'eka', 'wareng1')).toBe('Mbah wareng')
    expect(istilahKerabat(g, 'eka', 'lebih1')).toBe('Orang tua dari Mbah wareng')
  })

  it('kartu di pohon asal: nama, tahun, istilah', () => {
    expect(labelKartuAsal(graf, 'eka', 'kardi')).toEqual({
      id: 'kardi',
      nama: 'Kardi',
      panggilan: null,
      tahun: '1920',
      istilah: 'Pakdhe',
    })
    expect(labelKartuAsal(graf, 'eka', 'tidak-ada')).toBeNull()
  })

  it('semuaKerabat memuat semua orang yang terhubung, dan hasilnya disimpan', () => {
    const semua = semuaKerabat(graf, 'eka')
    expect(semua.has('asing')).toBe(false)
    expect(semua.get('dwi').langkah).toBe('OOAA')
    expect(semuaKerabat(graf, 'eka')).toBe(semua)
  })

  it('anchor yang tidak ada → kosong', () => {
    expect(semuaKerabat(graf, 'tidak-ada').size).toBe(0)
    expect(istilahKerabat(graf, 'tidak-ada', 'salim')).toBeNull()
  })
})
