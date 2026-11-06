import type { StoreProductDetail } from '@/customer/stores/api'
import type { Order, OrderLine } from './api'
import type { CheckoutItem } from './checkout'
import { MAX_QUANTITY } from './checkout'
import { formatWon } from './format'

/** 마감세일이 섞인 주문의 픽업 안내 (결제 화면·주문 상세) */
export const SAME_DAY_PICKUP_NOTICE =
  '오늘 23:59까지 픽업해 주세요. 지나면 받아 갈 수 없고 환불되지 않아요'

/**
 * 주문 화면이 쓸 값: 고른 수량은 시트 주소에서, 가격·남은 수는 상품 API에서 읽은 최신 값으로 덮는다.
 * 상품을 못 읽으면 주소 값을 그대로 쓴다
 */
export function withLatestProduct(
  item: CheckoutItem,
  product: StoreProductDetail | undefined,
): CheckoutItem {
  if (!product) return item
  const clearanceAvailable = product.clearanceQuantity ?? 0
  return {
    ...item,
    price: product.price,
    available: product.availableQuantity,
    clearanceAvailable,
    ...(product.clearancePrice != null && clearanceAvailable > 0
      ? { clearancePrice: product.clearancePrice }
      : { clearancePrice: undefined }),
  }
}

/** 시트에서 마감세일을 골라 왔는데 지금 마감세일 재고가 없다 (그새 다 팔렸거나 판매 시간이 끝났다) */
export function clearanceEndedSinceSheet(item: CheckoutItem): boolean {
  return (item.clearanceQuantity ?? 0) > 0 && !hasClearance(item)
}

/** 시트에서 고른 마감세일 수가 지금 남은 수보다 많아 줄여야 하면 남은 수, 아니면 null */
export function clearanceReducedTo(item: CheckoutItem): number | null {
  const wanted = item.clearanceQuantity ?? 0
  const left = item.clearanceAvailable ?? 0
  return hasClearance(item) && wanted > left ? left : null
}

/** 주문 화면의 두 줄 수량 (마감세일·기본) */
export interface LineQuantities {
  clearance: number
  regular: number
}

/**
 * 주문 화면에 마감세일 줄을 보여 줄지. 시트가 마감세일 단가와 남은 수를 넘겨야 하고, 선착순 상품은 마감세일이 없다.
 * 값이 없으면 지금처럼 수량 한 줄로 동작한다
 */
export function hasClearance(item: CheckoutItem): boolean {
  return (
    !item.firstCome &&
    item.clearancePrice !== undefined &&
    item.clearanceAvailable !== undefined &&
    item.clearanceAvailable > 0
  )
}

/** 줄마다 올릴 수 있는 최대: 그 줄 남은 수, 그리고 두 줄 합계 5개 */
export function lineMax(item: CheckoutItem, q: LineQuantities): LineQuantities {
  const regularAvailable = item.available ?? MAX_QUANTITY
  return {
    clearance: Math.max(0, Math.min(item.clearanceAvailable ?? 0, MAX_QUANTITY - q.regular)),
    regular: Math.max(0, Math.min(regularAvailable, MAX_QUANTITY - q.clearance)),
  }
}

/** 한 줄을 바꾼다. 0 아래·상한 위로는 가지 않는다 */
export function changeLine(
  item: CheckoutItem,
  q: LineQuantities,
  line: keyof LineQuantities,
  next: number,
): LineQuantities {
  const max = lineMax(item, q)[line]
  return { ...q, [line]: Math.max(0, Math.min(next, max)) }
}

/** 두 줄 합계가 1~5개여야 결제할 수 있다 */
export function canCheckout(q: LineQuantities): boolean {
  const total = q.clearance + q.regular
  return total >= 1 && total <= MAX_QUANTITY
}

/**
 * 처음 수량: 시트가 넘긴 마감세일 수량과 전체 수량. 전체가 없으면 마감세일만 산 것으로 보고, 둘 다 없으면 마감세일 1개
 */
export function initialLines(item: CheckoutItem): LineQuantities {
  const start: LineQuantities = { clearance: 0, regular: 0 }
  // 시트가 고른 기본 수량은 전체 − 마감세일. 마감세일이 남은 수보다 많으면 마감세일만 줄이고 기본은 그대로 둔다
  const clearanceWanted = item.clearanceQuantity ?? (item.quantity === undefined ? 1 : 0)
  const regularWanted = Math.max(0, (item.quantity ?? clearanceWanted) - clearanceWanted)
  const withClearance = changeLine(item, start, 'clearance', clearanceWanted)
  const lines = changeLine(item, withClearance, 'regular', regularWanted)
  return canCheckout(lines) ? lines : changeLine(item, lines, 'clearance', 1)
}

/** 표시용 합계 (마감세일가 × 마감세일 + 정가 × 기본). 실제 금액은 서버가 정한다 */
export function linesTotal(item: CheckoutItem, q: LineQuantities): number {
  return (item.clearancePrice ?? 0) * q.clearance + item.price * q.regular
}

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
