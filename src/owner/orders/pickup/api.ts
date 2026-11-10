import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { OrderStatus } from '@/customer/order/orderStatus'
import { api } from '@/shared/api/client'
import { apiErrorCode } from '@/shared/api/errors'

/** 픽업 QR 점주 쪽 API (추가 명세 A16, order-service OR-08~OR-11) */

/** OR-08 응답: 알림을 받은 점주 컴퓨터 화면 수 (0이면 열린 화면 없음) */
export interface PickupScanResult {
  screens: number
}

/** OR-10 주문 한 줄. 픽업 준비 완료만 selectable */
export interface PickupPassOrder {
  orderId: number
  orderNo: string
  status: OrderStatus
  productName: string | null
  quantity: number
  amount: number | null
  paidAt: string | null
  pickupDeadline: string | null
  selectable: boolean
}

/** OR-10 응답. 승인할 때 쓰는 표를 같이 준다(코드로 찾았을 때도) */
export interface PickupPassOrders {
  token: string
  orders: PickupPassOrder[]
}

export type PickupOutcome = 'PICKED_UP' | 'NOT_PICKABLE' | 'DEADLINE_PASSED' | 'NOT_FOUND'

/** OR-11 응답: 주문마다 결과 */
export interface PickupApproveResult {
  results: { orderId: number; result: PickupOutcome }[]
}

/** 한 번에 승인할 수 있는 주문 수 */
export const MAX_PICKUP_APPROVE = 20

/** 점주 컴퓨터 픽업 QR 알림 SSE 주소. EventSource 는 axios 를 쓰지 않아 /api 를 직접 붙인다 */
export const PICKUP_STREAM_PATH = '/api/owner/orders/pickup-stream'

/** OR-08 점주 핸드폰이 QR을 찍음 */
export function useScanPickupPass() {
  return useMutation({
    mutationFn: async (token: string) =>
      (await api.post<PickupScanResult>('/owner/orders/pickup-scan', { token })).data,
  })
}

/** OR-10 표 또는 6자리 코드로 고객의 이 점포 미픽업 주문. key 가 없으면 부르지 않는다 */
export function usePickupPassOrders(key: string | null) {
  return useQuery({
    queryKey: ['owner', 'orders', 'pickup-pass', key],
    queryFn: async () =>
      (
        await api.get<PickupPassOrders>(
          `/owner/orders/pickup-pass/${encodeURIComponent(key ?? '')}`,
        )
      ).data,
    enabled: key !== null,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

/** OR-11 고른 주문 일괄 픽업 승인. 끝나면 점주 주문 목록을 다시 읽는다 */
export function useApprovePickup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { token: string; orderIds: number[] }) =>
      (await api.post<PickupApproveResult>('/owner/orders/pickup', body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] }),
  })
}

/**
 * OR-09 점주 컴퓨터 픽업 QR 알림 SSE. 점주 핸드폰이 QR을 찍으면 pickup-scan 이벤트로 표가 온다.
 * 점주가 아니면 서버가 403 을 주고 EventSource 는 다시 붙지 않는다
 */
export function usePickupScanStream(onScan: (token: string) => void) {
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const source = new EventSource(PICKUP_STREAM_PATH, { withCredentials: true })
    const listener = (e: MessageEvent<string>) => {
      const token = parseScanToken(e.data)
      if (token) onScan(token)
    }
    source.addEventListener('pickup-scan', listener)
    return () => {
      source.removeEventListener('pickup-scan', listener)
      source.close()
    }
  }, [onScan])
}

/** pickup-scan 이벤트 data {token} 에서 표를 꺼낸다. 모양이 다르면 null */
export function parseScanToken(data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (typeof parsed === 'object' && parsed !== null && 'token' in parsed) {
      return typeof parsed.token === 'string' && parsed.token.length > 0 ? parsed.token : null
    }
  } catch {
    return null
  }
  return null
}

const ERROR_TEXT: Record<string, string> = {
  PICKUP_PASS_NOT_FOUND: 'QR이 만료됐거나 없어요. 고객에게 새 QR을 보여 달라고 해 주세요.',
  PICKUP_CODE_TOO_MANY_ATTEMPTS: '코드를 너무 많이 틀렸어요. 1분 뒤 다시 시도해 주세요.',
  PICKUP_PASS_UNAVAILABLE: '픽업 QR을 지금 쓸 수 없어요. 잠시 후 다시 시도해 주세요.',
  FORBIDDEN: '점주 계정으로 로그인해 주세요.',
  STORE_NOT_LINKED: '연결된 점포가 없어요.',
}

/** 픽업 QR 오류 문구 */
export function pickupPassErrorMessage(e: unknown, fallback: string): string {
  const code = apiErrorCode(e)
  return (code && ERROR_TEXT[code]) ?? fallback
}

export const PICKUP_OUTCOME_LABEL: Record<PickupOutcome, string> = {
  PICKED_UP: '픽업 완료',
  NOT_PICKABLE: '준비 완료가 아니에요',
  DEADLINE_PASSED: '픽업 기한이 지났어요',
  NOT_FOUND: '이 고객의 이 점포 주문이 아니에요',
}
