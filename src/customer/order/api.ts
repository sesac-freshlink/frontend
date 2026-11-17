import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { apiErrorCode } from '@/shared/api/errors'
import { type DatePeriod, isReversedPeriod, periodParams } from '@/shared/api/period'
import { POLL_MS } from '@/shared/api/queryClient'
import {
  isAwaitingReadyStatus,
  isPollingStatus,
  type FailureReason,
  type OrderStatus,
} from './orderStatus'
import { isRefundInProgress, type RefundInfo, type RefundStatus } from './refund'

/** OR-01 요청 */
export interface CreateOrderRequest {
  storeId: number
  storeName: string
  productId: number
  /** 전체 수량 1~5 */
  quantity: number
  /** 그중 마감세일 수량 (마감세일 함께 사기). 0이면 보내지 않아도 된다 */
  clearanceQuantity?: number
}

/** OR-01 응답 (201 새 주문 / 200 같은 키로 이미 만든 주문) */
export interface CreateOrderResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
}

/**
 * OR-02·OR-04 결제 내역. 결제 승인을 시작한 뒤에 생긴다 (그 전 주문은 payment = null).
 * approvedAt 은 +09:00, receiptUrl 은 토스 영수증 주소 (없으면 null, 결제는 그대로 완료)
 */
export interface OrderPayment {
  method: string | null
  approvedAt: string | null
  status: 'APPROVING' | 'DONE' | 'FAILED'
  receiptUrl: string | null
}

/**
 * OR-02 응답. 상품명·단가·금액·픽업 기한은 재고 확보(RESERVED) 뒤에 생긴다. serverTime 은 응답을 만든 서버 현재 시각.
 * pickupDeadline 은 그날 23:59:59(+09:00), pickedUpAt 은 점주 픽업 확인 시각 (A4·A5)
 */
export interface Order {
  orderId: number
  orderNo: string
  status: OrderStatus
  failureReason: FailureReason | null
  storeId: number
  storeName: string
  productId: number
  productName: string | null
  quantity: number
  /** 전체 수량 중 마감세일 수량 (마감세일 함께 사기). 옛 서버는 보내지 않는다 */
  clearanceQuantity?: number
  unitPrice: number | null
  amount: number | null
  /** 줄(마감세일·기본). 재고를 잡기 전이면 빈 배열 */
  lines?: OrderLine[]
  /** 재고 확보 실패 때 기본·마감세일 남은 수 */
  availableQuantity?: number | null
  clearanceAvailableQuantity?: number | null
  paymentExpiresAt: string | null
  paidAt: string | null
  createdAt: string
  pickupDeadline: string | null
  pickedUpAt: string | null
  payment: OrderPayment | null
  /** 결제 후 취소·환불 (A8·A9). 요청이 없으면 NONE, refund 는 마지막 시도(없으면 null) */
  refundStatus: RefundStatus
  refund: RefundInfo | null
  serverTime: string
}

/** OR-03 요청 (토스 성공 URL 로 받은 값 그대로) */
export interface ConfirmPaymentRequest {
  paymentKey: string
  orderNo: string
  amount: number
}

/** OR-03 응답. 처리 결과는 status 로 알린다 */
export interface ConfirmPaymentResponse {
  orderId: number
  orderNo: string
  status: OrderStatus
  storeName: string
  productName: string | null
  quantity: number
  amount: number | null
  paidAt: string | null
}

/** 목록 한 페이지 (order-service A3·A6). page 는 0부터 */
export interface OrderPage<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** A3 고객 주문 내역 구분 */
export type CustomerOrderTab = 'PICKUP_WAITING' | 'PICKED_UP' | 'CANCELED' | 'ALL'

/** 한 페이지 개수 (추가 명세 A3·A6: 10·20·50, 기본 20) */
export const ORDER_PAGE_SIZES = [10, 20, 50] as const
export type OrderPageSize = (typeof ORDER_PAGE_SIZES)[number]
export const DEFAULT_ORDER_PAGE_SIZE: OrderPageSize = 20

/** 주문 내역 상품명 검색어 최대 길이 (OR-06 q: 앞뒤 공백 빼고 50자, 이모지도 1자로 센다) */
export const ORDER_KEYWORD_MAX = 50

/**
 * 글자(코드포인트) 기준으로 max 자까지 자른다. input maxLength 는 이모지를 2칸으로 세서 서버(코드포인트 50자)와
 * 어긋나므로 이 함수로 자른다
 */
export function limitCodePoints(value: string, max: number): string {
  const chars = Array.from(value)
  return chars.length > max ? chars.slice(0, max).join('') : value
}

/** 주문 한 줄 (마감세일 함께 사기). 마감세일 줄이 먼저 온다. amount = unitPrice × quantity */
export interface OrderLine {
  clearance: boolean
  quantity: number
  unitPrice: number
  amount: number
}

/** A3 고객 주문 내역 한 줄. 시각은 +09:00 */
export interface CustomerOrderSummary {
  orderId: number
  orderNo: string
  status: OrderStatus
  failureReason: FailureReason | null
  storeName: string
  productName: string | null
  quantity: number
  clearanceQuantity?: number
  amount: number | null
  lines?: OrderLine[]
  createdAt: string
  pickupDeadline: string | null
  /** 결제 후 취소·환불 상태 (A8·A9) */
  refundStatus: RefundStatus
}

const orderKey = (orderId: number) => ['customer', 'order', orderId]

/** A3 고객 주문 내역 조회 조건. period 는 주문일 기준 (빈 쪽은 보내지 않는다) */
export interface CustomerOrdersQuery {
  tab: CustomerOrderTab
  /** 0부터 */
  page: number
  size: OrderPageSize
  period: DatePeriod
}

/**
 * A3 고객 주문 내역 (order-service OR-06). 진입·구분 전환·[새로 고침] 때만 부른다 (폴링 없음).
 * 페이지를 넘기는 동안 이전 목록을 보여 준다. 시작 날짜가 끝 날짜보다 늦으면 서버가 400 을 주므로 부르지 않는다
 */
export function useCustomerOrders({ tab, page, size, period }: CustomerOrdersQuery) {
  const range = periodParams(period)
  return useQuery({
    queryKey: ['customer', 'orders', tab, page, size, range],
    queryFn: async () =>
      (
        await api.get<OrderPage<CustomerOrderSummary>>('/orders', {
          params: { tab, page, size, ...range },
        })
      ).data,
    enabled: !isReversedPeriod(period),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

/**
 * A3 고객 주문 내역을 묶음(size)씩 이어 붙여 읽는다(핸드폰 무한 스크롤, 11/11).
 * 받은 묶음이 마지막 페이지면 더 부르지 않는다. 구분·기간이 바뀌면 처음 묶음부터 다시 읽는다.
 * 시작 날짜가 끝 날짜보다 늦으면 서버가 400 을 주므로 부르지 않는다
 */
export function useCustomerOrderPages({
  tab,
  size,
  period,
  keyword = '',
}: Omit<CustomerOrdersQuery, 'page'> & { keyword?: string }) {
  const range = periodParams(period)
  // 상품명 검색(OR-06 q, 11/11). 앞뒤 공백을 빼고 비면 보내지 않는다. 서버가 q 를 모르면 무시해 전체가 온다
  const q = keyword.trim()
  const search = q ? { q } : {}
  return useInfiniteQuery({
    queryKey: ['customer', 'orders', 'pages', tab, size, range, q],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<OrderPage<CustomerOrderSummary>>('/orders', {
          params: { tab, page: pageParam, size, ...range, ...search },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: !isReversedPeriod(period),
    refetchOnWindowFocus: false,
  })
}

/**
 * U-22·U-31 주문 조회 (OR-02). 진행 중 상태와 환불 처리·확인 중에는 2초,
 * 결제 완료 뒤 준비 완료 전(결제 완료·픽업 신청)에는 5초 폴링 (11/14 경우 결정 R3)
 */
export function useOrder(orderId: number | undefined) {
  return useQuery({
    queryKey: orderKey(orderId ?? 0),
    queryFn: async () => (await api.get<Order>(`/orders/${orderId}`)).data,
    enabled: orderId !== undefined,
    refetchInterval: (query) => orderRefetchMs(query.state.data),
  })
}

/** 주문 상세 폴링 간격. 멈추면 false */
export function orderRefetchMs(
  order: Pick<Order, 'status' | 'refundStatus'> | undefined,
): number | false {
  if (isPollingStatus(order?.status) || isRefundInProgress(order?.refundStatus))
    return POLL_MS.orderDetail
  if (isAwaitingReadyStatus(order?.status)) return POLL_MS.orderProgress
  return false
}

/** 결제 대기 주문을 찾을 때 볼 최신 주문 수. 결제 대기는 10분이면 만료돼 늘 최신 주문 안에 있다 */
export const PENDING_LOOKUP_SIZE = 10

/**
 * 같은 점포·같은 상품의 결제 대기 주문 (11/12 경우 결정, 화면만으로 찾는다).
 * 주문 내역 전체 최신 10개에서 결제 대기만 골라 상세를 읽고 점포·상품 번호로 비교한다. 없으면 null
 */
export async function fetchPendingOrder(
  storeId: number,
  storeName: string,
  productId: number,
): Promise<{ order: Order; receivedAtMs: number } | null> {
  const page = (
    await api.get<OrderPage<CustomerOrderSummary>>('/orders', {
      params: { tab: 'ALL', page: 0, size: PENDING_LOOKUP_SIZE },
    })
  ).data
  const candidates = page.content.filter(
    (row) => row.status === 'PAYMENT_WAITING' && row.storeName === storeName,
  )
  for (const row of candidates) {
    const order = (await api.get<Order>(`/orders/${row.orderId}`)).data
    if (
      order.status === 'PAYMENT_WAITING' &&
      order.storeId === storeId &&
      order.productId === productId
    ) {
      return { order, receivedAtMs: Date.now() }
    }
  }
  return null
}

/** U-21 주문 생성 (OR-01). 같은 구매 시도의 재시도에는 같은 Idempotency-Key 를 보낸다 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: async ({
      idempotencyKey,
      body,
    }: {
      idempotencyKey: string
      body: CreateOrderRequest
    }) =>
      (
        await api.post<CreateOrderResponse>('/orders', body, {
          headers: { 'Idempotency-Key': idempotencyKey },
        })
      ).data,
  })
}

/** U-22 결제 승인 (OR-03). 결과는 응답 status 로 오고, 주문 조회를 다시 읽는다 */
export function useConfirmPayment(orderId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConfirmPaymentRequest) =>
      (await api.post<ConfirmPaymentResponse>(`/orders/${orderId}/payment/confirm`, body)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKey(orderId) }),
  })
}

/**
 * 선착순 대기열 (order-service, 오픈런 문서 2장).
 * WAITING = 줄에서 기다림, ADMITTED = 입장권 있음(주문 화면으로), SOLD_OUT = 남은 수량 0,
 * NOT_IN_QUEUE = 줄에 없음(그만 기다렸거나 순번 조회가 30초 끊겨 빠짐)
 */
export type QueueStatus = 'WAITING' | 'ADMITTED' | 'SOLD_OUT' | 'NOT_IN_QUEUE'

/** 줄 서기·내 순번 응답. 시각은 +09:00 */
export interface QueueStatusResponse {
  storeId: number
  productId: number
  status: QueueStatus
  /** 1부터 센 내 순번 (WAITING 일 때만) */
  position: number | null
  /** 내 앞에 남은 사람 수 (WAITING 일 때만) */
  ahead: number | null
  /** 지금 줄에 선 사람 수 */
  waiting: number
  /** 지금 더 살 수 있는 수량. 알 수 없으면 null */
  remaining: number | null
  /** 입장권 만료 시각 (ADMITTED 일 때만). 이때까지 [결제하기]를 눌러야 한다 */
  ticketExpiresAt: string | null
  serverTime: string
}

const queuePath = (productId: number) => `/orders/queue/${productId}`
const queueKey = (storeId: number, productId: number) => ['customer', 'queue', storeId, productId]

/** 줄 서기. 이미 서 있으면 원래 자리 그대로다 */
export function useJoinQueue(storeId: number, productId: number) {
  return useMutation({
    mutationFn: async () =>
      (await api.post<QueueStatusResponse>(queuePath(productId), null, { params: { storeId } }))
        .data,
  })
}

/** 내 순번 (선착순 대기). 기다리는 동안만 2.5초마다 다시 읽는다 (입장·품절·줄에서 빠지면 멈춘다) */
export function useQueueStatus(storeId: number, productId: number, enabled: boolean) {
  return useQuery({
    queryKey: queueKey(storeId, productId),
    queryFn: async () =>
      (
        await api.get<QueueStatusResponse>(`${queuePath(productId)}/me`, {
          params: { storeId },
        })
      ).data,
    enabled,
    // 점주가 선착순을 끄면(404 NOT_FIRST_COME) 더 묻지 않는다. 그 밖의 일시 오류는 계속 다시 묻는다
    refetchInterval: (query) =>
      query.state.data?.status === 'WAITING' && apiErrorCode(query.state.error) !== 'NOT_FIRST_COME'
        ? POLL_MS.firstComeQueue
        : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  })
}

/** 그만 기다리기 */
export function useLeaveQueue(storeId: number, productId: number) {
  return useMutation({
    mutationFn: async () => {
      await api.delete(`${queuePath(productId)}/me`, { params: { storeId } })
    },
  })
}

/** OR-07 고객 픽업 QR (추가 명세 A16). token 은 QR 안에, code 는 카메라가 안 될 때 점주가 손으로 넣는 6자리 */
export interface PickupPass {
  token: string
  code: string
  /** +09:00, 만든 뒤 5분 */
  expiresAt: string
  /** 기한이 남은 미픽업 주문 수 (모든 점포) */
  orderCount: number
}

/** OR-07 픽업 QR 만들기. 예전 QR은 서버가 지운다. 미픽업 주문이 없으면 409 NO_PICKUP_WAITING_ORDER */
export function useIssuePickupPass() {
  return useMutation({
    mutationFn: async () => (await api.post<PickupPass>('/orders/pickup-pass')).data,
  })
}

/** 픽업 QR 화면의 픽업 대기 목록. 점주가 승인하면 줄어든 것을 보여 주려고 5초마다 다시 읽는다 */
export function usePickupWaitingOrders(enabled = true) {
  return useQuery({
    queryKey: ['customer', 'orders', 'PICKUP_WAITING', 'pickup-qr'],
    queryFn: async () =>
      (
        await api.get<OrderPage<CustomerOrderSummary>>('/orders', {
          params: { tab: 'PICKUP_WAITING', page: 0, size: 50 },
        })
      ).data,
    enabled,
    refetchInterval: POLL_MS.pickupQr,
  })
}
