import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { POLL_MS } from '@/shared/api/queryClient'
import { isPollingStatus, type FailureReason, type OrderStatus } from './orderStatus'

/** OR-01 요청 */
export interface CreateOrderRequest {
  storeId: number
  storeName: string
  productId: number
  quantity: number
}

/** OR-01 응답 (201 새 주문 / 200 같은 키로 이미 만든 주문) */
export interface CreateOrderResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
}

/**
 * OR-02·OR-04 결제 내역. 결제 승인을 시작한 뒤에 생긴다 (그 전 주문은 payment = null).
 * approvedAt 은 +09:00, receiptUrl 은 토스 영수증 주소 (없으면 null, 결제는 그대로 완료)
 */
export interface OrderPayment {
  method: string | null
  approvedAt: string | null
  status: 'APPROVING' | 'DONE' | 'FAILED'
  receiptUrl: string | null
}

/**
 * OR-02 응답. 상품명·단가·금액·픽업 기한은 재고 확보(RESERVED) 뒤에 생긴다. serverTime 은 응답을 만든 서버 현재 시각.
 * pickupDeadline 은 그날 23:59:59(+09:00), pickedUpAt 은 점주 픽업 확인 시각 (A4·A5)
 */
export interface Order {
  orderId: number
  orderNo: string
  status: OrderStatus
  failureReason: FailureReason | null
  storeId: number
  storeName: string
  productId: number
  productName: string | null
  quantity: number
  unitPrice: number | null
  amount: number | null
  paymentExpiresAt: string | null
  paidAt: string | null
  createdAt: string
  pickupDeadline: string | null
  pickedUpAt: string | null
  payment: OrderPayment | null
  serverTime: string
}

/** OR-03 요청 (토스 성공 URL 로 받은 값 그대로) */
export interface ConfirmPaymentRequest {
  paymentKey: string
  orderNo: string
  amount: number
}

/** OR-03 응답. 처리 결과는 status 로 알린다 */
export interface ConfirmPaymentResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
  storeName: string
  productName: string | null
  quantity: number
  amount: number | null
  paidAt: string | null
}

const orderKey = (orderId: number) => ['customer', 'order', orderId]

/** U-22·U-31 주문 조회 (OR-02). 진행 중 상태에서만 2초 폴링 */
export function useOrder(orderId: number | undefined) {
  return useQuery({
    queryKey: orderKey(orderId ?? 0),
    queryFn: async () => (await api.get<Order>(`/orders/${orderId}`)).data,
    enabled: orderId !== undefined,
    refetchInterval: (query) =>
      isPollingStatus(query.state.data?.status) ? POLL_MS.orderDetail : false,
  })
}

/** U-21 주문 생성 (OR-01). 같은 구매 시도의 재시도에는 같은 Idempotency-Key 를 보낸다 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: async ({
      idempotencyKey,
      body,
    }: {
      idempotencyKey: string
      body: CreateOrderRequest
    }) =>
      (
        await api.post<CreateOrderResponse>('/orders', body, {
          headers: { 'Idempotency-Key': idempotencyKey },
        })
      ).data,
  })
}

/** U-22 결제 승인 (OR-03). 결과는 응답 status 로 오고, 주문 조회를 다시 읽는다 */
export function useConfirmPayment(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConfirmPaymentRequest) =>
      (await api.post<ConfirmPaymentResponse>(`/orders/${orderId}/payment/confirm`, body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKey(orderId) }),
  })
}
