import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** OR-04 응답 한 줄 (결제 완료 주문) */
export interface OwnerOrder {
  orderId: number
  orderNo: string
  productName: string
  quantity: number
  amount: number
  paidAt: string
}

/**
 * S-50 신규 주문 목록 (order-service OR-04). 자기 점포의 결제 완료 주문만, 결제 시각 최신순.
 * 점포는 gateway 가 붙이는 X-Store-Id 로 정해진다. 화면에 들어올 때와 [새로 고침] 때만 부른다 (폴링 없음)
 */
export function useOwnerOrders() {
  return useQuery({
    queryKey: ['owner', 'orders'],
    queryFn: async () => (await api.get<OwnerOrder[]>('/owner/orders')).data,
    refetchOnWindowFocus: false,
  })
}
