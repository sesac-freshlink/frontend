import { describe, expect, it } from 'vitest'
import type { StoreProduct } from './api'
import { similarProducts } from './similar'

function product(productId: number, soldOut = false): StoreProduct {
  return {
    productId,
    name: `상품 ${productId}`,
    category: '라면',
    price: 1000,
    imageUrl: null,
    availableQuantity: soldOut ? 0 : 3,
    soldOut,
    recommended: false,
    newArrival: false,
    firstCome: false,
    nearestExpiry: null,
  }
}

describe('비슷한 상품', () => {
  it('지금 보는 상품과 품절을 빼고 목록 순서대로 앞에서 몇 개', () => {
    const list = [product(1), product(2, true), product(3), product(4), product(5), product(6)]
    expect(similarProducts(list, 3, 2).map((p) => p.productId)).toEqual([1, 4])
    expect(similarProducts(list, 1).map((p) => p.productId)).toEqual([3, 4, 5, 6])
  })

  it('아직 안 읽었거나 목록 모양이 아니면 빈 목록', () => {
    expect(similarProducts(undefined, 1)).toEqual([])
  })
})
