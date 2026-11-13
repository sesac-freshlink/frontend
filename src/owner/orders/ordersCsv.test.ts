import { describe, expect, it } from 'vitest'
import type { OwnerOrder } from './api'
import { ordersToCsv } from './ordersCsv'

const order = {
  orderId: 1,
  orderNo: 'FL-1',
  status: 'PAID',
  productName: '김밥, "참치"',
  quantity: 2,
  amount: 3000,
  paidAt: '2026-11-12T10:00:00+09:00',
  pickupDeadline: null,
  pickedUpAt: null,
  payment: { method: '카드', approvedAt: null, status: 'DONE', receiptUrl: null },
  refundStatus: 'NONE',
  cancelRequestedAt: null,
  refund: null,
} as unknown as OwnerOrder

describe('ordersToCsv', () => {
  it('머리줄과 주문 줄을 만들고, 쉼표·따옴표가 든 칸은 따옴표로 감싼다', () => {
    const lines = ordersToCsv([order]).replace('﻿', '').split('\n')
    expect(lines[0]).toBe('주문번호,상품,수량,금액,결제 수단,결제 시각,픽업 기한,픽업 시각')
    expect(lines[1]).toBe('FL-1,"김밥, ""참치""",2,3000,카드,2026-11-12T10:00:00+09:00,,')
  })
})
