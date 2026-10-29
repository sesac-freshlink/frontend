import { describe, expect, it } from 'vitest'
import {
  confirmErrorMessage,
  customerMessage,
  isPollingStatus,
  ORDER_STATUSES,
  orderStatusLabel,
  paymentInterruptedMessage,
} from './orderStatus'

describe('customerMessage', () => {
  it('상태별 고객 문구 (order-service API 명세 7장)', () => {
    expect(customerMessage('RESERVING', null).title).toBe('주문을 확인하고 있어요')
    expect(customerMessage('PAYMENT_WAITING', null).title).toBe('결제 대기')
    expect(customerMessage('PAYMENT_APPROVING', null).title).toBe('결제 결과를 확인하고 있어요')
    expect(customerMessage('PAID', null).title).toBe('결제 완료')
    expect(customerMessage('PAYMENT_FAILED', 'PAYMENT_FAILED').title).toBe('결제에 실패했어요')
    expect(customerMessage('EXPIRED', 'EXPIRED').title).toBe('결제 시간이 지나 주문이 취소됐어요')
  })

  it('픽업 상태 문구 (A4·A5, API 명세 7장)', () => {
    expect(customerMessage('PICKED_UP', null)).toEqual({ title: '픽업 완료', tone: 'pickedUp' })
    expect(customerMessage('PICKUP_EXPIRED', null)).toEqual({
      title: '픽업 기한이 지났어요',
      tone: 'failed',
    })
    expect(customerMessage('EXPIRED', 'PICKUP_DEADLINE')).toEqual({
      title: '픽업 기한이 지나 주문이 취소됐어요',
      tone: 'failed',
    })
  })

  it('재고 확보 실패는 사유별로 다르게', () => {
    expect(customerMessage('OUT_OF_STOCK', 'OUT_OF_STOCK').title).toBe(
      '재고가 부족해 주문이 취소됐어요.',
    )
    expect(customerMessage('OUT_OF_STOCK', 'PRODUCT_NOT_FOUND').title).toBe(
      '상품을 찾을 수 없어 주문이 취소됐어요.',
    )
    expect(customerMessage('OUT_OF_STOCK', 'INVALID_QUANTITY').title).toBe(
      '주문 수량이 올바르지 않아 주문이 취소됐어요.',
    )
    expect(customerMessage('OUT_OF_STOCK', null).title).toBe('재고가 부족해 주문이 취소됐어요.')
  })

  it('고객 문구에 "예약"이 없다', () => {
    for (const status of ORDER_STATUSES) {
      const { title, tone } = customerMessage(status, null)
      expect(title).not.toContain('예약')
      expect(tone).toBeTruthy()
    }
  })

  it('끝난 실패 상태만 상품으로 돌아가기를 보여 준다', () => {
    expect(customerMessage('OUT_OF_STOCK', 'OUT_OF_STOCK').tone).toBe('failed')
    expect(customerMessage('PAYMENT_FAILED', null).tone).toBe('failed')
    expect(customerMessage('EXPIRED', null).tone).toBe('failed')
    expect(customerMessage('PAID', null).tone).toBe('done')
    expect(customerMessage('RESERVING', null).tone).toBe('loading')
  })
})

describe('isPollingStatus', () => {
  it('진행 중 상태에서만 2초 폴링을 이어 간다', () => {
    expect(isPollingStatus('RESERVING')).toBe(true)
    expect(isPollingStatus('PAYMENT_WAITING')).toBe(true)
    expect(isPollingStatus('PAYMENT_APPROVING')).toBe(true)
    expect(isPollingStatus('PAID')).toBe(false)
    expect(isPollingStatus('OUT_OF_STOCK')).toBe(false)
    expect(isPollingStatus('PAYMENT_FAILED')).toBe(false)
    expect(isPollingStatus('EXPIRED')).toBe(false)
    expect(isPollingStatus('PICKED_UP')).toBe(false)
    expect(isPollingStatus('PICKUP_EXPIRED')).toBe(false)
    expect(isPollingStatus(undefined)).toBe(true)
  })
})

describe('결제 중단·승인 오류 문구', () => {
  it('결제창을 닫고 돌아오면 자동 취소 시각을 알려 준다', () => {
    expect(paymentInterruptedMessage('15:42')).toBe(
      '결제가 완료되지 않았어요. 이 주문은 15:42에 자동 취소됩니다.',
    )
  })

  it('승인 오류 code 별 문구, 모르는 code 는 기본 문구', () => {
    expect(confirmErrorMessage('ORDER_EXPIRED')).toBe('결제 시간이 지나 주문이 취소됐어요')
    expect(confirmErrorMessage('PICKUP_DEADLINE_PASSED')).toBe('픽업 기한이 지나 주문이 취소됐어요')
    expect(confirmErrorMessage('PAYMENT_AMOUNT_MISMATCH')).toBe(
      '결제 정보가 주문과 맞지 않아요. 다시 결제해 주세요.',
    )
    expect(confirmErrorMessage(undefined)).toBe(
      '결제 결과를 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.',
    )
  })
})

describe('orderStatusLabel', () => {
  it('목록용 짧은 상태 이름 (A3·A6)', () => {
    expect(orderStatusLabel('RESERVING', null)).toBe('주문 확인 중')
    expect(orderStatusLabel('PAYMENT_WAITING', null)).toBe('결제 대기')
    expect(orderStatusLabel('PAYMENT_APPROVING', null)).toBe('결제 확인 중')
    expect(orderStatusLabel('PAID', null)).toBe('픽업 대기')
    expect(orderStatusLabel('PICKED_UP', null)).toBe('픽업 완료')
    expect(orderStatusLabel('PICKUP_EXPIRED', null)).toBe('픽업 기한 지남')
    expect(orderStatusLabel('OUT_OF_STOCK', 'OUT_OF_STOCK')).toBe('재고 부족 취소')
    expect(orderStatusLabel('PAYMENT_FAILED', 'PAYMENT_FAILED')).toBe('결제 실패')
  })

  it('결제 전 만료는 종료 사유로 결제 시간·픽업 기한을 나눈다', () => {
    expect(orderStatusLabel('EXPIRED', 'EXPIRED')).toBe('결제 시간 지나 취소')
    expect(orderStatusLabel('EXPIRED', null)).toBe('결제 시간 지나 취소')
    expect(orderStatusLabel('EXPIRED', 'PICKUP_DEADLINE')).toBe('픽업 기한 지나 취소')
  })

  it('어느 상태에도 "예약"을 쓰지 않는다', () => {
    for (const s of ORDER_STATUSES) {
      expect(orderStatusLabel(s, null)).not.toContain('예약')
      expect(orderStatusLabel(s, 'PICKUP_DEADLINE')).not.toContain('예약')
    }
  })
})
