import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { POLL_MS } from '@/shared/api/queryClient'

export interface InventoryItem {
  productId: number
  name: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
}

/** S-10 재고 목록 + S-15 3초 폴링으로 실시간 반영 */
export function useInventory() {
  return useQuery({
    queryKey: ['owner', 'inventory'],
    queryFn: async () => (await api.get<InventoryItem[]>('/owner/inventory')).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}
