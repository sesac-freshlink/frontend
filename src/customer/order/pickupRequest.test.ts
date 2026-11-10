import { describe, expect, it } from 'vitest'
import { canRequestPickup } from './pickupRequest'

const NOW = Date.parse('2026-11-10T12:00:00+09:00')
const paid = {
  status: 'PAID' as const,
  refundStatus: 'NONE' as const,
  pickupDeadline: '2026-11-12T23:59:59+09:00',
}

describe('canRequestPickup', () => {
  it('결제 완료·환불 없음·기한 이내만 신청할 수 있다', () => {
    expect(canRequestPickup(paid, NOW)).toBe(true)
    expect(canRequestPickup({ ...paid, pickupDeadline: null }, NOW)).toBe(true)
  })

  it('신청됨·준비 완료·환불 시작·기한 경과는 신청할 수 없다', () => {
    expect(canRequestPickup({ ...paid, status: 'PICKUP_REQUESTED' }, NOW)).toBe(false)
    expect(canRequestPickup({ ...paid, status: 'READY_FOR_PICKUP' }, NOW)).toBe(false)
    expect(canRequestPickup({ ...paid, refundStatus: 'FAILED' }, NOW)).toBe(false)
    expect(canRequestPickup({ ...paid, pickupDeadline: '2026-11-10T11:59:59+09:00' }, NOW)).toBe(
      false,
    )
  })
})
