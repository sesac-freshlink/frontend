import { describe, expect, it } from 'vitest'
import type { ClearanceSettingItem } from './api'
import {
  clearanceSortValue,
  filterClearanceSettings,
  hourLabel,
  NO_CLEARANCE_FILTERS,
  parseDiscountPercent,
  stepDiscount,
  validSaleHours,
} from './clearanceSetting'

const item = (over: Partial<ClearanceSettingItem>): ClearanceSettingItem => ({
  category: '김밥',
  enabled: true,
  discountPercent: 30,
  saleStartHour: 6,
  saleEndHour: 23,
  customized: false,
  ...over,
})

describe('parseDiscountPercent', () => {
  it('10~90 정수만 받는다', () => {
    expect(parseDiscountPercent('30')).toBe(30)
    expect(parseDiscountPercent(' 90 ')).toBe(90)
    expect(parseDiscountPercent('10')).toBe(10)
    expect(parseDiscountPercent('9')).toBeNull()
    expect(parseDiscountPercent('91')).toBeNull()
    expect(parseDiscountPercent('12.5')).toBeNull()
    expect(parseDiscountPercent('')).toBeNull()
  })
})

describe('stepDiscount', () => {
  it('10% 단위 칸으로 움직이고 10~90에서 멈춘다', () => {
    expect(stepDiscount(30, 1)).toBe(40)
    expect(stepDiscount(30, -1)).toBe(20)
    expect(stepDiscount(35, 1)).toBe(40)
    expect(stepDiscount(35, -1)).toBe(30)
    expect(stepDiscount(90, 1)).toBe(90)
    expect(stepDiscount(10, -1)).toBe(10)
    expect(stepDiscount(null, 1)).toBe(40)
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

describe('filterClearanceSettings', () => {
  const items = [
    item({ category: '김밥' }),
    item({ category: '삼각김밥', enabled: false, discountPercent: 50, customized: true }),
    item({ category: '도시락', discountPercent: 40, customized: true }),
  ]

  it('카테고리 이름 일부로 찾는다', () => {
    expect(
      filterClearanceSettings(items, { ...NO_CLEARANCE_FILTERS, q: ' 김밥 ' }).map(
        (i) => i.category,
      ),
    ).toEqual(['김밥', '삼각김밥'])
  })

  it('적용 중, 할인율 바꿈을 각각 또는 같이 거른다', () => {
    const names = (f: Partial<typeof NO_CLEARANCE_FILTERS>) =>
      filterClearanceSettings(items, { ...NO_CLEARANCE_FILTERS, ...f }).map((i) => i.category)
    expect(names({ enabledOnly: true })).toEqual(['김밥', '도시락'])
    expect(names({ changedOnly: true })).toEqual(['삼각김밥', '도시락'])
    expect(names({ enabledOnly: true, changedOnly: true })).toEqual(['도시락'])
  })
})

describe('clearanceSortValue', () => {
  it('판매 시간은 시작 시, 같으면 끝 시 순이다', () => {
    const a = clearanceSortValue(item({ saleStartHour: 6, saleEndHour: 23 }), 'hours')
    const b = clearanceSortValue(item({ saleStartHour: 6, saleEndHour: 24 }), 'hours')
    const c = clearanceSortValue(item({ saleStartHour: 8, saleEndHour: 9 }), 'hours')
    expect(a < b && b < c).toBe(true)
  })
})
