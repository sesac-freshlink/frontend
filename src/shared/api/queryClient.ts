import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
})

/** 폴링 주기. S-15 점주 재고는 3초, 고객 주문 상세는 2초 */
export const POLL_MS = {
  ownerInventory: 3_000,
  orderDetail: 2_000,
} as const
