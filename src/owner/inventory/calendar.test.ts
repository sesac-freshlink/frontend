import { describe, expect, it } from 'vitest'
import { monthGrid, monthLabel, shiftMonth, thisMonth, today, worstStatus } from './calendar'

describe('유통기한 달력 계산', () => {
  it('2026년 10월은 목요일에 시작해 5주이고, 앞뒤 빈칸은 다른 달 날짜로 채운다', () => {
    const weeks = monthGrid('2026-10')

    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    // 9/27(일) ~ 10/31(토)
    expect(weeks[0][0]).toEqual({ date: '2026-09-27', day: 27, inMonth: false })
    expect(weeks[0][4]).toEqual({ date: '2026-10-01', day: 1, inMonth: true })
    expect(weeks[4][6]).toEqual({ date: '2026-10-31', day: 31, inMonth: true })
  })

  it('마지막 날이 토요일이 아니면 다음 달 날짜로 마지막 주를 채운다', () => {
    const weeks = monthGrid('2026-11')
    const lastWeek = weeks[weeks.length - 1]

    expect(weeks[0][0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true })
    expect(lastWeek[1]).toEqual({ date: '2026-11-30', day: 30, inMonth: true })
    expect(lastWeek[6]).toEqual({ date: '2026-12-05', day: 5, inMonth: false })
  })

  it('달을 옮기면 해가 바뀐다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthLabel('2026-09')).toBe('2026년 9월')
  })

  it('이번 달·오늘은 한국 날짜다', () => {
    // UTC 10/31 16:00 = 한국 11/1 01:00
    const now = new Date('2026-10-31T16:00:00Z')
    expect(thisMonth(now)).toBe('2026-11')
    expect(today(now)).toBe('2026-11-01')
  })

  it('그날 가장 급한 상태는 경과 > 임박 > 정상이다', () => {
    expect(worstStatus(['NORMAL', 'IMMINENT'])).toBe('IMMINENT')
    expect(worstStatus(['IMMINENT', 'EXPIRED', 'NORMAL'])).toBe('EXPIRED')
    expect(worstStatus([])).toBe('NORMAL')
  })
})
