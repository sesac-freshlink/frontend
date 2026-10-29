import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { InventoryLotStatus } from './api'

dayjs.extend(utc)
dayjs.extend(timezone)

const KST = 'Asia/Seoul'

/** 달력 한 칸 */
export interface CalendarCell {
  /** "YYYY-MM-DD" */
  date: string
  /** 일(1~31) */
  day: number
  /** 보고 있는 달의 날짜면 true. 앞뒤 달은 칸만 채운다 */
  inMonth: boolean
}

/** 오늘(한국 날짜)이 속한 달 "YYYY-MM" */
export function thisMonth(now: Date = new Date()): string {
  return dayjs(now).tz(KST).format('YYYY-MM')
}

/** 오늘(한국 날짜) "YYYY-MM-DD" */
export function today(now: Date = new Date()): string {
  return dayjs(now).tz(KST).format('YYYY-MM-DD')
}

/** month 에서 delta 달 옮긴 달 "YYYY-MM" */
export function shiftMonth(month: string, delta: number): string {
  return dayjs(`${month}-01`).add(delta, 'month').format('YYYY-MM')
}

/** "2026-10" → "2026년 10월" */
export function monthLabel(month: string): string {
  const [year, mon] = month.split('-')
  return `${year}년 ${Number(mon)}월`
}

/**
 * 달력 칸. 일요일부터 토요일까지 7칸씩, 그 달 1일이 든 주부터 마지막 날이 든 주까지.
 * 앞뒤 빈칸은 이전·다음 달 날짜로 채우고 inMonth 를 false 로 둔다
 */
export function monthGrid(month: string): CalendarCell[][] {
  const first = dayjs(`${month}-01`)
  const start = first.subtract(first.day(), 'day')
  const last = first.endOf('month')
  const end = last.add(6 - last.day(), 'day')

  const weeks: CalendarCell[][] = []
  for (let cursor = start; !cursor.isAfter(end, 'day'); cursor = cursor.add(7, 'day')) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const d = cursor.add(i, 'day')
        return { date: d.format('YYYY-MM-DD'), day: d.date(), inMonth: d.month() === first.month() }
      }),
    )
  }
  return weeks
}

const SEVERITY: Record<InventoryLotStatus, number> = { NORMAL: 0, IMMINENT: 1, EXPIRED: 2 }

/** 그날 lot 들 중 가장 급한 상태(경과 > 임박 > 정상). 칸 색에 쓴다 */
export function worstStatus(statuses: InventoryLotStatus[]): InventoryLotStatus {
  return statuses.reduce<InventoryLotStatus>(
    (worst, status) => (SEVERITY[status] > SEVERITY[worst] ? status : worst),
    'NORMAL',
  )
}
