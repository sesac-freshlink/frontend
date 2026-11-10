import { MAX_PICKUP_APPROVE, type PickupPassOrder } from './api'

/** 고를 수 있는 주문(픽업 준비 완료)만 켜고 끈다. 20건을 넘게는 고르지 않는다 */
export function toggleSelection(
  selected: readonly number[],
  order: Pick<PickupPassOrder, 'orderId' | 'selectable'>,
): number[] {
  if (!order.selectable) return [...selected]
  if (selected.includes(order.orderId)) return selected.filter((id) => id !== order.orderId)
  if (selected.length >= MAX_PICKUP_APPROVE) return [...selected]
  return [...selected, order.orderId]
}
