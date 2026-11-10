import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiErrorCode } from '@/shared/api/errors'
import { api } from '@/shared/api/client'
import type { Order } from './api'
import type { OrderStatus } from './orderStatus'
import type { RefundStatus } from './refund'

/** 픽업 신청 확인 창 문구. 신청하면 기한이 신청한 날 23:59로 당겨진다 (order-service Order.requestPickup) */
export const PICKUP_REQUEST_CONFIRM = '오늘 23:59까지 받아 가셔야 해요'

/** 결제 화면·결제 완료 화면의 기한 안내. 신청하지 않거나 받아 가지 않으면 기한이 지나 환불되지 않는다 */
export const PICKUP_REQUEST_NOTICE =
  '픽업 신청을 하고 기한 안에 받아 가세요. 신청하지 않거나 받아 가지 않으면 환불되지 않아요'

/**
 * [픽업 신청]을 보여 줄 주문: 결제 완료·환불 없음·기한 이내 (서버 시각 기준).
 * 서버도 요청 때 다시 확인한다
 */
export function canRequestPickup(
  order: { status: OrderStatus; refundStatus: RefundStatus; pickupDeadline: string | null },
  nowMs: number,
): boolean {
  return (
    order.status === 'PAID' &&
    order.refundStatus === 'NONE' &&
    (order.pickupDeadline === null || nowMs <= Date.parse(order.pickupDeadline))
  )
}

const ERROR_TEXT: Record<string, string> = {
  ORDER_NOT_PICKUP_REQUESTABLE: '픽업 신청할 수 없는 주문이에요.',
  PICKUP_DEADLINE_PASSED: '픽업 기한이 지나 신청할 수 없어요.',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요.',
}

export function pickupRequestErrorMessage(e: unknown): string {
  const code = apiErrorCode(e)
  return (code && ERROR_TEXT[code]) || '픽업 신청을 하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

/** 픽업 신청 (POST /orders/{orderId}/pickup-request). 끝나면 주문·주문 내역을 다시 읽는다 */
export function usePickupRequest(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post<Order>(`/orders/${orderId}/pickup-request`)).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', 'order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] }),
      ]),
  })
}
