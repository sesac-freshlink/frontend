import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorCode } from '@/auth/api'
import type { OrderPage, OrderPageSize, OrderPayment } from '@/customer/order/api'
import type { OrderStatus } from '@/customer/order/orderStatus'
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  RefundInfo,
  RefundStatus,
} from '@/customer/order/refund'
import { api } from '@/shared/api/client'
import { type DatePeriod, isReversedPeriod, periodParams } from '@/shared/api/period'

/**
 * OR-04·A6 응답 한 줄. payment 는 OR-02 와 같은 모양, pickupDeadline 은 그날 23:59:59 (A4).
 * status·pickedUpAt 은 A6 에서 더해졌다 (pickedUpAt 은 픽업 완료 주문만 값이 있다)
 */
export interface OwnerOrder {
  orderId: number
  orderNo: string
  status: OrderStatus
  productName: string
  quantity: number
  amount: number
  paidAt: string
  pickupDeadline: string | null
  pickedUpAt: string | null
  payment: OrderPayment | null
  /** A8·A9 환불 상태. 취소·환불 구분과 [환불 재시도]에서 쓴다 */
  refundStatus: RefundStatus
  /** 마지막 취소 요청 시각 (취소·환불 구분 정렬 기준). 요청이 없으면 null */
  cancelRequestedAt: string | null
  /** 마지막 환불 시도. 없으면 null */
  refund: RefundInfo | null
}

/** A6 점주 주문 목록 구분 */
export type OwnerOrderTab = 'PICKUP_WAITING' | 'PICKED_UP' | 'CANCELED' | 'PICKUP_EXPIRED'

/** OR-05 응답 */
export interface PickupResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
  pickedUpAt: string
}

/** A6 점주 주문 목록 조회 조건. period 는 주문일 기준 (빈 쪽은 보내지 않는다) */
export interface OwnerOrdersQuery {
  tab: OwnerOrderTab
  /** 0부터 */
  page: number
  size: OrderPageSize
  period: DatePeriod
}

const ownerOrdersKey = ['owner', 'orders']

/**
 * S-50·A6 점주 주문 목록 (order-service OR-04 + tab·page·size·from·to). 자기 점포 주문을 구분별로 페이지 응답으로 받는다.
 * 점포는 gateway 가 붙이는 X-Store-Id 로 정해진다. 진입·구분 전환·[새로 고침] 때만 부른다 (폴링 없음).
 * 시작 날짜가 끝 날짜보다 늦으면 서버가 400 을 주므로 부르지 않는다
 */
export function useOwnerOrders({ tab, page, size, period }: OwnerOrdersQuery) {
  const range = periodParams(period)
  return useQuery({
    queryKey: [...ownerOrdersKey, tab, page, size, range],
    queryFn: async () =>
      (
        await api.get<OrderPage<OwnerOrder>>('/owner/orders', {
          params: { tab, page, size, ...range },
        })
      ).data,
    enabled: !isReversedPeriod(period),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

/**
 * A5 픽업 확인 (order-service OR-05). 성공·실패 모두 모든 구분의 목록을 다시 읽는다.
 * 픽업한 주문은 픽업 대기에서 빠져 픽업 완료로 가고, 이미 처리된 주문(409)도 최신 상태로 맞춰진다
 */
export function usePickUpOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post<PickupResponse>(`/owner/orders/${orderId}/pickup`)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerOrdersKey }),
  })
}

/** N-02 픽업 준비 완료 응답 (OR-05 와 같은 모양, pickedUpAt 은 null) */
export type ReadyResponse = Omit<PickupResponse, 'pickedUpAt'> & { pickedUpAt: null }

/**
 * N-02 픽업 준비 완료 (order-service POST /owner/orders/{orderId}/ready). 고객에게 픽업 준비 완료 알림이 간다.
 * 성공·실패 모두 목록을 다시 읽는다 (준비 완료가 되면 같은 줄의 버튼이 [픽업 확인]으로 바뀐다)
 */
export function useMarkReadyForPickup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post<ReadyResponse>(`/owner/orders/${orderId}/ready`)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerOrdersKey }),
  })
}

const READY_ERROR_TEXT: Record<string, string> = {
  ORDER_NOT_READYABLE: '이미 픽업했거나 준비 완료로 바꿀 수 없는 주문이에요',
  PICKUP_DEADLINE_PASSED: '픽업 기한이 지난 주문이에요',
  STORE_ORDER_ACCESS_DENIED: '우리 점포 주문만 처리할 수 있어요',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요',
}

/** 픽업 준비 완료 오류를 점주 화면 문구로 */
export function readyErrorMessage(e: unknown): string {
  const code = apiErrorCode(e)
  return (
    (code && READY_ERROR_TEXT[code]) || '준비 완료 처리에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
  )
}

const PICKUP_ERROR_TEXT: Record<string, string> = {
  ORDER_NOT_PICKABLE: '픽업 준비 완료를 먼저 누르거나, 이미 픽업한 주문이에요',
  PICKUP_DEADLINE_PASSED: '픽업 기한이 지난 주문이에요',
  STORE_ORDER_ACCESS_DENIED: '우리 점포 주문만 처리할 수 있어요',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요',
}

/** OR-05 오류를 점주 화면 문구로 (order-service API 명세 OR-05 표) */
export function pickupErrorMessage(e: unknown): string {
  const code = apiErrorCode(e)
  return (code && PICKUP_ERROR_TEXT[code]) || '픽업 처리에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
}

/**
 * A8 점주 결제 후 취소 (order-service POST /owner/orders/{orderId}/cancel). 환불 실패 뒤 [환불 재시도]도 같은 주소다.
 * 성공·실패 모두 목록을 다시 읽는다 (취소한 주문은 픽업 대기에서 취소·환불 구분으로 옮겨 간다)
 */
export function useOwnerCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, body }: { orderId: number; body: CancelOrderRequest }) =>
      (await api.post<CancelOrderResponse>(`/owner/orders/${orderId}/cancel`, body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerOrdersKey }),
  })
}
