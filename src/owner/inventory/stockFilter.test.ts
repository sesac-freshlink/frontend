import { describe, expect, it } from 'vitest'
import type { InventoryItem } from './api'
import { matchesStock, matchesText, statusRank } from './stockFilter'

const item = (availableQuantity: number, lowStock: boolean) =>
  ({ availableQuantity, lowStock }) as InventoryItem

describe('stockFilter', () => {
  it('검색어는 앞뒤 빈칸·대소문자를 무시하고 빈 검색어는 모두 맞다', () => {
    expect(matchesText('매운 컵라면 115g', '  컵라면 ')).toBe(true)
    expect(matchesText('Fresh Milk', 'milk')).toBe(true)
    expect(matchesText('우유', '라면')).toBe(false)
    expect(matchesText('우유', '')).toBe(true)
  })

  it('상태 순서는 품절 → 부족 → 판매중', () => {
    expect(statusRank(item(0, true))).toBe(0)
    expect(statusRank(item(2, true))).toBe(1)
    expect(statusRank(item(9, false))).toBe(2)
  })

  it('품절·부족 칩: 고른 게 없으면 모두, 재고를 모르면 고른 게 있을 때 뺀다', () => {
    expect(matchesStock(undefined, [])).toBe(true)
    expect(matchesStock(undefined, ['SOLD_OUT'])).toBe(false)
    expect(matchesStock(item(0, true), ['SOLD_OUT'])).toBe(true)
    expect(matchesStock(item(0, true), ['LOW_STOCK'])).toBe(false)
    expect(matchesStock(item(2, true), ['SOLD_OUT', 'LOW_STOCK'])).toBe(true)
    expect(matchesStock(item(9, false), ['SOLD_OUT', 'LOW_STOCK'])).toBe(false)
  })
})
