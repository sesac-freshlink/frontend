import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PickupPass } from '@/customer/order/api'
import type { PickupApproveResult, PickupPassOrders } from '@/owner/orders/pickup/api'
import { orderHandlers, resetOrders, resetPickupPass } from './orderHandlers'

const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'freshlink' }

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(orderHandlers, new Request(new URL(path, location.origin), init))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}
const post = (path: string, body?: unknown) =>
  call(path, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('픽업 QR 가짜 API (A16)', () => {
  beforeEach(() => {
    resetOrders()
    resetPickupPass()
  })

  it('QR을 만들고 표·코드로 같은 목록을 받는다. 준비 완료만 고를 수 있다', async () => {
    const pass = (await (await post('/api/orders/pickup-pass')).json()) as PickupPass
    expect(pass.code).toMatch(/^\d{6}$/)
    for (const key of [pass.token, pass.code]) {
      const list = (await (
        await call(`/api/owner/orders/pickup-pass/${key}`)
      ).json()) as PickupPassOrders
      expect(list.token).toBe(pass.token)
      expect(list.orders.length).toBeGreaterThan(0)
      for (const o of list.orders) expect(o.selectable).toBe(o.status === 'READY_FOR_PICKUP')
    }
    expect((await call('/api/owner/orders/pickup-pass/000000')).status).toBe(404)
  })

  it('고른 준비 완료 주문만 픽업되고 건마다 결과가 온다', async () => {
    const pass = (await (await post('/api/orders/pickup-pass')).json()) as PickupPass
    const list = (await (
      await call(`/api/owner/orders/pickup-pass/${pass.token}`)
    ).json()) as PickupPassOrders
    const ready = list.orders.find((o) => o.selectable)
    const notReady = list.orders.find((o) => !o.selectable)
    const ids = [ready?.orderId, notReady?.orderId].filter((v): v is number => v !== undefined)
    const res = (await (
      await post('/api/owner/orders/pickup', { token: pass.token, orderIds: ids })
    ).json()) as PickupApproveResult
    if (ready) expect(res.results[0]).toEqual({ orderId: ready.orderId, result: 'PICKED_UP' })
    if (notReady) expect(res.results.at(-1)?.result).toBe('NOT_PICKABLE')
    expect(
      (await post('/api/owner/orders/pickup', { token: pass.token, orderIds: [] })).status,
    ).toBe(400)
  })

  it('표가 없으면 스캔은 404', async () => {
    expect((await post('/api/owner/orders/pickup-scan', { token: 'nope' })).status).toBe(404)
  })
})
