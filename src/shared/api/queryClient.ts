import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

/** 401 은 api interceptor 가 이미 갱신·만료 처리했으므로 다시 시도하지 않는다. 그 외 오류는 1회 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response?.status === 401) return false
  return failureCount < 1
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, refetchOnWindowFocus: true },
  },
})

/** 폴링 주기. S-15 점주 재고는 3초, 고객 주문 상세는 2초 */
export const POLL_MS = {
  ownerInventory: 3_000,
  orderDetail: 2_000,
} as const
