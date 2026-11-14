import { keepPreviousData, skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useInventory, type InventoryItem, type LedgerItem } from '@/owner/inventory/api'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'

/** 묶음 단위. day = 하루, week = 월요일부터 일요일, month = 달 */
export type SalesUnit = 'day' | 'week' | 'month'

/**
 * 매출 응답 한 묶음. order-service SalesResponse.Period 와 같은 모양.
 * 환불(A8·A9)·결제 전 취소(A7)가 생기기 전까지 refundAmount·refundCount·canceledCount 는 늘 0 이다
 */
export interface SalesPeriod {
  /** 묶음 이름. day·week 는 첫날 "yyyy-MM-dd"(week 는 월요일), month 는 "yyyy-MM" */
  period: string
  /** 결제 금액 합계 (결제 승인 시각 기준, 한국 날짜) */
  paidAmount: number
  refundAmount: number
  /** 순매출 = 결제 − 환불 */
  netAmount: number
  paidCount: number
  refundCount: number
  canceledCount: number
}

/** 매출 응답. order-service SalesResponse 와 같은 모양. periods 는 기간 안 모든 묶음을 오래된 순으로(매출 없으면 0) */
export interface SalesResponse {
  from: string
  to: string
  unit: SalesUnit
  periods: SalesPeriod[]
}

/** 매출 조회 조건. from·to 는 한국 날짜 "yyyy-MM-dd", 둘 다 포함, 최대 366일 */
export interface SalesQuery {
  from: string
  to: string
  unit: SalesUnit
}

/**
 * 점주 매출 대시보드(기능 ID 미정) 기간별 매출 (order-service GET /owner/orders/sales).
 * 점포는 gateway 가 붙이는 X-Store-Id 로 정해진다. query 가 null 이면(잘못된 기간) 부르지 않는다.
 * 기간·단위를 바꾸는 동안에는 앞 결과를 그대로 보여 준다. 폴링은 하지 않는다 (결제 완료는 useSalesStream 이 알려 준다)
 */
export function useSales(query: SalesQuery | null) {
  return useQuery({
    queryKey: ['owner', 'sales', query?.from, query?.to, query?.unit],
    queryFn: query
      ? async () => (await api.get<SalesResponse>('/owner/orders/sales', { params: query })).data
      : skipToken,
    placeholderData: keepPreviousData,
  })
}

/** 실시간 매출 SSE 주소. EventSource 는 axios 를 쓰지 않아 /api 를 직접 붙인다 (같은 주소라 쿠키가 따라간다) */
export const SALES_STREAM_PATH = '/api/owner/orders/sales/stream'

/** 매출 SSE 이벤트 data. order-service TodaySales 와 같은 모양 (오늘 = 한국 날짜) */
export interface TodaySales {
  date: string
  paidAmount: number
  paidCount: number
}

/**
 * 매출 통로가 서버 응답(401·5xx 등)으로 닫혔을 때 다시 열기 전에 기다리는 시간. 실패가 이어지면 늘려 간다
 * (11/14 경우 결정 R4: 픽업 QR 통로 #103 과 같은 3초 → 10초 → 30초, 그 뒤 30초마다)
 */
export const SALES_STREAM_RECONNECT_MS = [3_000, 10_000, 30_000] as const

/**
 * 점주 실시간 매출 SSE (order-service GET /owner/orders/sales/stream). 결제가 완료되면 서버가 오늘 합계를 sales 이벤트로 보낸다.
 * 받으면 매출 조회를 다시 읽어 오늘·이번 주 카드와 그래프·표를 맞춘다. 처음 연결했을 때 오는 첫 이벤트는
 * 화면이 막 읽은 값과 같아서 넘긴다. enabled 가 false 면 연결하지 않는다.
 * - 네트워크로 잠깐 끊기면(CONNECTING) EventSource 가 스스로 다시 붙고, 그 뒤 첫 이벤트로 놓친 결제를 반영한다.
 * - 서버 응답으로 닫히면(CLOSED, 로그인 만료 401 등) 기다렸다가 로그인을 갱신하고 새로 연다. 새로 연 뒤 첫 이벤트는
 *   끊긴 동안 놓친 결제가 있을 수 있어 넘기지 않고 다시 읽는다. 갱신이 안 되면(로그인이 끝남) 다시 열지 않는다.
 * - 화면이 다시 보이면 닫혀 있을 때만 기다리지 않고 바로 다시 연다. (11/14 경우 결정 R4, 픽업 QR 통로와 같은 방식)
 */
export function useSalesStream(enabled = true) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false
    let reopening = false
    let first = true

    const onSales = () => {
      if (first) {
        first = false
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['owner', 'sales'] })
    }

    const open = () => {
      const next = new EventSource(SALES_STREAM_PATH, { withCredentials: true })
      source = next
      next.addEventListener('sales', onSales)
      next.onopen = () => {
        failures = 0
      }
      next.onerror = () => {
        // CONNECTING 이면 브라우저가 스스로 다시 붙는 중이다. CLOSED 는 서버가 오류 응답(401 등)으로 닫은 것
        if (stopped || source !== next || next.readyState !== EventSource.CLOSED) return
        next.close()
        next.removeEventListener('sales', onSales)
        const wait =
          SALES_STREAM_RECONNECT_MS[Math.min(failures, SALES_STREAM_RECONNECT_MS.length - 1)]
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
      if (stopped) return
      first = false
      open()
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
      document.removeEventListener('visibilitychange', onVisible)
      source?.removeEventListener('sales', onSales)
      source?.close()
    }
  }, [queryClient, enabled])
}

/** OR-14 하루 상품별 매출 한 줄. order-service SalesProductsResponse.Item 과 같은 모양 */
export interface SalesProductItem {
  productId: number
  productName: string | null
  /** 그날 결제 승인 수량 − 그날 환불 수량 */
  soldQuantity: number
  /** 그중 마감세일 수량 */
  clearanceQuantity: number
  /** 실제 결제 금액(마감세일 할인 반영) − 환불 금액 */
  netAmount: number
}

/** OR-14 응답. items 는 많이 팔린 순 */
export interface SalesProducts {
  date: string
  items: SalesProductItem[]
}

/**
 * OR-14 점주 하루 상품별 매출 (order-service GET /owner/orders/sales/products?date=, 11/14 하루 보기·매출 날짜 창).
 * queryKey 가 ['owner','sales'] 아래라 결제 완료 매출 SSE 를 받으면 같이 다시 읽는다. date 가 null 이면 부르지 않는다
 */
export function useSalesProducts(date: string | null) {
  return useQuery({
    queryKey: ['owner', 'sales', 'products', date],
    queryFn: date
      ? async () =>
          (await api.get<SalesProducts>('/owner/orders/sales/products', { params: { date } })).data
      : skipToken,
  })
}

/**
 * 그날의 폐기·입고 (inventory-service S-13 GET /owner/inventory/ledger?from=&to=, 최근 100건).
 * 화면에서도 그날(createdAt 한국 날짜) 것만 남긴다. 재고 화면의 useLedger 는 날짜 조건이 없어 따로 둔다
 */
export function useDayLedger(date: string) {
  return useQuery({
    queryKey: ['owner', 'sales', 'ledger', date],
    queryFn: async () =>
      (
        await api.get<LedgerItem[]>('/owner/inventory/ledger', { params: { from: date, to: date } })
      ).data.filter(
        (l) => l.createdAt.slice(0, 10) === date && (l.type === 'DISPOSE' || l.type === 'INBOUND'),
      ),
  })
}

/** 재고 목록 한 쪽(최대 100개, 조건 없음). 렌더마다 새 객체를 만들지 않게 밖에 둔다 */
const STOCK_QUERY = { q: '', statuses: [], memoOnly: false, page: 0, size: 100 }

/** 지금 재고를 상품 번호로 찾는 표 (S-10 재고 목록 한 쪽, 최대 100개). 재고 화면처럼 3초마다 다시 읽는다 */
export function useStockByProduct(): Map<number, InventoryItem> {
  const inventory = useInventory(STOCK_QUERY)
  // 재고는 3초마다 다시 읽으므로 응답이 바뀔 때만 표를 새로 만든다
  const items = inventory.data?.items
  return useMemo(() => new Map((items ?? []).map((item) => [item.productId, item])), [items])
}
