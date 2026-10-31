import { getResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerOrderSummary, OrderPage } from '@/customer/order/api'
import type { OwnerOrder } from '@/owner/orders/api'
import { orderHandlers, resetOrders } from './orderHandlers'

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(orderHandlers, new Request(new URL(path, location.origin), init))
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
  afterEach(() => vi.restoreAllMocks())

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
    expect(await only('CANCELED')).toEqual(new Set(['EXPIRED', 'CANCELED', 'REFUNDED', 'PAID']))
  })

  it('결제 완료·준비 완료는 환불 상태로 나뉜다: 환불 없음은 픽업 대기, 환불 처리·실패는 취소·환불', async () => {
    const waiting = (await customer('tab=PICKUP_WAITING&size=50')).content
    expect(waiting.every((o) => o.refundStatus === 'NONE')).toBe(true)
    const canceled = (await customer('tab=CANCELED&size=50')).content
    const paid = canceled.filter((o) => o.status === 'PAID' || o.status === 'READY_FOR_PICKUP')
    expect(paid.length).toBeGreaterThan(0)
    expect(paid.every((o) => o.refundStatus !== 'NONE' && o.refundStatus !== 'COMPLETED')).toBe(
      true,
    )
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
    const canceled = await owner('tab=CANCELED&size=50')
    expect(canceled.content.every((o) => o.refundStatus !== 'NONE')).toBe(true)
    const requested = canceled.content.map((o) => o.cancelRequestedAt ?? '')
    expect(requested).toEqual([...requested].sort().reverse())
  })

  it('A7 결제 전 취소: 결제 대기만 CANCELED, 결제 완료는 409 ORDER_NOT_CANCELABLE', async () => {
    const created = await call('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'cancel-a7' },
      body: JSON.stringify({ storeId: 1, storeName: '프레시 강남점', productId: 1, quantity: 1 }),
    })
    const { orderId } = (await created.json()) as { orderId: number }
    // 1.5초 뒤 재고 결과가 온 것으로 본다 (결제 대기)
    const later = Date.now() + 2000
    vi.spyOn(Date, 'now').mockReturnValue(later)
    const res = await call(`/api/orders/${orderId}/payment/cancel`, { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'CANCELED' })

    const paid = (await customer('tab=PICKUP_WAITING&size=50')).content[0]
    const bad = await call(`/api/orders/${paid.orderId}/payment/cancel`, { method: 'POST' })
    expect(bad.status).toBe(409)
    expect(await bad.json()).toMatchObject({ code: 'ORDER_NOT_CANCELABLE' })
  })

  it('A8 결제 후 취소: 사유를 확인하고, 끝나면 REFUNDED·환불 완료, 다시 취소하면 409', async () => {
    const paid = (await customer('tab=PICKUP_WAITING&size=50')).content.find((o) => o.quantity < 4)!
    const post = (body: unknown) =>
      call(`/api/orders/${paid.orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    expect((await post({ reason: 'OUT_OF_STOCK' })).status).toBe(400)
    expect((await post({ reason: 'ETC', reasonDetail: '  ' })).status).toBe(400)
    const res = await post({ reason: 'CHANGE_OF_MIND' })
    expect(await res.json()).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'COMPLETED',
      refund: { requestedBy: 'CUSTOMER', reasonLabel: '단순 변심' },
    })
    expect((await post({ reason: 'CHANGE_OF_MIND' })).status).toBe(409)
  })

  it('A9 점주 환불 재시도: 환불 실패 주문은 사유를 새로 받아 다시 취소할 수 있다', async () => {
    const failed = (await owner('tab=CANCELED&size=50')).content.find(
      (o) => o.refundStatus === 'FAILED',
    )!
    const res = await call(`/api/owner/orders/${failed.orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'STORE_ISSUE' }),
    })
    expect(await res.json()).toMatchObject({
      status: 'REFUNDED',
      refundStatus: 'COMPLETED',
      refund: { requestedBy: 'OWNER', reasonLabel: '매장 사정' },
    })
  })
})
