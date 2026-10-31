import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiErrorCode } from '@/shared/api/errors'
import { api } from '@/shared/api/client'
import type { OrderStatus } from './orderStatus'

/** 환불 상태 (order-service 추가 명세 0.2). 환불이 끝나기 전까지 주문은 결제 완료·준비 완료 그대로다 */
export type RefundStatus = 'NONE' | 'REQUESTED' | 'CHECKING' | 'FAILED' | 'COMPLETED'

/** 취소를 요청한 쪽 */
export type CancelRequester = 'CUSTOMER' | 'OWNER'

/** 취소 사유 코드 (추가 명세 A8). 고객·점주가 고를 수 있는 사유가 다르고, 기타는 둘 다 고를 수 있다 */
export type CancelReasonCode =
  | 'CHANGE_OF_MIND'
  | 'WRONG_SELECTION'
  | 'HARD_TO_VISIT'
  | 'OUT_OF_STOCK'
  | 'BAD_CONDITION'
  | 'STORE_ISSUE'
  | 'ETC'

export interface CancelReasonOption {
  code: CancelReasonCode
  label: string
}

/** 고객 취소 사유 (추가 명세 A8 고객) */
export const CUSTOMER_CANCEL_REASONS: CancelReasonOption[] = [
  { code: 'CHANGE_OF_MIND', label: '단순 변심' },
  { code: 'WRONG_SELECTION', label: '상품·수량 선택 실수' },
  { code: 'HARD_TO_VISIT', label: '방문 어려움' },
  { code: 'ETC', label: '기타' },
]

/** 점주 취소 사유 (추가 명세 A8 점주) */
export const OWNER_CANCEL_REASONS: CancelReasonOption[] = [
  { code: 'OUT_OF_STOCK', label: '실제 재고 부족' },
  { code: 'BAD_CONDITION', label: '상품 상태 불량' },
  { code: 'STORE_ISSUE', label: '매장 사정' },
  { code: 'ETC', label: '기타' },
]

/** 기타 상세 최대 길이 (order-service: 토스 cancelReason 최대 200자에 맞춤) */
export const CANCEL_DETAIL_MAX = 200

/**
 * 취소·환불 표시 (추가 명세 A8): 요청자·사유·환불금액·처리 상태·취소 요청 시각·취소 완료 시각.
 * 그 주문의 마지막 시도다. 시각은 +09:00, 완료 전이면 canceledAt 은 null
 */
export interface RefundInfo {
  requestedBy: CancelRequester
  reason: CancelReasonCode
  reasonLabel: string
  reasonDetail: string | null
  refundAmount: number
  status: Exclude<RefundStatus, 'NONE'>
  requestedAt: string
  canceledAt: string | null
}

/** 결제 후 취소 요청 본문. reasonDetail 은 기타일 때만 보낸다 */
export interface CancelOrderRequest {
  reason: CancelReasonCode
  reasonDetail?: string
}

/** 결제 후 취소 응답. 결과는 refundStatus 로 온다: COMPLETED(환불 완료) / FAILED(다시 신청 가능) / CHECKING(확인 중) */
export interface CancelOrderResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
  refundStatus: RefundStatus
  refund: RefundInfo | null
}

/** 환불 처리 상태 → 화면 문구. 금액 이름은 처리 중·실패·완료 모두 "환불금액"으로 통일한다(추가 명세 A8) */
export function refundStatusLabel(status: RefundStatus): string {
  switch (status) {
    case 'NONE':
      return '환불 없음'
    case 'REQUESTED':
      return '환불 처리 중'
    case 'CHECKING':
      return '환불 결과 확인 중'
    case 'FAILED':
      return '환불 실패'
    case 'COMPLETED':
      return '환불 완료'
  }
}

/** 처리 중·확인 중이면 주문 상세를 이어서 읽는다(서버가 결과를 확인하면 바뀐다) */
export function isRefundInProgress(status: RefundStatus | undefined): boolean {
  return status === 'REQUESTED' || status === 'CHECKING'
}

/** 결제 완료·준비 완료 주문 중 환불이 시작됐는지 (목록에서 픽업 대기 대신 환불 상태를 보여 준다) */
export function hasRefundStarted(status: RefundStatus | undefined): boolean {
  return status === 'REQUESTED' || status === 'CHECKING' || status === 'FAILED'
}

const CANCEL_ERROR_TEXT: Record<string, string> = {
  ORDER_NOT_CANCELABLE: '취소할 수 없는 주문이에요',
  REFUND_IN_PROGRESS: '이미 취소·환불을 처리하고 있어요',
  PICKUP_DEADLINE_PASSED: '픽업 기한이 지나 취소·환불할 수 없어요',
  ORDER_EXPIRED: '결제 시간이 지나 이미 취소된 주문이에요',
  ORDER_ACCESS_DENIED: '본인 주문만 취소할 수 있어요',
  STORE_ORDER_ACCESS_DENIED: '우리 점포 주문만 취소할 수 있어요',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요',
  VALIDATION_ERROR: '취소 사유를 다시 확인해 주세요',
}

/** 취소 요청 오류 → 화면 문구 (order-service 오류 code 기준) */
export function cancelErrorMessage(e: unknown): string {
  const code = apiErrorCode(e)
  return (code && CANCEL_ERROR_TEXT[code]) || '취소하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

/** 요청 본문: 기타일 때만 상세를 앞뒤 공백 빼고 싣는다 */
export function cancelBody(reason: CancelReasonCode, detail: string): CancelOrderRequest {
  return reason === 'ETC' ? { reason, reasonDetail: detail.trim() } : { reason }
}

/** A7 결제 전 취소 (POST /orders/{orderId}/payment/cancel). 사유 없이, 끝나면 주문을 다시 읽는다 */
export function useCancelBeforePayment(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => (await api.post(`/orders/${orderId}/payment/cancel`)).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', 'order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] }),
      ]),
  })
}

/** A8 고객 결제 후 취소 (POST /orders/{orderId}/cancel). 환불 실패 뒤 다시 신청할 때도 같은 주소다 */
export function useCancelOrder(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CancelOrderRequest) =>
      (await api.post<CancelOrderResponse>(`/orders/${orderId}/cancel`, body)).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer', 'order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] }),
      ]),
  })
}
