import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { http, HttpResponse, sse } from 'msw'
import type { SalesPeriod, SalesResponse, SalesUnit, TodaySales } from '@/owner/sales/api'
import { kstToday, MAX_DAYS, weekStart } from '@/owner/sales/sales'

dayjs.extend(utc)

/**
 * order-service 가짜 API (김경우): 점주 매출 대시보드(기능 ID 미정) GET /owner/orders/sales.
 * 검사·묶음 규칙은 order-service SalesPeriod·SalesUnit 과 같다. 금액은 날짜로 정해지는 가짜 값이라 매번 같다.
 * 매출 SSE GET /owner/orders/sales/stream 은 연결하면 오늘 합계를 한 번 보낸다 (가짜 결제 완료는 없다)
 */

/** 오늘부터 이만큼 지난 날까지만 가짜 매출이 있다. 더 옛날과 내일 이후는 0 */
const FAKE_DAYS = 120

function validation(message: string) {
  return HttpResponse.json({ code: 'VALIDATION_ERROR', message, traceId: '' }, { status: 400 })
}

/** "yyyy-MM-dd" 이고 실제 있는 날짜면 그대로, 아니면 null */
function parseDate(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null
  const date = value.trim()
  return dayjs.utc(date).format('YYYY-MM-DD') === date ? date : null
}

function parseUnit(value: string | null): SalesUnit | null {
  if (value === null || value.trim() === '') return 'day'
  const unit = value.trim().toLowerCase()
  return unit === 'day' || unit === 'week' || unit === 'month' ? unit : null
}

/** 날짜 문자열로 정해지는 0 이상 정수 (같은 날짜면 늘 같은 값) */
function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 하루 가짜 결제: 건수 2~11, 한 건 평균 1,500~4,400원 (100원 단위). 7일에 하루쯤 매출 없는 날 */
function fakeDay(date: string, today: string): { amount: number; count: number } {
  const daysAgo = dayjs.utc(today).diff(dayjs.utc(date), 'day')
  if (daysAgo < 0 || daysAgo > FAKE_DAYS) return { amount: 0, count: 0 }
  const h = hash(date)
  // 오늘은 카드가 비지 않게 늘 매출이 있다
  if (daysAgo > 0 && h % 7 === 0) return { amount: 0, count: 0 }
  // 오늘은 아직 하루가 덜 지나 적게
  const count = daysAgo === 0 ? 2 + (h % 3) : 2 + (h % 10)
  const average = 1500 + ((h >>> 4) % 30) * 100
  return { amount: count * average, count }
}

function bucketStart(date: string, unit: SalesUnit): string {
  if (unit === 'week') return weekStart(date)
  if (unit === 'month') return `${date.slice(0, 7)}-01`
  return date
}

function nextBucket(start: string, unit: SalesUnit): string {
  return dayjs.utc(start).add(1, unit).format('YYYY-MM-DD')
}

/** 기간 안 모든 묶음을 오래된 순으로. 매출 없는 묶음도 0 으로 넣는다 (서버 SalesService 와 같다) */
export function buildSales(
  from: string,
  to: string,
  unit: SalesUnit,
  today: string = kstToday(),
): SalesResponse {
  const buckets = new Map<string, SalesPeriod>()
  for (let start = bucketStart(from, unit); start <= to; start = nextBucket(start, unit)) {
    buckets.set(start, {
      period: unit === 'month' ? start.slice(0, 7) : start,
      paidAmount: 0,
      refundAmount: 0,
      netAmount: 0,
      paidCount: 0,
      refundCount: 0,
      canceledCount: 0,
    })
  }
  for (let date = from; date <= to; date = nextBucket(date, 'day')) {
    const { amount, count } = fakeDay(date, today)
    const bucket = buckets.get(bucketStart(date, unit))
    if (!bucket || count === 0) continue
    bucket.paidAmount += amount
    bucket.netAmount += amount
    bucket.paidCount += count
  }
  return { from, to, unit, periods: [...buckets.values()] }
}

/**
 * 매출 SSE 가짜: 연결하면 오늘 합계를 한 번 보낸다. MSW sse 는 EventSource 가 없는 곳(테스트의 jsdom)에서 만들면
 * 바로 오류라, 브라우저에서만 넣는다
 */
const salesStreamHandlers =
  typeof EventSource === 'undefined'
    ? []
    : [
        sse<{ sales: string }>('/api/owner/orders/sales/stream', ({ client }) => {
          const today = kstToday()
          const { amount, count } = fakeDay(today, today)
          const data: TodaySales = { date: today, paidAmount: amount, paidCount: count }
          client.send({ event: 'sales', data: JSON.stringify(data) })
        }),
      ]

export const salesHandlers = [
  http.get('/api/owner/orders/sales', ({ request }) => {
    const params = new URL(request.url).searchParams
    const rawFrom = params.get('from')
    const rawTo = params.get('to')
    if (!rawFrom?.trim()) return validation('from: 필수입니다')
    const from = parseDate(rawFrom)
    if (!from) return validation('from: yyyy-MM-dd 형식이어야 합니다')
    if (!rawTo?.trim()) return validation('to: 필수입니다')
    const to = parseDate(rawTo)
    if (!to) return validation('to: yyyy-MM-dd 형식이어야 합니다')
    if (from > to) return validation('from: to보다 늦을 수 없습니다')
    if (dayjs.utc(to).diff(dayjs.utc(from), 'day') + 1 > MAX_DAYS) {
      return validation(`to: 기간은 최대 ${MAX_DAYS}일입니다`)
    }
    const unit = parseUnit(params.get('unit'))
    if (!unit) return validation('unit: day·week·month 중 하나여야 합니다')
    return HttpResponse.json(buildSales(from, to, unit))
  }),
  ...salesStreamHandlers,
]
