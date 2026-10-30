import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  /** 상품 이미지 주소. 없으면 null (화면이 자리표시를 보여 준다) */
  imageUrl: string | null
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
  /** 점주 상품 메모가 있으면 true */
  hasMemo: boolean
}

/** S-10 상태 필터. 여러 개면 모두 만족하는 상품만 */
export type InventoryStatusFilter = 'IMMINENT' | 'EXPIRED' | 'SOLD_OUT' | 'LOW_STOCK'

/** S-10 재고 목록 검색 조건. 서버가 거르고 페이지로 자른다 */
export interface InventoryQuery {
  /** 상품명·상품 코드 검색어. 비면 조건 없음 */
  q: string
  statuses: InventoryStatusFilter[]
  /** true 면 메모가 있는 상품만 */
  memoOnly: boolean
  /** 0부터 */
  page: number
  size: number
}

/** S-10 재고 목록 한 페이지. inventory-service InventoryPageResponse 와 같은 모양 */
export interface InventoryListPage {
  items: InventoryItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  /** 검색·필터·페이지와 상관없이 점포 전체에서 안전재고보다 적은 상품 수 */
  lowStockCount: number
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

/**
 * 재고 변동 종류. 예약·해제는 실물이 바뀌지 않아 이력에 남지 않는다. ADJUST 는 점주 수동 조정(S-14),
 * RETURN 은 환불 뒤 판매 재고 복원(+, A10)
 */
export type LedgerType = 'INBOUND' | 'SALE' | 'DISPOSE' | 'ADJUST' | 'RETURN'

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

/** 유통기한 달력의 lot 하나. 상태는 서버가 지금 시각으로 계산한다 */
export interface ExpiryCalendarLot {
  lotId: number
  productId: number
  productCode: string
  name: string
  /** 기한(+09:00) */
  expiryDate: string
  quantity: number
  reservedQuantity: number
  status: InventoryLotStatus
}

/** 유통기한 달력의 하루. lot 이 있는 날만 온다 */
export interface ExpiryCalendarDay {
  /** "YYYY-MM-DD" */
  date: string
  lotCount: number
  /** 그날 끝나는 lot 의 실물 수량 합 */
  quantity: number
  lots: ExpiryCalendarLot[]
}

/** 유통기한 달력. inventory-service ExpiryCalendarResponse 와 같은 모양 */
export interface ExpiryCalendar {
  /** "YYYY-MM" */
  month: string
  days: ExpiryCalendarDay[]
}

/** 판매 순위 한 줄. inventory-service SalesRankItem 과 같은 모양. 같은 판매 수량이면 같은 순위(1, 2, 2, 4) */
export interface SalesRankItem {
  rank: number
  productId: number
  productCode: string
  name: string
  category: string
  imageUrl: string | null
  /** 결제가 확정되어 실물이 줄어든 수량 */
  soldQuantity: number
  /** 기간 전체 판매 중 비중(0~1) */
  share: number
}

/** 상품별 판매 순위. inventory-service SalesRankingResponse 와 같은 모양 */
export interface SalesRanking {
  from: string
  to: string
  /** 잘라 내기 전 기간 전체 판매 수량 */
  totalSoldQuantity: number
  items: SalesRankItem[]
}

/** 점주 상품 메모 하나. inventory-service MemoResponse 와 같은 모양. 상품 하나에 메모 하나 */
export interface ProductMemo {
  productId: number
  productCode: string
  name: string
  category: string
  content: string
  /** 낙관적 락. 고치거나 지울 때 그대로 보낸다 */
  version: number
  /** 마지막으로 고친 시각(+09:00) */
  updatedAt: string
}

/** 메모 저장 요청. 처음 만들 때는 version 이 null */
export interface SaveMemoRequest {
  productId: number
  content: string
  version: number | null
}

/** 메모 삭제 요청. 읽은 version 을 보내 그 사이 바뀐 메모는 지우지 않는다 */
export interface DeleteMemoRequest {
  productId: number
  version: number
}

/** 서버 오류 본문 (common ErrorResponse) */
interface ErrorBody {
  code?: string
  message?: string
}

/**
 * S-10 재고 목록 한 페이지 + S-15 3초 폴링으로 실시간 반영. 검색·필터·페이지는 서버가 한다.
 * 조건을 바꾸는 동안에는 앞 페이지를 그대로 보여 줘 표가 깜빡이지 않게 한다
 */
export function useInventory(query: InventoryQuery) {
  return useQuery({
    queryKey: ['owner', 'inventory', query],
    queryFn: async () =>
      (await api.get<InventoryListPage>('/owner/inventory', { params: inventoryParams(query) }))
        .data,
    refetchInterval: POLL_MS.ownerInventory,
    placeholderData: keepPreviousData,
  })
}

/** 서버 쿼리 모양. 빈 조건은 보내지 않고, 상태는 쉼표로 잇는다(status=IMMINENT,LOW_STOCK) */
export function inventoryParams(query: InventoryQuery): Record<string, string | number | boolean> {
  const q = query.q.trim()
  return {
    ...(q ? { q } : {}),
    ...(query.statuses.length > 0 ? { status: query.statuses.join(',') } : {}),
    ...(query.memoOnly ? { memo: true } : {}),
    page: query.page,
    size: query.size,
  }
}

/**
 * S-11 상품 하나의 lot 목록 (유통기한 빠른 순, 수량 0 제외).
 * 패널이 열려 있는 동안만 쓰이므로 같은 주기로 폴링해 목록과 숫자가 어긋나지 않게 한다
 */
export function useInventoryLots(productId: number) {
  return useQuery({
    queryKey: ['owner', 'inventory', productId, 'lots'],
    queryFn: async () => {
      const { data } = await api.get<InventoryLotItem[]>(`/owner/inventory/${productId}/lots`)
      // 배포 사이에 잠깐 어긋나 목록 대신 다른 것(HTML 등)이 오면 화면 전체가 멈췄다(10/29 dev).
      // 배열이 아니면 오류로 돌려 패널에만 안내가 뜨고 다음 폴링 때 다시 읽는다
      if (!Array.isArray(data)) throw new Error('lot 응답이 목록이 아니에요')
      return data
    },
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
        queryClient.invalidateQueries({ queryKey: ['owner', 'expiryCalendar'] }),
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

/** 점주 추천상품 설정 한 줄. 상품 전체가 오고 recommended 면 고객 목록에 '추천'으로 보인다 */
export interface RecommendationItem {
  productId: number
  productCode: string
  name: string
  category: string
  recommended: boolean
}

/** 점주 선착순 설정 한 줄. 상품 전체가 오고, firstCome 이 false 면 limit·used·remaining 은 null */
export interface FirstComeSetting {
  productId: number
  productCode: string
  name: string
  category: string
  firstCome: boolean
  /** 판매 한도(1~999) */
  limit: number | null
  /** 선착순을 켠 뒤 잡혀 있거나 팔린 수량 */
  used: number | null
  /** 지금 더 팔 수 있는 수량 = min(한도 − used, 구매 가능 수량) */
  remaining: number | null
}

/** 점주 추천상품 설정 목록 (상품 전체, 이름순). 탭을 열 때 읽는다 */
export function useRecommendations() {
  return useQuery({
    queryKey: ['owner', 'recommendations'],
    queryFn: async () =>
      (await api.get<RecommendationItem[]>('/owner/inventory/recommendations')).data,
  })
}

/** 추천상품으로 정하거나 뺀다. 같은 요청을 다시 보내도 결과가 같다 */
export function useSetRecommendation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, recommended }: { productId: number; recommended: boolean }) => {
      const url = `/owner/inventory/recommendations/${productId}`
      return (
        recommended
          ? await api.put<RecommendationItem>(url)
          : await api.delete<RecommendationItem>(url)
      ).data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['owner', 'recommendations'] }),
  })
}

/** 점주 선착순 설정 목록 (상품 전체, 이름순). 탭을 열 때 읽는다 */
export function useFirstComeSettings() {
  return useQuery({
    queryKey: ['owner', 'firstCome'],
    queryFn: async () => (await api.get<FirstComeSetting[]>('/owner/inventory/first-come')).data,
  })
}

/** 선착순 켜기·한도 바꾸기(limit 1~999), 또는 끄기(limit null). 한도를 바꿔도 이미 판 수량은 이어서 센다 */
export function useSetFirstCome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, limit }: { productId: number; limit: number | null }) => {
      const url = `/owner/inventory/first-come/${productId}`
      return (
        limit === null
          ? await api.delete<FirstComeSetting>(url)
          : await api.put<FirstComeSetting>(url, { limit })
      ).data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['owner', 'firstCome'] }),
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
          ['owner', 'expiryCalendar'],
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

/** 유통기한 달력 (그 달에 기한이 끝나는 lot 을 날짜별로). 달을 바꿀 때 읽고, 폐기·조정하면 다시 읽는다 */
export function useExpiryCalendar(month: string) {
  return useQuery({
    queryKey: ['owner', 'expiryCalendar', month],
    queryFn: async () =>
      (await api.get<ExpiryCalendar>('/owner/inventory/expiry-calendar', { params: { month } }))
        .data,
  })
}

/** 상품별 판매 순위 (결제 확정 수량 기준, 상위 10개). 탭을 열 때·기간을 바꿀 때 읽는다 */
export function useSalesRanking(period: StatsPeriod) {
  return useQuery({
    queryKey: ['owner', 'salesRanking', period.from, period.to],
    queryFn: async () =>
      (await api.get<SalesRanking>('/owner/inventory/sales-ranking', { params: period })).data,
  })
}

/** 점주 상품 메모 목록 (메모가 있는 상품만, 최근 수정 순). 저장·삭제하면 다시 읽으므로 폴링하지 않는다 */
export function useMemos() {
  return useQuery({
    queryKey: ['owner', 'memos'],
    queryFn: async () => (await api.get<ProductMemo[]>('/owner/inventory/memos')).data,
  })
}

/** 메모·재고 목록(hasMemo)을 다시 읽는다. 409 때도 다시 읽어야 다른 화면이 바꾼 내용이 보인다 */
function invalidateMemos(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['owner', 'memos'] }),
    queryClient.invalidateQueries({ queryKey: ['owner', 'inventory'] }),
  ])
}

/** 메모 저장 (없으면 만들고 있으면 고친다). 읽은 뒤 다른 화면이 바꿨으면 409 MEMO_CHANGED */
export function useSaveMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, content, version }: SaveMemoRequest) =>
      (
        await api.put<ProductMemo>(`/owner/inventory/memos/${productId}`, {
          content,
          ...(version === null ? {} : { version }),
        })
      ).data,
    onSettled: () => invalidateMemos(queryClient),
  })
}

/** 메모 삭제. 읽은 뒤 다른 화면이 바꿨으면 409 MEMO_CHANGED */
export function useDeleteMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, version }: DeleteMemoRequest) => {
      await api.delete(`/owner/inventory/memos/${productId}`, { params: { version } })
    },
    onSettled: () => invalidateMemos(queryClient),
  })
}

/** 서버 오류의 code. 409 중 메모 충돌만 골라낼 때 쓴다 */
export function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ErrorBody>(error)) return error.response?.data?.code
  return undefined
}

/** 서버 오류 본문의 message 를 꺼낸다. 없으면 fallback */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ErrorBody>(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}
