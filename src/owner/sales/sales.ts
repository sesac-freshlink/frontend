import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { formatWon } from '@/customer/order/format'
import type { SalesPeriod, SalesUnit } from './api'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 매출 날짜는 브라우저 시간대와 상관없이 서버와 같은 한국 날짜로 정한다 */
const KST = 'Asia/Seoul'

/** 한 번에 볼 수 있는 최대 일수 (order-service SalesPeriod.MAX_DAYS 와 같다) */
export const MAX_DAYS = 366

/** 조회 기간. 한국 날짜 "YYYY-MM-DD", 둘 다 포함 */
export interface SalesRange {
  from: string
  to: string
}

/** 빠른 기간 버튼 */
export type QuickRange = 'last7' | 'last30' | 'thisMonth'

export const QUICK_RANGES: { value: QuickRange; label: string }[] = [
  { value: 'last7', label: '최근 7일' },
  { value: 'last30', label: '최근 30일' },
  { value: 'thisMonth', label: '이번 달' },
]

export const UNITS: { value: SalesUnit; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
]

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 날짜 문자열 계산은 시간대 영향(서머타임 등)을 받지 않게 UTC 자정으로 다룬다 */
function day(date: string) {
  return dayjs.utc(date)
}

/** 오늘(한국 날짜) "YYYY-MM-DD" */
export function kstToday(now: Date = new Date()): string {
  return dayjs(now).tz(KST).format('YYYY-MM-DD')
}

/** date 가 속한 주의 월요일 "YYYY-MM-DD" (서버와 같이 주는 월요일에 시작한다) */
export function weekStart(date: string): string {
  const d = day(date)
  return d.subtract((d.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

/** 빠른 기간 버튼의 기간. 모두 오늘에서 끝난다 */
export function quickRange(kind: QuickRange, now: Date = new Date()): SalesRange {
  const to = kstToday(now)
  switch (kind) {
    case 'last7':
      return { from: day(to).subtract(6, 'day').format('YYYY-MM-DD'), to }
    case 'last30':
      return { from: day(to).subtract(29, 'day').format('YYYY-MM-DD'), to }
    case 'thisMonth':
      return { from: `${to.slice(0, 7)}-01`, to }
  }
}

/** 이번 주(월요일 ~ 오늘). 요약 카드의 오늘·이번 주 매출을 이 기간 하나로 받는다 */
export function thisWeekRange(now: Date = new Date()): SalesRange {
  const to = kstToday(now)
  return { from: weekStart(to), to }
}

/** 기간이 잘못됐으면 화면 문구, 맞으면 null. 서버 검사(필수, from ≤ to, 최대 366일)와 같다 */
export function rangeError({ from, to }: SalesRange): string | null {
  if (!from || !to) return '시작일과 종료일을 모두 골라 주세요.'
  if (from > to) return '시작일이 종료일보다 늦어요.'
  if (day(to).diff(day(from), 'day') + 1 > MAX_DAYS) {
    return `기간은 최대 ${MAX_DAYS}일까지 볼 수 있어요.`
  }
  return null
}

/** 합계 한 줄 (표 맨 아래 줄, 결제·환불 건수 카드) */
export type SalesTotals = Omit<SalesPeriod, 'period'>

export function sumPeriods(periods: SalesPeriod[]): SalesTotals {
  const totals: SalesTotals = {
    paidAmount: 0,
    refundAmount: 0,
    netAmount: 0,
    paidCount: 0,
    refundCount: 0,
    canceledCount: 0,
  }
  for (const p of periods) {
    totals.paidAmount += p.paidAmount
    totals.refundAmount += p.refundAmount
    totals.netAmount += p.netAmount
    totals.paidCount += p.paidCount
    totals.refundCount += p.refundCount
    totals.canceledCount += p.canceledCount
  }
  return totals
}

/** 이번 주 일별 응답에서 오늘 순매출과 이번 주 순매출 합계를 꺼낸다 */
export function todayAndWeek(
  periods: SalesPeriod[],
  today: string,
): { today: number; week: number } {
  return {
    today: periods.find((p) => p.period === today)?.netAmount ?? 0,
    week: sumPeriods(periods).netAmount,
  }
}

/** 모든 묶음의 금액·건수가 0 이면 true (보여 줄 매출이 없다) */
export function isAllZero(periods: SalesPeriod[]): boolean {
  const totals = sumPeriods(periods)
  return Object.values(totals).every((v) => v === 0)
}

/** 그래프 세로축. max 는 맨 위 눈금, ticks 는 0부터 max 까지 같은 간격 눈금 */
export interface ChartScale {
  max: number
  ticks: number[]
}

/** raw 이상인 가장 작은 1·2·5 × 10ⁿ (1 미만은 1) */
function niceStep(raw: number): number {
  if (raw <= 1) return 1
  const exp = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5]) {
    if (m * exp >= raw) return m * exp
  }
  return 10 * exp
}

/**
 * 그래프 세로축 눈금. 가장 큰 값을 약 tickCount 칸으로 나눠 1·2·5 단위로 반올림한다.
 * 모두 0(또는 음수)이면 max 0, 눈금은 0 하나다
 */
export function chartScale(values: number[], tickCount = 4): ChartScale {
  const top = Math.max(0, ...values)
  if (top === 0) return { max: 0, ticks: [0] }
  const step = niceStep(top / tickCount)
  const max = step * Math.ceil(top / step)
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { max, ticks }
}

/** 막대 높이 비율(0~1). 음수(환불이 더 많은 날)는 0, max 가 0 이면 0 */
export function barRatio(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.min(1, value / max)
}

/** 가로축 이름을 몇 개마다 하나씩 보여 줄지. 이름이 maxLabels 개를 넘지 않게 한다 */
export function labelEvery(count: number, maxLabels = 10): number {
  return Math.max(1, Math.ceil(count / maxLabels))
}

/** "2026-10-29" → "10/29(목)" */
export function formatShortDate(date: string): string {
  const d = day(date)
  return `${d.format('MM/DD')}(${WEEKDAYS[d.day()]})`
}

/**
 * 표의 기간 이름. day "10/29(목)", week "10/26(월) ~ 11/01(일)", month "2026년 10월".
 * 주는 조회 기간 밖으로 나가는 날을 잘라 range 안의 날만 보여 준다 (서버도 range 안의 결제만 더한다)
 */
export function periodLabel(period: string, unit: SalesUnit, range: SalesRange): string {
  if (unit === 'month') {
    const [year, month] = period.split('-')
    return `${year}년 ${Number(month)}월`
  }
  if (unit === 'day') return formatShortDate(period)
  const end = day(period).add(6, 'day').format('YYYY-MM-DD')
  const first = period < range.from ? range.from : period
  const last = end > range.to ? range.to : end
  return `${formatShortDate(first)} ~ ${formatShortDate(last)}`
}

/** 그래프 가로축 이름. day·week "10/29", month "10월" */
export function axisLabel(period: string, unit: SalesUnit): string {
  if (unit === 'month') return `${Number(period.slice(5, 7))}월`
  return day(period).format('MM/DD')
}

/** 그래프 세로축 금액: 2500 → "2,500", 15000 → "1.5만", 1250000 → "125만" */
export function formatAxisWon(value: number): string {
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}만`
  return value.toLocaleString('ko-KR')
}

/** 그래프 요약 문장: "일별 순매출 그래프. 10/23 ~ 10/29, 합계 12,300원, 가장 높은 때 10/27 4,500원" */
export function chartSummary(periods: SalesPeriod[], unit: SalesUnit, title: string): string {
  if (periods.length === 0) return `${title} 그래프. 데이터 없음`
  const first = axisLabel(periods[0].period, unit)
  const last = axisLabel(periods[periods.length - 1].period, unit)
  const total = periods.reduce((sum, p) => sum + p.netAmount, 0)
  const top = periods.reduce((best, p) => (p.netAmount > best.netAmount ? p : best))
  const range = first === last ? first : `${first} ~ ${last}`
  if (top.netAmount <= 0) return `${title} 그래프. ${range}, 매출 없음`
  return `${title} 그래프. ${range}, 합계 ${formatWon(total)}, 가장 높은 때 ${axisLabel(top.period, unit)} ${formatWon(top.netAmount)}`
}
