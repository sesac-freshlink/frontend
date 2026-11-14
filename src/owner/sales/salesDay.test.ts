import { describe, expect, it } from 'vitest'
import { disposalSummary, formatDayTitle, parseDayParam, shiftDay, sumSoldProducts } from './sales'

describe('하루 보기 계산 (11/14)', () => {
  it('날짜 제목은 "11월 13일(금)", 앞뒤 날짜는 달·해를 넘어간다', () => {
    expect(formatDayTitle('2026-11-13')).toBe('11월 13일(금)')
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('주소의 date 는 실제 있는 yyyy-MM-dd 만 받는다', () => {
    expect(parseDayParam('2026-11-13')).toBe('2026-11-13')
    expect(parseDayParam('2026-02-30')).toBeNull()
    expect(parseDayParam('2026/11/13')).toBeNull()
    expect(parseDayParam(null)).toBeNull()
  })

  it('팔린 수량과 그중 마감세일 수량을 더한다', () => {
    expect(
      sumSoldProducts([
        { soldQuantity: 18, clearanceQuantity: 4 },
        { soldQuantity: 12, clearanceQuantity: 0 },
      ]),
    ).toEqual({ sold: 30, clearance: 4 })
  })

  it('폐기 합계는 폐기 줄만, 수량은 양수로, 상품 수는 겹치지 않게 센다', () => {
    expect(
      disposalSummary([
        { type: 'DISPOSE', productId: 3, quantity: -2 },
        { type: 'DISPOSE', productId: 3, quantity: -1 },
        { type: 'DISPOSE', productId: 1, quantity: -1 },
        { type: 'INBOUND', productId: 4, quantity: 20 },
      ]),
    ).toEqual({ quantity: 4, products: 2 })
  })
})
