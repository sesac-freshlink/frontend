import { describe, expect, it } from 'vitest'
import { isReversedPeriod, periodParams } from './period'

describe('isReversedPeriod', () => {
  it('둘 다 있고 시작이 끝보다 늦을 때만 true', () => {
    expect(isReversedPeriod({ from: '2026-10-21', to: '2026-10-20' })).toBe(true)
    expect(isReversedPeriod({ from: '2026-10-20', to: '2026-10-20' })).toBe(false)
    expect(isReversedPeriod({ from: '2026-09-30', to: '2026-10-01' })).toBe(false)
    expect(isReversedPeriod({ from: '2026-10-21', to: '' })).toBe(false)
    expect(isReversedPeriod({ from: '', to: '2026-10-20' })).toBe(false)
  })
})

describe('periodParams', () => {
  it('빈 쪽은 빼고 넣는다', () => {
    expect(periodParams({ from: '', to: '' })).toEqual({})
    expect(periodParams({ from: '2026-10-01', to: '' })).toEqual({ from: '2026-10-01' })
    expect(periodParams({ from: '', to: '2026-10-31' })).toEqual({ to: '2026-10-31' })
    expect(periodParams({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })
})
