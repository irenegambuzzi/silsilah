import { describe, expect, it } from 'vitest'
import { kenaliPerangkat } from './perangkat.js'

const contoh = [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'iPhone · Safari'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1', 'iPhone · Chrome'],
  ['Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Android · Chrome'],
  ['Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36', 'Android · Samsung Internet'],
  ['Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Tablet Android · Chrome'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Laptop Windows · Edge'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0', 'Laptop Windows · Firefox'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0', 'iPhone · Instagram'],
  ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0]', 'Android · Facebook'],
  ['', 'Perangkat lain · Browser lain'],
]

describe('kenaliPerangkat', () => {
  it.each(contoh)('%s', (ua, label) => {
    expect(kenaliPerangkat(ua).label).toBe(label)
  })
  it('selalu muat di kolom database (label ≤ 100, jenis ≤ 50)', () => {
    const r = kenaliPerangkat('x'.repeat(100000))
    expect(r.label.length).toBeLessThanOrEqual(100)
    expect(r.device_type.length).toBeLessThanOrEqual(50)
    expect(kenaliPerangkat(undefined).device_type).toBe('Perangkat lain')
  })
})
