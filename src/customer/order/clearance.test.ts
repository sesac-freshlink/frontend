import { describe, expect, it } from 'vitest'
import type { CheckoutItem } from './checkout'
import { checkoutPath, parseCheckout } from './checkout'
import {
  canCheckout,
  changeLine,
  hasClearance,
  initialLines,
  lineMax,
  linesTotal,
  lineText,
  quantityText,
  shortageMessage,
} from './clearance'

const item: CheckoutItem = {
  storeId: 1,
  storeName: '프레시 강남점',
  productId: 31,
  productName: '꿀밤고구마 800g',
  price: 4990,
  available: 10,
  clearancePrice: 3490,
  clearanceAvailable: 2,
}

describe('마감세일 함께 사기 수량 규칙', () => {
  it('마감세일 단가와 남은 수가 있고 선착순이 아니어야 마감세일 줄을 보여 준다', () => {
    expect(hasClearance(item)).toBe(true)
    expect(hasClearance({ ...item, clearancePrice: undefined })).toBe(false)
    expect(hasClearance({ ...item, clearanceAvailable: 0 })).toBe(false)
    expect(hasClearance({ ...item, firstCome: true })).toBe(false)
  })

  it('줄마다 상한은 그 줄 남은 수와 두 줄 합계 5개', () => {
    expect(lineMax(item, { clearance: 0, regular: 0 })).toEqual({ clearance: 2, regular: 5 })
    expect(lineMax(item, { clearance: 2, regular: 3 })).toEqual({ clearance: 2, regular: 3 })
    expect(lineMax(item, { clearance: 1, regular: 4 })).toEqual({ clearance: 1, regular: 4 })
    expect(lineMax({ ...item, available: 1 }, { clearance: 0, regular: 0 }).regular).toBe(1)
  })

  it('한 줄을 바꾸면 0 아래·상한 위로 가지 않는다', () => {
    const q = { clearance: 1, regular: 1 }
    expect(changeLine(item, q, 'clearance', 5)).toEqual({ clearance: 2, regular: 1 })
    expect(changeLine(item, q, 'regular', -1)).toEqual({ clearance: 1, regular: 0 })
    expect(changeLine(item, { clearance: 2, regular: 3 }, 'regular', 4)).toEqual({
      clearance: 2,
      regular: 3,
    })
  })

  it('두 줄 합계가 1~5개여야 결제할 수 있다', () => {
    expect(canCheckout({ clearance: 0, regular: 0 })).toBe(false)
    expect(canCheckout({ clearance: 1, regular: 0 })).toBe(true)
    expect(canCheckout({ clearance: 2, regular: 3 })).toBe(true)
  })

  it('처음 수량은 시트가 넘긴 값, 없으면 마감세일 1개', () => {
    expect(initialLines({ ...item, quantity: 2, clearanceQuantity: 1 })).toEqual({
      clearance: 1,
      regular: 1,
    })
    expect(initialLines({ ...item, clearanceQuantity: 2 })).toEqual({ clearance: 2, regular: 0 })
    expect(initialLines(item)).toEqual({ clearance: 1, regular: 0 })
    // 남은 수보다 많이 넘어오면 상한으로 줄인다
    expect(initialLines({ ...item, quantity: 5, clearanceQuantity: 4 })).toEqual({
      clearance: 2,
      regular: 1,
    })
  })

  it('표시용 합계는 마감세일가 × 마감세일 + 정가 × 기본', () => {
    expect(linesTotal(item, { clearance: 1, regular: 1 })).toBe(8480)
  })
})

describe('마감세일 문구', () => {
  it('줄 문구와 목록 수량 문구', () => {
    expect(lineText({ clearance: true, quantity: 1, unitPrice: 3490 })).toBe('마감세일 1개 3,490원')
    expect(lineText({ clearance: false, quantity: 2, unitPrice: 4990 })).toBe('기본 2개 4,990원')
    expect(quantityText({ quantity: 2, clearanceQuantity: 1 })).toBe('2개 (마감세일 1 + 기본 1)')
    expect(quantityText({ quantity: 2 })).toBe('2개')
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
})

describe('주문 화면 주소의 마감세일 값', () => {
  it('넘기고 다시 읽는다', () => {
    const path = checkoutPath({ ...item, quantity: 2, clearanceQuantity: 1 })
    const parsed = parseCheckout(new URL(path, 'http://x').searchParams)
    expect(parsed).toMatchObject({
      quantity: 2,
      clearanceQuantity: 1,
      clearancePrice: 3490,
      clearanceAvailable: 2,
    })
  })
})
