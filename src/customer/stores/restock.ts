import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** notification-service 재입고 알림 신청 상태 (고객·점포·상품 단위) */
export interface RestockSubscription {
  storeId: number
  productId: number
  subscribed: boolean
}

const restockKey = (storeId: number, productId: number) =>
  ['customer', 'restock', storeId, productId] as const

/** 이 품절 상품에 재입고 알림을 신청했는지. 품절일 때만 읽는다 */
export function useRestockSubscription(storeId: number, productId: number, enabled: boolean) {
  return useQuery({
    queryKey: restockKey(storeId, productId),
    queryFn: async () =>
      (
        await api.get<RestockSubscription>(`/notifications/restock/${productId}`, {
          params: { storeId },
        })
      ).data,
    enabled,
  })
}

/** 재입고 알림 신청(true)·취소(false). 다시 입고되면 알림이 한 번 오고 신청은 저절로 풀린다 */
export function useToggleRestock(storeId: number, productId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (subscribe: boolean) => {
      const url = `/notifications/restock/${productId}`
      if (subscribe) await api.post(url, null, { params: { storeId } })
      else await api.delete(url, { params: { storeId } })
      return subscribe
    },
    onSuccess: (subscribed) =>
      queryClient.setQueryData<RestockSubscription>(restockKey(storeId, productId), {
        storeId,
        productId,
        subscribed,
      }),
  })
}
