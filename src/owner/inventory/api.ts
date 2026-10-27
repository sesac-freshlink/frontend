import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  /** S-40 안전재고. 점주가 정하지 않았으면 기본값 5 */
  safetyStock: number
  /** 구매 가능 수량이 안전재고보다 적으면 true */
  lowStock: boolean
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

/** 재고 변동 종류. 예약·해제는 실물이 바뀌지 않아 이력에 남지 않는다. ADJUST 는 점주 수동 조정(S-14) */
export type LedgerType = 'INBOUND' | 'SALE' | 'DISPOSE' | 'ADJUST'

/** S-13 응답 한 줄. inventory-service LedgerResponse 와 같은 모양 */
export interface LedgerItem {
  ledgerId: number
  type: LedgerType
  productId: number
  productName: string
  lotId: number
  expiryDate: string
  /** 부호 포함. 입고 +, 판매·폐기 −, 조정 ± */
  quantity: number
  /** 입고 shipmentId / 판매 orderId / 폐기 disposalId / 조정 adjustmentId */
  refId: string | null
  createdAt: string
}

/** S-30 응답 한 줄. 수량이 남은 임박(24시간 이내)·경과 lot 만 온다. inventory-service ExpiringInventoryResponse 와 같은 모양 */
export interface ExpiringLot {
  lotId: number
  productId: number
  productName: string
  expiryDate: string
  /** true 면 경과, false 면 임박 */
  expired: boolean
  quantity: number
  reservedQuantity: number
  /** 실물 − 예약. 0 이면 예약이 전부 잡고 있어 폐기할 수 없다 */
  disposableQuantity: number
}

/** S-32 요청. lot 하나씩 보낸다 */
export interface DisposeRequest {
  lotId: number
  quantity: number
}

/** S-32 202 응답. 재고는 DISPOSE 쪽지를 처리한 뒤에 줄어든다 */
export interface DisposeResponse {
  disposalId: number
  lotId: number
  quantity: number
}

/** 폐기 요청 상태. REQUESTED 는 DISPOSE 쪽지 처리 전, DONE 은 lot 수량이 줄었음, SKIPPED 는 처리 때 폐기 가능 수량이 모자라 재고 그대로 */
export type DisposalStatus = 'REQUESTED' | 'DONE' | 'SKIPPED'

/** S-33 응답 한 줄. inventory-service DisposalHistoryResponse 와 같은 모양 */
export interface DisposalHistoryItem {
  disposalId: number
  lotId: number
  productId: number
  productName: string
  expiryDate: string
  quantity: number
  status: DisposalStatus
  createdAt: string
  /** 처리 전(REQUESTED)이면 null */
  processedAt: string | null
}

/** S-40 상품 하나의 안전재고. inventory-service SafetyStockResponse 와 같은 모양. 입고 전 상품도 온다 */
export interface SafetyStockItem {
  productId: number
  productCode: string
  name: string
  category: string
  safetyStock: number
  /** false 면 점주가 정하지 않아 기본값(5)이다 */
  customized: boolean
}

/** S-40 안전재고 변경 요청 (0~999) */
export interface UpdateSafetyStockRequest {
  productId: number
  safetyStock: number
}

/** S-42 통계 한 줄. inventory-service ProductStatsResponse 와 같은 모양. 수량은 모두 양수 */
export interface ProductStats {
  productId: number
  productCode: string
  name: string
  category: string
  inboundQuantity: number
  soldQuantity: number
  disposedQuantity: number
  /** 수동 조정(S-14) 합계. 늘리면 +, 줄이면 − */
  adjustedQuantity: number
  /** 폐기 ÷ (판매 + 폐기). 판매·폐기가 없으면 null */
  disposalRate: number | null
}

/** S-42 통계. inventory-service InventoryStatsResponse 와 같은 모양. products 는 폐기 많은 순 */
export interface InventoryStats {
  from: string
  to: string
  inboundQuantity: number
  soldQuantity: number
  disposedQuantity: number
  adjustedQuantity: number
  disposalRate: number | null
  products: ProductStats[]
}

/** S-42 조회 기간. 한국 날짜 "YYYY-MM-DD", 둘 다 포함 */
export interface StatsPeriod {
  from: string
  to: string
}

/** S-14 조정 사유 */
export type AdjustmentReason = 'COUNT' | 'DAMAGE' | 'LOSS' | 'OTHER'

/** S-14 조정 요청. delta 는 증감(−999~999, 0 제외) */
export interface AdjustRequest {
  lotId: number
  delta: number
  reason: AdjustmentReason
  memo?: string
}

/** S-14 201 응답. 쪽지를 거치지 않아 응답 때 이미 lot 수량이 바뀌어 있다 */
export interface AdjustResponse {
  adjustmentId: number
  lotId: number
  delta: number
  quantityBefore: number
  quantityAfter: number
}

/** S-14 조정 이력 한 줄. inventory-service AdjustmentHistoryResponse 와 같은 모양 */
export interface AdjustmentHistoryItem {
  adjustmentId: number
  lotId: number
  productId: number
  productName: string
  expiryDate: string
  delta: number
  quantityBefore: number
  quantityAfter: number
  reason: AdjustmentReason
  memo: string | null
  createdAt: string
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

/**
 * S-13 재고 변동 이력 (최신순, 최근 100건). type 을 주면 그 종류만.
 * 시연 때 입고·판매가 바로 보이도록 재고 목록과 같은 주기로 다시 읽는다
 */
export function useLedger({ type }: { type?: LedgerType } = {}) {
  return useQuery({
    queryKey: ['owner', 'ledger', type ?? 'ALL'],
    queryFn: async () =>
      (await api.get<LedgerItem[]>('/owner/inventory/ledger', { params: { type } })).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}

/** S-30 임박·경과 lot (유통기한 빠른 순). 폐기 뒤 수량이 줄어드는 것이 보이도록 같은 주기로 다시 읽는다 */
export function useExpiring() {
  return useQuery({
    queryKey: ['owner', 'expiring'],
    queryFn: async () => (await api.get<ExpiringLot[]>('/owner/inventory/expiring')).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}

/**
 * S-32 lot 하나 폐기 요청. 202 는 접수만 뜻하고 수량은 쪽지 처리 뒤에 바뀌므로 낙관적 갱신은 하지 않는다.
 * 성공·실패 모두 임박 목록과 재고 목록을 다시 받는다
 */
export function useDisposeLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: DisposeRequest) =>
      (await api.post<DisposeResponse>('/owner/disposals', body)).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner', 'expiring'] }),
        queryClient.invalidateQueries({ queryKey: ['owner', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['owner', 'disposals'] }),
      ]),
  })
}

/**
 * S-33 폐기 요청 이력 (최신순, 최근 100건). 202 로 접수된 요청이 DONE·SKIPPED 로 끝나는 것을 보여 주기 위해
 * 임박 목록과 같은 주기로 다시 읽는다
 */
export function useDisposals() {
  return useQuery({
    queryKey: ['owner', 'disposals'],
    queryFn: async () => (await api.get<DisposalHistoryItem[]>('/owner/disposals')).data,
    refetchInterval: POLL_MS.ownerInventory,
  })
}

/** S-40 상품별 안전재고. 설정값이라 폴링하지 않고, 바꾸면 다시 읽는다 */
export function useSafetyStocks() {
  return useQuery({
    queryKey: ['owner', 'safetyStocks'],
    queryFn: async () => (await api.get<SafetyStockItem[]>('/owner/inventory/safety-stocks')).data,
  })
}

/** S-40 상품 하나의 안전재고 변경. 재고 목록의 부족 표시(lowStock)도 바뀌므로 같이 다시 읽는다 */
export function useUpdateSafetyStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, safetyStock }: UpdateSafetyStockRequest) =>
      (
        await api.put<SafetyStockItem>(`/owner/inventory/safety-stocks/${productId}`, {
          safetyStock,
        })
      ).data,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner', 'safetyStocks'] }),
        queryClient.invalidateQueries({ queryKey: ['owner', 'inventory'] }),
      ]),
  })
}

/** S-42 기간별 판매·폐기 통계. 원장을 서버가 더해서 내려 준다. 탭을 열 때·기간을 바꿀 때 읽는다 */
export function useInventoryStats(period: StatsPeriod) {
  return useQuery({
    queryKey: ['owner', 'stats', period.from, period.to],
    queryFn: async () =>
      (await api.get<InventoryStats>('/owner/inventory/stats', { params: period })).data,
  })
}

/**
 * S-14 lot 하나 수동 조정. 폐기와 달리 바로 반영되므로 재고·lot·이력·통계·조정 이력을 다시 읽는다.
 * 409 LOT_CHANGED 는 같은 lot 을 쪽지가 먼저 고친 경우라, 다시 읽은 수량을 보고 다시 하면 된다
 */
export function useAdjustLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: AdjustRequest) =>
      (await api.post<AdjustResponse>('/owner/inventory/adjustments', body)).data,
    onSettled: () =>
      Promise.all(
        [
          ['owner', 'inventory'],
          ['owner', 'expiring'],
          ['owner', 'ledger'],
          ['owner', 'stats'],
          ['owner', 'adjustments'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}

/** S-14 조정 이력 (최신순, 최근 100건). 조정하면 다시 읽으므로 폴링하지 않는다 */
export function useAdjustments() {
  return useQuery({
    queryKey: ['owner', 'adjustments'],
    queryFn: async () =>
      (await api.get<AdjustmentHistoryItem[]>('/owner/inventory/adjustments')).data,
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
