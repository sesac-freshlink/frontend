import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/shared/api/client'
import { POLL_MS } from '@/shared/api/queryClient'

/** S-10 응답 한 줄. inventory-service InventorySummaryResponse 와 같은 모양 */
export interface InventoryItem {
  productId: number
  productCode: string
  name: string
  category: string
  price: number
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  /** 수량이 남은 lot 중 가장 빠른 유통기한(+09:00). 없으면 null */
  nearestExpiry: string | null
  imminentLotCount: number
  expiredLotCount: number
}

/** lot 상태. 서버가 지금 시각으로 계산해서 내려 준다 */
export type InventoryLotStatus = 'NORMAL' | 'IMMINENT' | 'EXPIRED'

/** S-11 응답 한 줄. inventory-service InventoryLotResponse 와 같은 모양 */
export interface InventoryLotItem {
  lotId: number
  expiryDate: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  status: InventoryLotStatus
}

/** 서버 오류 본문 (common ErrorResponse) */
interface ErrorBody {
  code?: string
  message?: string
}

/** S-10 재고 목록 + S-15 3초 폴링으로 실시간 반영 */
export function useInventory() {
  return useQuery({
    queryKey: ['owner', 'inventory'],
    queryFn: async () => (await api.get<InventoryItem[]>('/owner/inventory')).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}

/**
 * S-11 상품 하나의 lot 목록 (유통기한 빠른 순, 수량 0 제외).
 * 패널이 열려 있는 동안만 쓰이므로 같은 주기로 폴링해 목록과 숫자가 어긋나지 않게 한다
 */
export function useInventoryLots(productId: number) {
  return useQuery({
    queryKey: ['owner', 'inventory', productId, 'lots'],
    queryFn: async () =>
      (await api.get<InventoryLotItem[]>(`/owner/inventory/${productId}/lots`)).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}

/** 서버 오류 본문의 message 를 꺼낸다. 없으면 fallback */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorBody>(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}
