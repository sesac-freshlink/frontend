import { describe, expect, it } from 'vitest'
import { parseScanToken } from './api'
import { toggleSelection } from './pickupSelection'

describe('픽업 승인 고르기 (A16)', () => {
  it('준비 완료만 켜고 끈다', () => {
    expect(toggleSelection([], { orderId: 1, selectable: true })).toEqual([1])
    expect(toggleSelection([1], { orderId: 1, selectable: true })).toEqual([])
    expect(toggleSelection([], { orderId: 2, selectable: false })).toEqual([])
  })

  it('20건을 넘게는 고르지 않는다', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(toggleSelection(twenty, { orderId: 99, selectable: true })).toHaveLength(20)
  })
})

describe('pickup-scan 이벤트', () => {
  it('data 에서 표를 꺼내고, 모양이 다르면 null', () => {
    expect(parseScanToken('{"token":"abc"}')).toBe('abc')
    expect(parseScanToken('{"token":""}')).toBeNull()
    expect(parseScanToken('{}')).toBeNull()
    expect(parseScanToken('not json')).toBeNull()
  })
})
