import { getResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@/customer/order/api'
import { orderHandlers } from './orderHandlers'

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(orderHandlers, new Request(new URL(path, location.origin), init))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}

function create(body: object) {
  return call('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(body),
  })
}

describe('주문 가짜 API의 마감세일 함께 사기', () => {
  afterEach(() => vi.useRealTimers())

  it('마감세일 1 + 기본 1이면 두 줄과 합계, 당일 픽업 기한이 생긴다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T03:00:00Z')) // KST 12:00
    const res = await create({
      storeId: 1,
      storeName: '프레시 강남점',
      productId: 1,
      quantity: 2,
      clearanceQuantity: 1,
    })
    expect(res.status).toBe(201)
    const { orderId } = (await res.json()) as { orderId: number }
    vi.setSystemTime(new Date('2026-11-06T03:00:02Z'))
    const order = (await (await call(`/api/orders/${orderId}`)).json()) as Order

    expect(order.lines).toEqual([
      { clearance: true, quantity: 1, unitPrice: 1050, amount: 1050 },
      { clearance: false, quantity: 1, unitPrice: 1500, amount: 1500 },
    ])
    expect(order.amount).toBe(2550)
    expect(order.pickupDeadline).toBe('2026-11-06T23:59:59+09:00')
  })

  it('판매 시간 밖이면 400 CLEARANCE_NOT_ON_SALE, 전체보다 많으면 400', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T14:30:00Z')) // KST 23:30
    const night = await create({
      storeId: 1,
      storeName: '점포',
      productId: 1,
      quantity: 1,
      clearanceQuantity: 1,
    })
    expect(night.status).toBe(400)
    expect(await night.json()).toMatchObject({ code: 'CLEARANCE_NOT_ON_SALE' })
    const tooMany = await create({
      storeId: 1,
      storeName: '점포',
      productId: 1,
      quantity: 1,
      clearanceQuantity: 2,
    })
    expect(tooMany.status).toBe(400)
  })
})
