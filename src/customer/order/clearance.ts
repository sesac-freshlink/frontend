import type { Order, OrderLine } from './api'
import { formatWon } from './format'

/** 마감세일이 섞인 주문의 픽업 안내 (결제 대기·주문 상세) */
export const SAME_DAY_PICKUP_NOTICE =
  '오늘 23:59까지 픽업해 주세요. 지나면 받아 갈 수 없고 환불되지 않아요'

/** "마감세일 1개 3,490원" / "기본 2개 4,990원" */
export function lineText(line: Pick<OrderLine, 'clearance' | 'quantity' | 'unitPrice'>): string {
  return `${line.clearance ? '마감세일' : '기본'} ${line.quantity}개 ${formatWon(line.unitPrice)}`
}

/** 목록 한 줄의 수량: 마감세일이 섞이면 "2개 (마감세일 1 + 기본 1)" */
export function quantityText(order: { quantity: number; clearanceQuantity?: number }): string {
  const clearance = order.clearanceQuantity ?? 0
  if (clearance <= 0) return `${order.quantity}개`
  return `${order.quantity}개 (마감세일 ${clearance} + 기본 ${order.quantity - clearance})`
}

/** 마감세일이 섞인 주문은 당일 픽업이다 */
export function isSameDayPickup(order: { clearanceQuantity?: number }): boolean {
  return (order.clearanceQuantity ?? 0) > 0
}

/**
 * 재고가 모자라 끝난 주문에서 어느 쪽이 모자란지 알려 주는 문구. 마감세일 없는 주문이면 null(기존 문구를 쓴다).
 * 남은 수는 서버가 RESERVE_FAILED 로 받은 값이다(없으면 모르는 것)
 */
export function shortageMessage(
  order: Pick<
    Order,
    | 'quantity'
    | 'clearanceQuantity'
    | 'availableQuantity'
    | 'clearanceAvailableQuantity'
    | 'failureReason'
  >,
): string | null {
  const clearance = order.clearanceQuantity ?? 0
  if (clearance <= 0) return null
  const parts: string[] = []
  const clearanceLeft = order.clearanceAvailableQuantity
  if (order.failureReason === 'CLEARANCE_SOLD_OUT') {
    parts.push(
      clearanceLeft == null || clearanceLeft <= 0
        ? '마감세일이 끝났어요.'
        : `마감세일 상품이 ${clearanceLeft}개만 남았어요.`,
    )
  }
  // 기본이 모자랐거나, 마감세일이 끝났을 때 기본으로 살 수 있는지 같이 알려 준다
  const regularLeft = order.availableQuantity
  const regularShort = regularLeft != null && regularLeft < order.quantity - clearance
  if (regularLeft != null && (regularShort || order.failureReason === 'CLEARANCE_SOLD_OUT')) {
    parts.push(`기본 상품은 ${regularLeft}개 남았어요.`)
  }
  if (parts.length === 0) return null
  return `${parts.join(' ')} 다시 골라 주세요.`
}
