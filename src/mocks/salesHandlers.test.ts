import { getResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { SalesResponse } from '@/owner/sales/api'
import { kstToday } from '@/owner/sales/sales'
import { buildSales, salesHandlers } from './salesHandlers'

async function call(query: string) {
  const res = await getResponse(
    salesHandlers,
    new Request(new URL(`/api/owner/orders/sales?${query}`, location.origin)),
  )
  if (!res) throw new Error(`핸들러 없음: ${query}`)
  return res
}

async function expectValidation(query: string, message: string) {
  const res = await call(query)
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ code: 'VALIDATION_ERROR', message, traceId: '' })
}

describe('점주 매출 가짜 API', () => {
  it('from·to 가 없거나 형식이 틀리면 400 VALIDATION_ERROR', async () => {
    await expectValidation('to=2026-10-29', 'from: 필수입니다')
    await expectValidation('from=2026-10-23', 'to: 필수입니다')
    await expectValidation('from=2026/10/23&to=2026-10-29', 'from: yyyy-MM-dd 형식이어야 합니다')
    await expectValidation('from=2026-10-23&to=2026-02-30', 'to: yyyy-MM-dd 형식이어야 합니다')
  })

  it('from 이 to 보다 늦거나 366일을 넘으면 400', async () => {
    await expectValidation('from=2026-10-30&to=2026-10-29', 'from: to보다 늦을 수 없습니다')
    await expectValidation('from=2025-10-28&to=2026-10-29', 'to: 기간은 최대 366일입니다')
  })

  it('unit 이 day·week·month 가 아니면 400, 없으면 day', async () => {
    await expectValidation(
      'from=2026-10-23&to=2026-10-29&unit=year',
      'unit: day·week·month 중 하나여야 합니다',
    )
    const res = await call('from=2025-10-29&to=2026-10-29')
    expect(res.status).toBe(200)
    const body = (await res.json()) as SalesResponse
    expect(body.unit).toBe('day')
    expect(body.periods).toHaveLength(366)
  })

  it('기간 안 모든 날을 오래된 순으로 내리고 내일 이후는 0', () => {
    const body = buildSales('2026-10-27', '2026-10-31', 'day', '2026-10-29')
    expect(body).toMatchObject({ from: '2026-10-27', to: '2026-10-31', unit: 'day' })
    expect(body.periods.map((p) => p.period)).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
    expect(body.periods[3]).toMatchObject({ paidAmount: 0, paidCount: 0 })
    expect(body.periods[4]).toMatchObject({ paidAmount: 0, paidCount: 0 })
    for (const p of body.periods) {
      expect(p.netAmount).toBe(p.paidAmount - p.refundAmount)
      expect(p).toMatchObject({ refundAmount: 0, refundCount: 0, canceledCount: 0 })
    }
  })

  it('최근 날짜에는 매출이 있고, 같은 날짜면 늘 같은 금액이다', () => {
    const a = buildSales('2026-10-01', '2026-10-29', 'day', '2026-10-29')
    const b = buildSales('2026-10-01', '2026-10-29', 'day', '2026-10-29')
    expect(a).toEqual(b)
    expect(a.periods.filter((p) => p.paidAmount > 0).length).toBeGreaterThan(10)
  })

  it('주는 월요일 이름으로, 월은 yyyy-MM 으로 묶고 합계는 일별 합과 같다', () => {
    const today = '2026-10-29'
    const days = buildSales('2026-10-23', '2026-10-29', 'day', today)
    const weeks = buildSales('2026-10-23', '2026-10-29', 'week', today)
    expect(weeks.periods.map((p) => p.period)).toEqual(['2026-10-19', '2026-10-26'])
    const sum = (r: SalesResponse) => r.periods.reduce((s, p) => s + p.paidAmount, 0)
    expect(sum(weeks)).toBe(sum(days))

    const months = buildSales('2026-08-15', '2026-10-29', 'month', today)
    expect(months.periods.map((p) => p.period)).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('오늘 매출도 들어 있어 화면 카드가 비지 않는다', async () => {
    const today = kstToday()
    const res = await call(`from=${today}&to=${today}&unit=day`)
    const body = (await res.json()) as SalesResponse
    expect(body.periods).toHaveLength(1)
    expect(body.periods[0].period).toBe(today)
    expect(body.periods[0].paidAmount).toBeGreaterThan(0)
  })
})
