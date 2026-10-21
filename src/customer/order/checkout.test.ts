import { describe, expect, it } from 'vitest'
import {
  checkoutPath,
  clampQuantity,
  MAX_QUANTITY,
  parseCheckout,
  parseTossRedirect,
  successUrlFor,
} from './checkout'

describe('checkoutPath / parseCheckout', () => {
  const item = {
    storeId: 1,
    storeName: '프레시 강남점',
    productId: 15,
    productName: '매운 컵라면 115g',
    price: 1700,
  }

  it('상품 화면이 만든 주소를 주문 화면이 그대로 읽는다', () => {
    const path = checkoutPath(item)
    expect(path.startsWith('/customer/orders/new?')).toBe(true)
    expect(parseCheckout(new URL(path, 'http://x').searchParams)).toEqual(item)
  })

  it('구매 가능 수량을 넘기면 함께 읽는다', () => {
    const path = checkoutPath({ ...item, available: 3 })
    expect(parseCheckout(new URL(path, 'http://x').searchParams)?.available).toBe(3)
  })

  it('값이 빠지거나 숫자가 아니면 null', () => {
    expect(parseCheckout(new URLSearchParams('storeId=1&productId=2'))).toBeNull()
    expect(
      parseCheckout(
        new URLSearchParams('storeId=a&storeName=x&productId=2&productName=y&price=100'),
      ),
    ).toBeNull()
    expect(
      parseCheckout(new URLSearchParams('storeId=1&storeName=x&productId=2&productName=y&price=0')),
    ).toBeNull()
  })
})

describe('clampQuantity', () => {
  it('1~5, 구매 가능 수량이 더 적으면 그만큼', () => {
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(9)).toBe(MAX_QUANTITY)
    expect(clampQuantity(4, 3)).toBe(3)
    expect(clampQuantity(2, 0)).toBe(1)
  })
})

describe('parseTossRedirect', () => {
  it('성공 URL 쿼리에서 승인 요청 값을 꺼낸다', () => {
    const q = new URLSearchParams(
      'paymentType=NORMAL&orderId=FL-20261020-000123&paymentKey=tgen_1&amount=3400',
    )
    expect(parseTossRedirect(q)).toEqual({
      kind: 'success',
      confirm: { paymentKey: 'tgen_1', orderNo: 'FL-20261020-000123', amount: 3400 },
    })
  })

  it('실패 URL 쿼리', () => {
    const q = new URLSearchParams('code=PAY_PROCESS_CANCELED&message=취소&orderId=FL-1')
    expect(parseTossRedirect(q)).toEqual({ kind: 'fail', code: 'PAY_PROCESS_CANCELED' })
  })

  it('토스에서 돌아온 게 아니면 null', () => {
    expect(parseTossRedirect(new URLSearchParams(''))).toBeNull()
    expect(parseTossRedirect(new URLSearchParams('paymentKey=k&orderId=o&amount=abc'))).toBeNull()
  })
})

describe('successUrlFor', () => {
  it('같은 주문 화면으로 돌아온다', () => {
    expect(successUrlFor(123, 'https://d.cloudfront.net')).toBe(
      'https://d.cloudfront.net/customer/orders/123',
    )
  })
})
