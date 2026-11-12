import { describe, expect, it } from 'vitest'
import { expiryBadge } from './expiry'

// 한국 시간 2026-10-25 22:00 (UTC 13:00)
const now = new Date('2026-10-25T13:00:00Z')

describe('소비기한 D-day 배지', () => {
  it('한국 날짜로 오늘 끝나면 "오늘까지"', () => {
    expect(expiryBadge('2026-10-25T23:59:59+09:00', now)).toEqual({
      label: '오늘까지',
      tone: 'urgent',
    })
  })

  it('1~3일 뒤면 D-n', () => {
    expect(expiryBadge('2026-10-26T23:59:59+09:00', now)).toEqual({ label: 'D-1', tone: 'soon' })
    expect(expiryBadge('2026-10-28T23:59:59+09:00', now)).toEqual({ label: 'D-3', tone: 'soon' })
  })

  it('더 멀거나 품절(null)이면 배지가 없다', () => {
    expect(expiryBadge('2026-10-29T23:59:59+09:00', now)).toBeNull()
    expect(expiryBadge(null, now)).toBeNull()
  })

  it('날짜는 브라우저 시간대가 아니라 한국 날짜로 센다', () => {
    // 한국 2026-10-26 01:00 은 UTC 로는 아직 10-25 지만 한국 기준 "오늘"이다
    const afterMidnight = new Date('2026-10-25T16:00:00Z')
    expect(expiryBadge('2026-10-26T23:59:59+09:00', afterMidnight)?.label).toBe('오늘까지')
  })
})
