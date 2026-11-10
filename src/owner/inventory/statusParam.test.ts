import { describe, expect, it } from 'vitest'
import { formatStatuses, inventoryPath, parseStatuses } from './statusParam'

describe('재고 화면 주소의 status', () => {
  it('쉼표로 여러 개를 읽고, 모르는 값·겹친 값은 버리고 칩 순서로 준다', () => {
    expect(parseStatuses('EXPIRED,LOW_STOCK')).toEqual(['LOW_STOCK', 'EXPIRED'])
    expect(parseStatuses('LOW_STOCK,LOW_STOCK,PRICE')).toEqual(['LOW_STOCK'])
    expect(parseStatuses(' IMMINENT ')).toEqual(['IMMINENT'])
    expect(parseStatuses(null)).toEqual([])
    expect(parseStatuses('')).toEqual([])
  })

  it('필터 목록을 칩 순서로 쓰고, 비면 주소에서 뺀다', () => {
    expect(formatStatuses(['SOLD_OUT', 'IMMINENT'])).toBe('IMMINENT,SOLD_OUT')
    expect(formatStatuses([])).toBeNull()
  })

  it('다른 화면이 필터를 건 채로 보낼 주소를 만든다', () => {
    expect(inventoryPath(['LOW_STOCK'])).toBe('/owner/inventory?status=LOW_STOCK')
    expect(inventoryPath()).toBe('/owner/inventory')
  })
})
