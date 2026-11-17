import { describe, expect, it } from 'vitest'
import { hourLabel, parseDiscountPercent, validSaleHours } from './clearanceSetting'

describe('parseDiscountPercent', () => {
  it('1~95 정수만 받는다', () => {
    expect(parseDiscountPercent('30')).toBe(30)
    expect(parseDiscountPercent(' 95 ')).toBe(95)
    expect(parseDiscountPercent('1')).toBe(1)
    expect(parseDiscountPercent('0')).toBeNull()
    expect(parseDiscountPercent('96')).toBeNull()
    expect(parseDiscountPercent('12.5')).toBeNull()
    expect(parseDiscountPercent('')).toBeNull()
  })
})

describe('validSaleHours', () => {
  it('시작이 끝보다 빨라야 한다', () => {
    expect(validSaleHours(6, 23)).toBe(true)
    expect(validSaleHours(0, 24)).toBe(true)
    expect(validSaleHours(12, 12)).toBe(false)
    expect(validSaleHours(20, 8)).toBe(false)
  })
})

describe('hourLabel', () => {
  it('두 자리 시로 쓴다', () => {
    expect(hourLabel(6)).toBe('06시')
    expect(hourLabel(24)).toBe('24시')
  })
})
