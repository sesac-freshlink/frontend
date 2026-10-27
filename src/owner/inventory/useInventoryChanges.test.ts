import { describe, expect, it } from 'vitest'
import type { InventoryItem } from './api'
import { changedProductIds } from './useInventoryChanges'

function item(productId: number, quantities: [number, number, number]): InventoryItem {
  const [totalQuantity, reservedQuantity, availableQuantity] = quantities
  return {
    productId,
    productCode: `P${productId}`,
    name: `상품 ${productId}`,
    category: '기타',
    price: 1000,
    imageUrl: null,
    totalQuantity,
    reservedQuantity,
    availableQuantity,
    nearestExpiry: null,
    imminentLotCount: 0,
    expiredLotCount: 0,
    safetyStock: 5,
    lowStock: false,
  }
}

describe('changedProductIds (S-15 바뀐 행 찾기)', () => {
  it('총·예약·구매 가능 수량 중 하나라도 바뀐 상품만 고른다', () => {
    const prev = [item(1, [10, 0, 10]), item(2, [5, 1, 4]), item(3, [7, 0, 7])]
    const next = [item(1, [15, 0, 15]), item(2, [5, 2, 3]), item(3, [7, 0, 7])]
    expect(changedProductIds(prev, next)).toEqual([1, 2])
  })

  it('새로 나타난 상품은 비교할 이전 값이 없어 넣지 않는다', () => {
    const prev = [item(1, [10, 0, 10])]
    const next = [item(1, [10, 0, 10]), item(9, [3, 0, 3])]
    expect(changedProductIds(prev, next)).toEqual([])
  })

  it('수량 말고 다른 값만 바뀌면 고르지 않는다', () => {
    const prev = [item(1, [10, 0, 10])]
    const next = [{ ...item(1, [10, 0, 10]), imminentLotCount: 1 }]
    expect(changedProductIds(prev, next)).toEqual([])
  })
})
