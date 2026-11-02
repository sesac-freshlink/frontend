import { describe, expect, it } from 'vitest'
import { parseCheckout } from '@/customer/order/checkout'
import { queuePath } from './firstComeQueue'

describe('선착순 대기 화면 주소', () => {
  it('대기 화면 경로에 주문 화면과 같은 쿼리를 붙여, 대기 화면이 parseCheckout 으로 그대로 읽는다', () => {
    const item = {
      storeId: 1,
      storeName: '프레시 강남점',
      productId: 12,
      productName: '흰 우유 500ml',
      price: 1900,
      available: 7,
    }
    const path = queuePath(item)

    expect(path.startsWith('/customer/stores/1/products/12/queue?')).toBe(true)
    expect(parseCheckout(new URLSearchParams(path.slice(path.indexOf('?'))))).toMatchObject(item)
  })
})
