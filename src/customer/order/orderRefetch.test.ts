import { describe, expect, it } from 'vitest'
import { POLL_MS } from '@/shared/api/queryClient'
import { orderRefetchMs } from './api'

describe('고객 주문 상세 다시 읽기 간격 (11/14 경우 결정 R3)', () => {
  it('결제 진행 중·환불 처리 중에는 2초', () => {
    expect(orderRefetchMs(undefined)).toBe(POLL_MS.orderDetail)
    expect(orderRefetchMs({ status: 'PAYMENT_WAITING', refundStatus: 'NONE' })).toBe(2_000)
    expect(orderRefetchMs({ status: 'CANCELED', refundStatus: 'REQUESTED' })).toBe(2_000)
  })

  it('결제 완료·픽업 신청 상태에서는 준비 완료가 될 때까지 5초', () => {
    expect(orderRefetchMs({ status: 'PAID', refundStatus: 'NONE' })).toBe(5_000)
    expect(orderRefetchMs({ status: 'PICKUP_REQUESTED', refundStatus: 'NONE' })).toBe(5_000)
  })

  it('준비 완료·픽업 완료·취소 뒤에는 멈춘다', () => {
    expect(orderRefetchMs({ status: 'READY_FOR_PICKUP', refundStatus: 'NONE' })).toBe(false)
    expect(orderRefetchMs({ status: 'PICKED_UP', refundStatus: 'NONE' })).toBe(false)
    expect(orderRefetchMs({ status: 'CANCELED', refundStatus: 'NONE' })).toBe(false)
  })
})
