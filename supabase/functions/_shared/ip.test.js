import { describe, expect, it } from 'vitest'
import { uraiIp } from './ip.js'

describe('uraiIp', () => {
  it('IPv4', () => {
    expect(uraiIp('192.0.2.5')).toEqual({ versi: 4, n: 0xc0000205 })
    expect(uraiIp('255.255.255.255')).toEqual({ versi: 4, n: 0xffffffff })
    expect(uraiIp(' 0.0.0.0 ')).toEqual({ versi: 4, n: 0 })
  })
  it('IPv6: 64 bit teratas, termasuk bentuk singkat "::"', () => {
    expect(uraiIp('2001:db8:1:2:3:4:5:6')).toEqual({ versi: 6, hi: 0x20010db8, lo: 0x00010002 })
    expect(uraiIp('2001:db8::1')).toEqual({ versi: 6, hi: 0x20010db8, lo: 0 })
    expect(uraiIp('::1')).toEqual({ versi: 6, hi: 0, lo: 0 })
    expect(uraiIp('ffff:ffff:ffff:ffff::')).toEqual({ versi: 6, hi: 0xffffffff, lo: 0xffffffff })
    expect(uraiIp('fe80::1%en0')).toEqual({ versi: 6, hi: 0xfe800000, lo: 0 })
  })
  it('IPv4 yang dibungkus IPv6 dianggap IPv4', () => {
    expect(uraiIp('::ffff:192.0.2.5')).toEqual({ versi: 4, n: 0xc0000205 })
    expect(uraiIp('::ffff:c000:205')).toEqual({ versi: 4, n: 0xc0000205 })
  })
  it.each(['', null, undefined, 'abc', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.-4', '1:2:3', '1::2::3',
    '12345::', 'g::1', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7::8', 'x'.repeat(100), '::ffff:999.1.1.1'])(
    'bentuk salah → null (%s)', (x) => {
      expect(uraiIp(x)).toBeNull()
    })
})
