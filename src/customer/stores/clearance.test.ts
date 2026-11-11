import { describe, expect, it } from 'vitest'
import {
  canDecrease,
  canIncrease,
  clearanceOf,
  initialSelection,
  selectionAmount,
} from './clearance'

const product = {
  price: 1500,
  availableQuantity: 3,
  firstCome: false,
  clearanceQuantity: 2,
  clearancePrice: 1050,
}

describe('clearanceOf', () => {
  it('마감세일 수량과 단가를 준다', () => {
    expect(clearanceOf(product)).toEqual({ quantity: 2, price: 1050 })
  })

  it('수량이 0이거나 선착순이거나 서버가 아직 주지 않으면 없다', () => {
    expect(clearanceOf({ ...product, clearanceQuantity: 0, clearancePrice: null })).toBeNull()
    expect(clearanceOf({ ...product, firstCome: true })).toBeNull()
    expect(clearanceOf({ availableQuantity: 3, firstCome: false })).toBeNull()
  })
})

describe('구매 시트 수량', () => {
  it('처음에는 마감세일 1개를 고른다. 마감세일이 없으면 기본 1개', () => {
    expect(initialSelection(product)).toEqual({ normal: 0, clearance: 1 })
    expect(initialSelection({ ...product, clearanceQuantity: 0 })).toEqual({
      normal: 1,
      clearance: 0,
    })
  })

  it('줄마다 남은 수량까지, 두 줄 합계는 5개까지 고른다', () => {
    expect(canIncrease(product, { normal: 0, clearance: 2 }, 'clearance')).toBe(false)
    expect(canIncrease(product, { normal: 0, clearance: 2 }, 'normal')).toBe(true)
    const many = { ...product, availableQuantity: 10, clearanceQuantity: 10 }
    expect(canIncrease(many, { normal: 3, clearance: 2 }, 'normal')).toBe(false)
    expect(canIncrease(many, { normal: 2, clearance: 2 }, 'clearance')).toBe(true)
  })

  it('한 줄만 사도 되지만 합계가 0이 되게 빼지는 못한다', () => {
    expect(canDecrease({ normal: 1, clearance: 1 }, 'clearance')).toBe(true)
    expect(canDecrease({ normal: 0, clearance: 1 }, 'clearance')).toBe(false)
    expect(canDecrease({ normal: 0, clearance: 2 }, 'normal')).toBe(false)
  })

  it('합계 금액은 기본 정가와 마감세일 단가를 더한다', () => {
    expect(selectionAmount(product, { normal: 2, clearance: 1 })).toBe(1500 * 2 + 1050)
  })
})
