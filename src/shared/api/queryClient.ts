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

/**
 * 폴링 주기. S-15 점주 재고는 3초, 고객 주문 상세는 2초, 선착순 대기 화면 순번은 2.5초 (오픈런 문서 2~3초),
 * 고객 픽업 QR 화면의 픽업 대기 목록은 5초 (추가 명세 A16).
 * 점주 주문 목록(대시보드 픽업 대기 포함)은 화면이 보일 때 10초, 고객 주문 상세는 결제 완료 뒤 준비 완료가 될 때까지 5초
 * (11/14 경우 결정 R3: 알림을 놓쳐도 맞춰지는 안전 주기)
 */
export const POLL_MS = {
  ownerInventory: 3_000,
  orderDetail: 2_000,
  firstComeQueue: 2_500,
  pickupQr: 5_000,
  ownerOrders: 10_000,
  orderProgress: 5_000,
} as const
