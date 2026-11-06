import { describe, expect, it } from 'vitest'
import { formatMmSs, pickupScanUrl, renewDelayMs, secondsLeft } from './pickupQr'

const EXPIRES = '2026-11-06T15:05:00+09:00'
const NOW = Date.parse('2026-11-06T15:00:00+09:00')

describe('픽업 QR 계산 (A16)', () => {
  it('QR 안에는 점주 핸드폰 화면 주소와 표가 들어간다', () => {
    expect(pickupScanUrl('https://dev.getfreshlink.com', 'aB3')).toBe(
      'https://dev.getfreshlink.com/owner/pickup-scan?t=aB3',
    )
  })

  it('남은 초는 0 아래로 내려가지 않는다', () => {
    expect(secondsLeft(EXPIRES, NOW)).toBe(300)
    expect(secondsLeft(EXPIRES, NOW + 299_500)).toBe(1)
    expect(secondsLeft(EXPIRES, NOW + 400_000)).toBe(0)
  })

  it('만료 30초 전에 새로 만든다', () => {
    expect(renewDelayMs(EXPIRES, NOW)).toBe(270_000)
    expect(renewDelayMs(EXPIRES, NOW + 280_000)).toBe(0)
  })

  it('남은 시간은 분:초', () => {
    expect(formatMmSs(300)).toBe('5:00')
    expect(formatMmSs(65)).toBe('1:05')
    expect(formatMmSs(0)).toBe('0:00')
  })
})
