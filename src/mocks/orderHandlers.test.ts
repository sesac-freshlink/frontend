import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CustomerOrderSummary, OrderPage } from '@/customer/order/api'
import type { OwnerOrder } from '@/owner/orders/api'
import { orderHandlers, resetOrders } from './orderHandlers'

async function call(path: string) {
  const res = await getResponse(orderHandlers, new Request(new URL(path, location.origin)))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}

async function customer(query: string) {
  const res = await call(`/api/orders?${query}`)
  expect(res.status).toBe(200)
  return (await res.json()) as OrderPage<CustomerOrderSummary>
}

async function owner(query: string) {
  const res = await call(`/api/owner/orders?${query}`)
  expect(res.status).toBe(200)
  return (await res.json()) as OrderPage<OwnerOrder>
}

describe('주문 목록 가짜 API (OR-06·OR-04 tab)', () => {
  beforeEach(() => resetOrders())

  it('고객 전체는 재고 부족·결제 실패를 빼고 주문일시 최신순이다', async () => {
    const body = await customer('size=50')
    const statuses = new Set(body.content.map((o) => o.status))
    expect(statuses.has('OUT_OF_STOCK')).toBe(false)
    expect(statuses.has('PAYMENT_FAILED')).toBe(false)
    expect(statuses.has('PICKUP_EXPIRED')).toBe(true)
    const times = body.content.map((o) => o.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect(body.totalElements).toBeGreaterThan(20)
  })

  it('고객 구분은 서버 CustomerOrderTab 과 같은 상태만 내린다', async () => {
    const only = async (tab: string) =>
      new Set((await customer(`tab=${tab}&size=50`)).content.map((o) => o.status))
    expect(await only('PICKUP_WAITING')).toEqual(new Set(['PAID', 'READY_FOR_PICKUP']))
    expect(await only('PICKED_UP')).toEqual(new Set(['PICKED_UP']))
    expect(await only('CANCELED')).toEqual(new Set(['EXPIRED']))
  })

  it('page·size 로 자르고 totalPages 를 준다', async () => {
    const first = await customer('tab=ALL&page=0&size=10')
    expect(first.content).toHaveLength(10)
    expect(first.totalPages).toBe(Math.ceil(first.totalElements / 10))
    const second = await customer('tab=ALL&page=1&size=10')
    expect(second.content[0].orderId).not.toBe(first.content[0].orderId)
  })

  it('기간은 주문일(KST) 기준으로 둘 다 포함해 거른다', async () => {
    const all = (await customer('size=50')).content
    const day = all[3].createdAt.slice(0, 10)
    const body = await customer(`from=${day}&to=${day}&size=50`)
    expect(body.content.length).toBeGreaterThan(0)
    expect(body.content.every((o) => o.createdAt.startsWith(day))).toBe(true)
  })

  it('잘못된 tab·size·날짜와 from > to 는 400 VALIDATION_ERROR', async () => {
    for (const q of [
      'tab=X',
      'size=15',
      'page=-1',
      'from=2026-1-1',
      'from=2026-10-20&to=2026-10-10',
    ]) {
      const res = await call(`/api/orders?${q}`)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    }
    const res = await call('/api/owner/orders?tab=ALL')
    expect(res.status).toBe(400)
  })

  it('점주 목록은 tab 이 없으면 결제 완료 배열, 있으면 구분별 페이지다', async () => {
    const legacy = (await (await call('/api/owner/orders')).json()) as OwnerOrder[]
    expect(Array.isArray(legacy)).toBe(true)
    expect(legacy.every((o) => o.status === 'PAID' || o.status === 'READY_FOR_PICKUP')).toBe(true)

    const waiting = await owner('tab=PICKUP_WAITING&size=50')
    expect(waiting.totalElements).toBe(legacy.length)
    const picked = await owner('tab=PICKED_UP&size=50')
    expect(picked.content.length).toBeGreaterThan(0)
    expect(picked.content.every((o) => o.status === 'PICKED_UP' && o.pickedUpAt)).toBe(true)
    const pickedAt = picked.content.map((o) => o.pickedUpAt ?? '')
    expect(pickedAt).toEqual([...pickedAt].sort().reverse())
    const expired = await owner('tab=PICKUP_EXPIRED')
    expect(expired.content.every((o) => o.status === 'PICKUP_EXPIRED')).toBe(true)
    expect((await owner('tab=CANCELED')).totalElements).toBe(0)
  })
})
