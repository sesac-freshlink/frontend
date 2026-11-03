import { describe, expect, it } from 'vitest'
import type { SalesPeriod } from './api'
import {
  axisLabel,
  barRatio,
  chartScale,
  chartSummary,
  formatAxisWon,
  isAllZero,
  kstToday,
  labelEvery,
  periodLabel,
  quickRange,
  rangeError,
  sumPeriods,
  thisWeekRange,
  todayAndWeek,
  weekStart,
} from './sales'

function row(period: string, netAmount: number, paidCount = 1): SalesPeriod {
  return {
    period,
    paidAmount: netAmount,
    refundAmount: 0,
    netAmount,
    paidCount,
    refundCount: 0,
    canceledCount: 0,
  }
}

// 2026-10-29(목) 00:30 KST = 2026-10-28 15:30 UTC. UTC 로는 아직 28일이다
const thursdayKst = new Date('2026-10-28T15:30:00Z')

describe('기간 기본값', () => {
  it('오늘은 브라우저 시간대가 아니라 한국 날짜다', () => {
    expect(kstToday(thursdayKst)).toBe('2026-10-29')
  })

  it('주는 월요일에 시작한다 (일요일은 앞 주)', () => {
    expect(weekStart('2026-10-29')).toBe('2026-10-26')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
    // 달·해를 넘는 주
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })

  it('빠른 기간은 모두 오늘(한국 날짜)에서 끝난다', () => {
    expect(quickRange('last7', thursdayKst)).toEqual({ from: '2026-10-23', to: '2026-10-29' })
    expect(quickRange('last30', thursdayKst)).toEqual({ from: '2026-09-30', to: '2026-10-29' })
    expect(quickRange('thisMonth', thursdayKst)).toEqual({ from: '2026-10-01', to: '2026-10-29' })
  })

  it('이번 주는 월요일 ~ 오늘', () => {
    expect(thisWeekRange(thursdayKst)).toEqual({ from: '2026-10-26', to: '2026-10-29' })
    // 월요일이면 오늘 하루
    expect(thisWeekRange(new Date('2026-10-26T01:00:00Z'))).toEqual({
      from: '2026-10-26',
      to: '2026-10-26',
    })
  })
})

describe('기간 검사 (서버와 같은 규칙)', () => {
  it('맞는 기간은 null', () => {
    expect(rangeError({ from: '2026-10-29', to: '2026-10-29' })).toBeNull()
    // 366일까지 (윤년 아닌 해 1년 + 하루)
    expect(rangeError({ from: '2025-10-29', to: '2026-10-29' })).toBeNull()
  })

  it('비었거나, 시작일이 늦거나, 366일을 넘으면 문구', () => {
    expect(rangeError({ from: '', to: '2026-10-29' })).toBe('시작일과 종료일을 모두 골라 주세요.')
    expect(rangeError({ from: '2026-10-30', to: '2026-10-29' })).toBe('시작일이 종료일보다 늦어요.')
    expect(rangeError({ from: '2025-10-28', to: '2026-10-29' })).toBe(
      '기간은 최대 366일까지 볼 수 있어요.',
    )
  })
})

describe('합계', () => {
  it('모든 금액·건수를 더한다', () => {
    const periods = [
      row('2026-10-28', 3400, 2),
      { ...row('2026-10-29', 1000, 1), refundAmount: 500, netAmount: 500, refundCount: 1 },
    ]
    expect(sumPeriods(periods)).toEqual({
      paidAmount: 4400,
      refundAmount: 500,
      netAmount: 3900,
      paidCount: 3,
      refundCount: 1,
      canceledCount: 0,
    })
    expect(sumPeriods([])).toMatchObject({ paidAmount: 0, paidCount: 0 })
  })

  it('오늘 매출은 오늘 묶음, 이번 주 매출은 전체 합계. 오늘 묶음이 없으면 0', () => {
    const week = [row('2026-10-26', 1000), row('2026-10-27', 0, 0), row('2026-10-28', 2500)]
    expect(todayAndWeek(week, '2026-10-28')).toEqual({ today: 2500, week: 3500 })
    expect(todayAndWeek(week, '2026-10-29')).toEqual({ today: 0, week: 3500 })
  })

  it('금액·건수가 모두 0 이면 빈 기간', () => {
    expect(isAllZero([row('2026-10-28', 0, 0), row('2026-10-29', 0, 0)])).toBe(true)
    expect(isAllZero([row('2026-10-28', 0, 0), row('2026-10-29', 1500)])).toBe(false)
    expect(isAllZero([{ ...row('2026-10-28', 0, 0), canceledCount: 1 }])).toBe(false)
    expect(isAllZero([])).toBe(true)
  })
})

describe('그래프 눈금', () => {
  it('가장 큰 값을 1·2·5 단위 눈금으로 올린다', () => {
    expect(chartScale([12_300, 4_500, 0])).toEqual({
      max: 15_000,
      ticks: [0, 5_000, 10_000, 15_000],
    })
    expect(chartScale([100_000])).toEqual({
      max: 100_000,
      ticks: [0, 50_000, 100_000],
    })
    expect(chartScale([3])).toEqual({ max: 3, ticks: [0, 1, 2, 3] })
  })

  it('모두 0(또는 음수)이면 max 0, 눈금 0 하나', () => {
    expect(chartScale([0, 0, 0])).toEqual({ max: 0, ticks: [0] })
    expect(chartScale([-500, 0])).toEqual({ max: 0, ticks: [0] })
    expect(chartScale([])).toEqual({ max: 0, ticks: [0] })
  })

  it('막대 비율은 0~1, max 0·음수는 0', () => {
    expect(barRatio(7_500, 15_000)).toBe(0.5)
    expect(barRatio(0, 0)).toBe(0)
    expect(barRatio(100, 0)).toBe(0)
    expect(barRatio(-100, 1_000)).toBe(0)
    expect(barRatio(2_000, 1_000)).toBe(1)
  })

  it('가로축 이름은 10개를 넘지 않게 건너뛴다', () => {
    expect(labelEvery(7)).toBe(1)
    expect(labelEvery(10)).toBe(1)
    expect(labelEvery(30)).toBe(3)
    expect(labelEvery(366)).toBe(37)
    expect(labelEvery(0)).toBe(1)
  })

  it('세로축 금액은 만 단위로 줄인다', () => {
    expect(formatAxisWon(0)).toBe('0')
    expect(formatAxisWon(2_500)).toBe('2,500')
    expect(formatAxisWon(15_000)).toBe('1.5만')
    expect(formatAxisWon(1_250_000)).toBe('125만')
  })
})

describe('기간 이름', () => {
  const range = { from: '2026-10-23', to: '2026-10-29' }

  it('표: 일은 요일까지, 주는 조회 기간 안 날만, 월은 연·월', () => {
    expect(periodLabel('2026-10-29', 'day', range)).toBe('10/29(목)')
    expect(periodLabel('2026-10-19', 'week', range)).toBe('10/23(금) ~ 10/25(일)')
    expect(periodLabel('2026-10-26', 'week', range)).toBe('10/26(월) ~ 10/29(목)')
    expect(periodLabel('2026-10', 'month', range)).toBe('2026년 10월')
  })

  it('가로축: 일·주는 MM/DD, 월은 N월', () => {
    expect(axisLabel('2026-10-29', 'day')).toBe('10/29')
    expect(axisLabel('2026-10-26', 'week')).toBe('10/26')
    expect(axisLabel('2026-09', 'month')).toBe('9월')
  })

  it('그래프 요약 문장', () => {
    expect(
      chartSummary([row('2026-10-28', 3400), row('2026-10-29', 1000)], 'day', '일별 순매출'),
    ).toBe('일별 순매출 그래프. 10/28 ~ 10/29, 합계 4,400원, 가장 높은 때 10/28 3,400원')
    expect(chartSummary([row('2026-10', 0, 0)], 'month', '월별 순매출')).toBe(
      '월별 순매출 그래프. 10월, 매출 없음',
    )
  })
})
