import { describe, expect, it } from 'vitest'
import { formatDateTime, formatExpiry, formatSignedQuantity, formatWon } from './format'

describe('점주 재고 표시 함수', () => {
  it('금액은 천 단위 쉼표와 원으로', () => {
    expect(formatWon(1700)).toBe('1,700원')
    expect(formatWon(0)).toBe('0원')
  })

  it('유통기한은 브라우저 시간대와 상관없이 한국 날짜로', () => {
    // 한국 23:59:59 는 UTC 로는 같은 날 14:59:59. UTC 표기로 와도 날짜가 밀리지 않아야 한다
    expect(formatExpiry('2026-10-24T23:59:59+09:00')).toBe('10/24')
    expect(formatExpiry('2026-10-24T14:59:59Z')).toBe('10/24')
    // 한국 자정 직후는 UTC 로는 전날 저녁이다
    expect(formatExpiry('2026-10-24T15:00:00Z')).toBe('10/25')
  })

  it('유통기한이 없으면 "-"', () => {
    expect(formatExpiry(null)).toBe('-')
  })

  it('시각은 브라우저 시간대와 상관없이 한국 시간 "MM/DD HH:mm" 으로', () => {
    expect(formatDateTime('2026-10-20T05:00:03+09:00')).toBe('10/20 05:00')
    // UTC 표기로 와도 한국 시간으로 바꾼다. UTC 20:30 은 한국 다음 날 05:30
    expect(formatDateTime('2026-10-19T20:30:00Z')).toBe('10/20 05:30')
  })

  it('변동 수량은 부호를 항상 붙인다', () => {
    expect(formatSignedQuantity(10)).toBe('+10')
    expect(formatSignedQuantity(-3)).toBe('−3')
    expect(formatSignedQuantity(0)).toBe('0')
  })
})
