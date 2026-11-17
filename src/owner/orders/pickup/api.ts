import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { OrderStatus } from '@/customer/order/orderStatus'
import { api } from '@/shared/api/client'
import { apiErrorCode } from '@/shared/api/errors'
import { useAuthStore } from '@/shared/auth'

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
 * 알림 통로가 서버 응답(401·5xx 등)으로 닫혔을 때 다시 열기 전에 기다리는 시간. 실패가 이어지면 늘려 간다
 * (11/13 경우 결정: 알림 종과 같은 3초 → 10초 → 30초, 그 뒤 30초마다)
 */
export const PICKUP_STREAM_RECONNECT_MS = [3_000, 10_000, 30_000] as const

/** 브라우저가 스스로 다시 붙는 중(CONNECTING)일 때 이 시간 안에 붙으면 불을 끊김으로 바꾸지 않는다 */
export const PICKUP_STREAM_BLIP_MS = 3_000

/** 점포명 옆 QR 연결 불의 마우스 올림 글·화면 읽기 글 (11/13 경우 결정) */
export const PICKUP_STREAM_LABEL = {
  connected: 'QR 받을 준비됨',
  disconnected: 'QR 연결 끊김, 다시 연결 중',
} as const

/**
 * OR-09 점주 컴퓨터 픽업 QR 알림 SSE. 점주 핸드폰이 QR을 찍으면 pickup-scan 이벤트로 표가 온다.
 * - 열리면 onConnectionChange(true), 끊기면 false 를 알린다(점포명 옆 불).
 * - 네트워크로 잠깐 끊기면(CONNECTING) EventSource 가 스스로 다시 붙는다.
 * - 서버 응답으로 닫히면(CLOSED, 로그인 만료 401 등) 기다렸다가 로그인을 갱신하고 새로 연다.
 *   갱신이 안 되면(로그인이 끝남) 다시 열지 않는다. 다시 로그인하면 점주 화면과 함께 새로 열린다.
 * - 화면이 다시 보이면(다른 탭·잠자기에서 돌아옴) 닫혀 있을 때만 기다리지 않고 바로 다시 연다.
 * (11/13 QR 스캔 PC 무반응 트러블슈팅: 서버 30분 끊김 뒤 로그인 1시간이 지나 401 을 받으면 다시 붙지 않았다)
 */
export function usePickupScanStream(
  onScan: (token: string) => void,
  onConnectionChange?: (connected: boolean) => void,
) {
  // 부르는 쪽이 함수를 새로 만들어 넘겨도 통로를 다시 열지 않게 최신 함수만 들고 있는다
  const onScanRef = useRef(onScan)
  const onConnectionChangeRef = useRef(onConnectionChange)
  useEffect(() => {
    onScanRef.current = onScan
    onConnectionChangeRef.current = onConnectionChange
  }, [onScan, onConnectionChange])

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let blipTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false
    let reopening = false
    const notify = (connected: boolean) => onConnectionChangeRef.current?.(connected)

    const listener = (e: MessageEvent<string>) => {
      const token = parseScanToken(e.data)
      if (token) onScanRef.current(token)
    }

    const open = () => {
      const next = new EventSource(PICKUP_STREAM_PATH, { withCredentials: true })
      source = next
      next.addEventListener('pickup-scan', listener)
      next.onopen = () => {
        failures = 0
        clearTimeout(blipTimer)
        blipTimer = undefined
        notify(true)
      }
      next.onerror = () => {
        if (stopped || source !== next) return
        // CONNECTING 이면 브라우저가 스스로 다시 붙는 중이다(서버 30분 끊김 뒤 등). 바로 붙으면 불을 바꾸지 않고,
        // PICKUP_STREAM_BLIP_MS 안에 못 붙을 때만 끊김으로 알린다(불 깜빡임·화면 읽기 반복을 막는다)
        if (next.readyState !== EventSource.CLOSED) {
          blipTimer ??= setTimeout(() => notify(false), PICKUP_STREAM_BLIP_MS)
          return
        }
        // CLOSED 는 서버가 오류 응답(401 등)으로 닫은 것: 바로 끊김으로 알리고 기다렸다 새로 연다
        clearTimeout(blipTimer)
        blipTimer = undefined
        notify(false)
        next.close()
        const wait =
          PICKUP_STREAM_RECONNECT_MS[Math.min(failures, PICKUP_STREAM_RECONNECT_MS.length - 1)]
        failures += 1
        timer = setTimeout(() => void reopen(), wait)
      }
    }

    const reopen = async () => {
      if (stopped || reopening) return
      reopening = true
      try {
        // 401 이었으면 로그인 쿠키를 새로 받는다. 로그인이 끝났으면(false) 다시 열지 않는다
        if (!(await useAuthStore.getState().refreshSession())) return
      } catch {
        // 갱신 서버 오류: 로그인은 살아 있을 수 있어 그대로 다시 열어 본다
      } finally {
        reopening = false
      }
      if (!stopped) open()
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || source?.readyState !== EventSource.CLOSED)
        return
      clearTimeout(timer)
      void reopen()
    }

    document.addEventListener('visibilitychange', onVisible)
    open()
    return () => {
      stopped = true
      clearTimeout(timer)
      clearTimeout(blipTimer)
      document.removeEventListener('visibilitychange', onVisible)
      source?.removeEventListener('pickup-scan', listener)
      source?.close()
    }
  }, [])
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
