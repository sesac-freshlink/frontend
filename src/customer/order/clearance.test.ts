import { describe, expect, it } from 'vitest'
import { isMixedOrder, lineText, quantityText, shortageMessage } from './clearance'

describe('마감세일 문구', () => {
  it('줄 문구와 목록 수량 문구', () => {
    expect(lineText({ clearance: true, quantity: 1, unitPrice: 3490 })).toBe('마감세일 1개 3,490원')
    expect(lineText({ clearance: false, quantity: 2, unitPrice: 4990 })).toBe('기본 2개 4,990원')
    expect(quantityText({ quantity: 2, clearanceQuantity: 1 })).toBe('2개 (마감세일 1 + 기본 1)')
    expect(quantityText({ quantity: 2 })).toBe('2개')
    expect(quantityText({ quantity: 1, clearanceQuantity: 1 })).toBe('1개 (마감세일 1)')
    expect(quantityText({ quantity: 3, clearanceQuantity: 3 })).toBe('3개 (마감세일 3)')
  })

  it('어느 쪽 재고가 모자란지 남은 수로 알려 준다', () => {
    const order = { quantity: 2, clearanceQuantity: 1 }
    expect(
      shortageMessage({
        ...order,
        failureReason: 'CLEARANCE_SOLD_OUT',
        clearanceAvailableQuantity: 0,
        availableQuantity: 2,
      }),
    ).toBe('마감세일이 끝났어요. 기본 상품은 2개 남았어요. 다시 골라 주세요.')
    expect(
      shortageMessage({
        quantity: 3,
        clearanceQuantity: 2,
        failureReason: 'CLEARANCE_SOLD_OUT',
        clearanceAvailableQuantity: 1,
        availableQuantity: null,
      }),
    ).toBe('마감세일 상품이 1개만 남았어요. 다시 골라 주세요.')
    expect(
      shortageMessage({
        quantity: 4,
        clearanceQuantity: 1,
        failureReason: 'OUT_OF_STOCK',
        clearanceAvailableQuantity: 1,
        availableQuantity: 2,
      }),
    ).toBe('기본 상품은 2개 남았어요. 다시 골라 주세요.')
    // 마감세일 없는 주문은 기존 문구를 쓴다
    expect(
      shortageMessage({
        quantity: 2,
        failureReason: 'OUT_OF_STOCK',
        availableQuantity: 1,
      }),
    ).toBeNull()
  })

  it('마감세일과 일반이 둘 다 1개 이상일 때만 섞인 주문이다', () => {
    expect(isMixedOrder({ quantity: 2, clearanceQuantity: 1 })).toBe(true)
    expect(isMixedOrder({ quantity: 2, clearanceQuantity: 2 })).toBe(false)
    expect(isMixedOrder({ quantity: 2, clearanceQuantity: 0 })).toBe(false)
    expect(isMixedOrder({ quantity: 2 })).toBe(false)
  })
})
