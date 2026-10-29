import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorCode } from '@/auth/api'
import type { OrderPayment } from '@/customer/order/api'
import type { OrderStatus } from '@/customer/order/orderStatus'
import { api } from '@/shared/api/client'

/** OR-04 응답 한 줄 (결제 완료 주문). payment 는 OR-02 와 같은 모양, pickupDeadline 은 그날 23:59:59 (A4) */
export interface OwnerOrder {
  orderId: number
  orderNo: string
  productName: string
  quantity: number
  amount: number
  paidAt: string
  pickupDeadline: string | null
  payment: OrderPayment | null
}

/** OR-05 응답 */
export interface PickupResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
  pickedUpAt: string
}

const ownerOrdersKey = ['owner', 'orders']

/**
 * S-50 신규 주문 목록 (order-service OR-04). 자기 점포의 결제 완료 주문만, 결제 시각 최신순.
 * 점포는 gateway 가 붙이는 X-Store-Id 로 정해진다. 화면에 들어올 때와 [새로 고침] 때만 부른다 (폴링 없음)
 */
export function useOwnerOrders() {
  return useQuery({
    queryKey: ownerOrdersKey,
    queryFn: async () => (await api.get<OwnerOrder[]>('/owner/orders')).data,
    refetchOnWindowFocus: false,
  })
}

/**
 * A5 픽업 확인 (order-service OR-05). 성공·실패 모두 목록을 다시 읽는다.
 * 목록은 결제 완료 주문만이라 픽업한 주문은 빠지고, 이미 처리된 주문(409)도 최신 상태로 맞춰진다
 */
export function usePickUpOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post<PickupResponse>(`/owner/orders/${orderId}/pickup`)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerOrdersKey }),
  })
}

const PICKUP_ERROR_TEXT: Record<string, string> = {
  ORDER_NOT_PICKABLE: '이미 픽업했거나 처리할 수 없는 주문이에요',
  PICKUP_DEADLINE_PASSED: '픽업 기한이 지난 주문이에요',
  STORE_ORDER_ACCESS_DENIED: '우리 점포 주문만 처리할 수 있어요',
  ORDER_NOT_FOUND: '주문을 찾을 수 없어요',
}

/** OR-05 오류를 점주 화면 문구로 (order-service API 명세 OR-05 표) */
export function pickupErrorMessage(e: unknown): string {
  const code = apiErrorCode(e)
  return (code && PICKUP_ERROR_TEXT[code]) || '픽업 처리에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
}
