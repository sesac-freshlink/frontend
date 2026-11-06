import { http, HttpResponse } from 'msw'
import type {
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  CustomerOrderSummary,
  CustomerOrderTab,
  Order,
  OrderPage,
  QueueStatusResponse,
} from '@/customer/order/api'
import type { OrderStatus } from '@/customer/order/orderStatus'
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  CancelReasonCode,
  CancelRequester,
  RefundStatus,
} from '@/customer/order/refund'
import {
  CUSTOMER_CANCEL_REASONS,
  OWNER_CANCEL_REASONS,
  hasRefundStarted,
} from '@/customer/order/refund'
import type { OwnerOrder, OwnerOrderTab, PickupResponse, ReadyResponse } from '@/owner/orders/api'

/**
 * order-service 가짜 API (김경우): OR-01~03 고객 주문·결제, OR-04 점주 주문 목록(A6 구분), OR-05 픽업 확인, OR-06 고객 주문 내역(A3).
 * 가짜 로그인은 고객·점주가 한 명씩이라 고객·점포를 가리지 않고 모든 주문을 내린다
 */
// 상품 999 는 재고 부족으로 끝나는 주문을 흉내 낸다
const products: Record<number, { name: string; price: number }> = {
  1: { name: '삼각김밥 참치마요', price: 1500 },
  2: { name: '바나나우유', price: 1700 },
  3: { name: '샌드위치 햄치즈', price: 3200 },
}
type MockOrder = Order & {
  createdMs: number
  paymentKey?: string
  cancelRequestedAt?: string | null
}
const orders = new Map<number, MockOrder>()
const orderIdByKey = new Map<string, number>()
let nextOrderId = 1

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** 시각(ms)을 서버처럼 +09:00 문자열로 */
function kstIso(ms: number) {
  return `${new Date(ms + 9 * HOUR).toISOString().slice(0, 19)}+09:00`
}

/** 시각(ms)의 KST 날짜 yyyy-MM-dd */
function kstDate(ms: number) {
  return new Date(ms + 9 * HOUR).toISOString().slice(0, 10)
}

function orderNo(id: number, ms = Date.now()) {
  return `FL-${kstDate(ms).replaceAll('-', '')}-${String(id).padStart(6, '0')}`
}

/** 픽업 기한: 오늘부터 days 일 뒤 그날 23:59:59 KST (진짜는 lot 유통기한 중 가장 빠른 날) */
function pickupDeadline(days: number) {
  const kstDate = new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return `${kstDate}T23:59:59+09:00`
}

/** 마감세일 단가: 정가 30% 할인, 10원 단위 내림 (이태우 11/6) */
function clearancePriceOf(price: number) {
  return Math.floor((price * 0.7) / 10) * 10
}

/** 마감세일 판매 시간: KST 06:00 이상 23:00 미만 */
function clearanceOnSale(ms = Date.now()) {
  const hour = new Date(ms + 9 * HOUR).getUTCHours()
  return hour >= 6 && hour < 23
}

/**
 * 마감세일이 그새 다 팔린 주문 흉내: 상품 998, 또는 마감세일을 4개 고른 주문(삼각김밥 마감세일 4개를 다 사려는 사이
 * 다른 사람이 사 간 것으로 본다). 마감세일 0, 기본 2 남음
 */
const CLEARANCE_SOLD_OUT_PRODUCT = 998
const CLEARANCE_SOLD_OUT_QUANTITY = 4

/** 진짜처럼 1.5초 뒤 재고 결과(RESERVED·RESERVE_FAILED)가 온 것으로 본다 */
function advance(order: Order & { createdMs: number }) {
  if (order.status !== 'RESERVING' || Date.now() - order.createdMs < 1500) return
  const clearance = order.clearanceQuantity ?? 0
  if (
    clearance > 0 &&
    (order.productId === CLEARANCE_SOLD_OUT_PRODUCT || clearance === CLEARANCE_SOLD_OUT_QUANTITY)
  ) {
    order.status = 'OUT_OF_STOCK'
    order.failureReason = 'CLEARANCE_SOLD_OUT'
    order.availableQuantity = 2
    order.clearanceAvailableQuantity = 0
    return
  }
  const product = products[order.productId]
  if (!product) {
    order.status = 'OUT_OF_STOCK'
    order.failureReason = 'OUT_OF_STOCK'
    return
  }
  order.status = 'PAYMENT_WAITING'
  order.productName = product.name
  order.unitPrice = product.price
  const clearancePrice = clearancePriceOf(product.price)
  const regular = order.quantity - clearance
  order.lines = [
    ...(clearance > 0
      ? [
          {
            clearance: true,
            quantity: clearance,
            unitPrice: clearancePrice,
            amount: clearancePrice * clearance,
          },
        ]
      : []),
    ...(regular > 0
      ? [
          {
            clearance: false,
            quantity: regular,
            unitPrice: product.price,
            amount: product.price * regular,
          },
        ]
      : []),
  ]
  order.amount = order.lines.reduce((sum, line) => sum + line.amount, 0)
  order.paymentExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  // 마감세일이 섞이면 당일 픽업 (오늘 23:59:59)
  order.pickupDeadline = pickupDeadline(clearance > 0 ? 0 : 2)
}

function publicOrder({
  createdMs: _c,
  paymentKey: _p,
  cancelRequestedAt: _r,
  ...order
}: MockOrder): Order {
  return order
}

/**
 * 구분마다 줄이 있고 10개씩 보면 페이지가 넘어가도록 미리 넣어 두는 주문.
 * [몇 시간 전 주문, 상태, 상품, 수량]. 픽업 대기는 기한이 남아 있고, 기한 경과는 기한이 지났다
 */
type Seed = [
  hoursAgo: number,
  status: OrderStatus,
  productId: number,
  quantity: number,
  refundStatus?: RefundStatus,
  requestedBy?: CancelRequester,
]
const SEED: Seed[] = [
  [1, 'PAID', 1, 2],
  [3, 'READY_FOR_PICKUP', 2, 1],
  [5, 'PAID', 3, 1],
  [8, 'PAID', 1, 1],
  [20, 'READY_FOR_PICKUP', 2, 3],
  [22, 'PAID', 3, 2],
  [26, 'PAID', 1, 4],
  [30, 'PAID', 2, 2],
  [44, 'PAID', 3, 1],
  [48, 'PAID', 1, 2],
  [52, 'PAID', 2, 1],
  [70, 'PAID', 3, 3],
  // 취소·환불 구분 예시: [몇 시간 전, 상태, 상품, 수량, 환불 상태, 요청자]
  [6, 'PAID', 2, 2, 'FAILED', 'CUSTOMER'],
  [12, 'PAID', 1, 1, 'CHECKING', 'OWNER'],
  [40, 'REFUNDED', 3, 1, 'COMPLETED', 'CUSTOMER'],
  [60, 'CANCELED', 1, 2],
  [28, 'EXPIRED', 1, 1],
  [34, 'PICKED_UP', 2, 2],
  [50, 'PICKED_UP', 1, 1],
  [75, 'PICKED_UP', 3, 2],
  [80, 'OUT_OF_STOCK', 2, 5],
  [96, 'PICKED_UP', 2, 1],
  [100, 'EXPIRED', 3, 1],
  [120, 'PICKUP_EXPIRED', 1, 2],
  [125, 'PICKED_UP', 1, 3],
  [140, 'PAYMENT_FAILED', 3, 1],
  [150, 'PICKED_UP', 3, 1],
  [170, 'PICKUP_EXPIRED', 2, 1],
  [190, 'PICKED_UP', 2, 4],
  [200, 'EXPIRED', 2, 2],
  [220, 'PICKED_UP', 1, 1],
  [250, 'PICKUP_EXPIRED', 3, 2],
  [280, 'PICKED_UP', 3, 1],
  [300, 'PICKUP_EXPIRED', 1, 1],
]

function seedOrder(
  hoursAgo: number,
  status: OrderStatus,
  productId: number,
  quantity: number,
  refundStatus: RefundStatus = 'NONE',
  requestedBy: CancelRequester = 'CUSTOMER',
) {
  const id = nextOrderId++
  const product = products[productId]
  const createdMs = Date.now() - hoursAgo * HOUR
  const paid =
    status === 'PAID' ||
    status === 'READY_FOR_PICKUP' ||
    status === 'PICKED_UP' ||
    status === 'PICKUP_EXPIRED' ||
    status === 'REFUNDED'
  const paidAt = paid ? kstIso(createdMs + 2 * 60_000) : null
  // 픽업 대기는 앞으로 1~3일, 나머지는 주문일 다음 날 (기한 경과는 이미 지났다)
  const deadline =
    status === 'PAID' || status === 'READY_FOR_PICKUP'
      ? pickupDeadline(1 + (id % 3))
      : `${kstDate(createdMs + DAY)}T23:59:59+09:00`
  const failureReason =
    status === 'OUT_OF_STOCK'
      ? 'OUT_OF_STOCK'
      : status === 'PAYMENT_FAILED'
        ? 'PAYMENT_FAILED'
        : status === 'EXPIRED'
          ? id % 2 === 0
            ? 'PICKUP_DEADLINE'
            : 'EXPIRED'
          : null
  const stocked = status !== 'OUT_OF_STOCK'
  const requestedMs = createdMs + HOUR
  const reason: CancelReasonCode = requestedBy === 'CUSTOMER' ? 'CHANGE_OF_MIND' : 'OUT_OF_STOCK'
  const refund =
    refundStatus === 'NONE'
      ? null
      : {
          requestedBy,
          reason,
          reasonLabel: reasonLabel(requestedBy, reason),
          reasonDetail: null,
          refundAmount: product.price * quantity,
          status: refundStatus,
          requestedAt: kstIso(requestedMs),
          canceledAt: refundStatus === 'COMPLETED' ? kstIso(requestedMs + 5_000) : null,
        }
  orders.set(id, {
    orderId: id,
    orderNo: orderNo(id, createdMs),
    status,
    failureReason,
    storeId: 1,
    storeName: '프레시 강남점',
    productId,
    productName: stocked ? product.name : null,
    quantity,
    unitPrice: stocked ? product.price : null,
    amount: stocked ? product.price * quantity : null,
    paymentExpiresAt: stocked ? kstIso(createdMs + 10 * 60_000) : null,
    paidAt,
    createdAt: kstIso(createdMs),
    pickupDeadline: stocked ? deadline : null,
    pickedUpAt: status === 'PICKED_UP' ? kstIso(createdMs + 3 * HOUR) : null,
    // 짝수 주문은 영수증 주소가 없는 경우를 흉내 낸다 (결제 승인과 같은 규칙)
    payment: paid
      ? {
          method: id % 3 === 0 ? '간편결제' : '카드',
          approvedAt: paidAt,
          status: 'DONE',
          receiptUrl:
            id % 2 === 0
              ? null
              : `https://dashboard.tosspayments.com/receipt/redirection?transactionId=mock-${id}`,
        }
      : null,
    refundStatus,
    refund,
    serverTime: kstIso(Date.now()),
    createdMs,
    cancelRequestedAt: refund ? refund.requestedAt : null,
  })
}

function reasonLabel(requester: CancelRequester, reason: CancelReasonCode) {
  const list = requester === 'CUSTOMER' ? CUSTOMER_CANCEL_REASONS : OWNER_CANCEL_REASONS
  return list.find((r) => r.code === reason)?.label ?? reason
}

/**
 * 선착순 대기열 (오픈런 문서 2장). 가짜 상품 중 3번(샌드위치 햄치즈)만 선착순이다 (handlers.ts firstCome 과 같다).
 * 줄을 서면 앞에 3명이 있고, 순번을 읽을 때마다 한 명씩 줄어 0명이 되면 입장권(5분)을 준다. 남은 수량은 2개
 */
const FIRST_COME_PRODUCTS = new Map<number, number>([[3, 2]])
const FAKE_AHEAD = 3
interface FakeQueueEntry {
  ahead: number
  inQueue: boolean
  ticketExpiresMs: number | null
}
const fakeQueues = new Map<string, FakeQueueEntry>()

/** 가짜 대기열을 비운다 (테스트용) */
export function resetQueues() {
  fakeQueues.clear()
}

/** 가짜 주문을 처음 상태로 되돌린다 (테스트용) */
export function resetOrders() {
  resetQueues()
  orders.clear()
  orderIdByKey.clear()
  nextOrderId = 1
  for (const seed of SEED) seedOrder(...seed)
}
resetOrders()

const AWAITING_PICKUP: readonly OrderStatus[] = ['PAID', 'READY_FOR_PICKUP']

/**
 * 결제 완료·준비 완료 주문은 환불 상태로 나눈다 (order-service CustomerOrderTab·OwnerOrderTab 과 같다).
 * 환불 없음은 픽업 대기, 환불 처리·확인·실패는 취소·환불 구분이다
 */
function inTab(o: MockOrder, statuses: readonly OrderStatus[], canceledTab: boolean) {
  if (!statuses.includes(o.status)) return false
  if (!AWAITING_PICKUP.includes(o.status)) return true
  return canceledTab ? hasRefundStarted(o.refundStatus) : o.refundStatus === 'NONE'
}

/** A3 구분별 상태 (order-service CustomerOrderTab 과 같다). OUT_OF_STOCK·PAYMENT_FAILED 는 어디에도 없다 */
const CUSTOMER_TABS: Record<CustomerOrderTab, readonly OrderStatus[]> = {
  PICKUP_WAITING: AWAITING_PICKUP,
  PICKED_UP: ['PICKED_UP'],
  CANCELED: ['EXPIRED', 'CANCELED', 'REFUNDED', 'PAID'],
  ALL: [
    'RESERVING',
    'PAYMENT_WAITING',
    'PAYMENT_APPROVING',
    'PAID',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'EXPIRED',
    'PICKUP_EXPIRED',
    'CANCELED',
    'REFUNDED',
  ],
}

/** A6 구분별 상태와 정렬 기준 (order-service OwnerOrderTab 과 같다) */
const OWNER_TABS: Record<
  OwnerOrderTab,
  { statuses: readonly OrderStatus[]; sortBy: (o: MockOrder) => string }
> = {
  PICKUP_WAITING: { statuses: ['PAID', 'READY_FOR_PICKUP'], sortBy: (o) => o.paidAt ?? '' },
  PICKED_UP: { statuses: ['PICKED_UP'], sortBy: (o) => o.pickedUpAt ?? '' },
  CANCELED: {
    statuses: ['PAID', 'REFUNDED'],
    sortBy: (o) => o.cancelRequestedAt ?? '',
  },
  PICKUP_EXPIRED: { statuses: ['PICKUP_EXPIRED'], sortBy: (o) => o.pickupDeadline ?? '' },
}

const PAGE_SIZES = [10, 20, 50]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validationError(message: string) {
  return HttpResponse.json({ code: 'VALIDATION_ERROR', message }, { status: 400 })
}

interface ListParams<T extends string> {
  tab: T
  page: number
  size: number
  /** 주문일(KST) 이 범위 안인지 */
  inPeriod(o: MockOrder): boolean
}

/** OR-06·OR-04 tab 쿼리를 서버처럼 읽는다. 틀리면 400 응답을 돌려준다 */
function readListParams<T extends string>(
  url: URL,
  tabs: readonly T[],
  defaultTab: T | null,
): ListParams<T> | Response {
  const rawTab = url.searchParams.get('tab') ?? defaultTab
  const tab = tabs.find((t) => t === rawTab)
  if (!tab) return validationError('tab: 알 수 없는 구분입니다')
  const page = Number(url.searchParams.get('page') ?? '0')
  if (!Number.isInteger(page) || page < 0) return validationError('page: 0 이상이어야 합니다')
  const size = Number(url.searchParams.get('size') ?? '20')
  if (!PAGE_SIZES.includes(size)) return validationError('size: 10, 20, 50 중 하나여야 합니다')
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  if (from && !DATE_PATTERN.test(from)) return validationError('from: yyyy-MM-dd 형식이어야 합니다')
  if (to && !DATE_PATTERN.test(to)) return validationError('to: yyyy-MM-dd 형식이어야 합니다')
  if (from && to && from > to) return validationError('from: to보다 늦을 수 없습니다')
  return {
    tab,
    page,
    size,
    inPeriod: (o) => {
      const day = kstDate(Date.parse(o.createdAt))
      return (!from || day >= from) && (!to || day <= to)
    },
  }
}

function toPage<T>(items: T[], page: number, size: number): OrderPage<T> {
  return {
    content: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  }
}

/** 최신순, 같으면 주문 ID 큰 순 */
function newestFirst(key: (o: MockOrder) => string) {
  return (a: MockOrder, b: MockOrder) => key(b).localeCompare(key(a)) || b.orderId - a.orderId
}

function ownerOrder(o: MockOrder): OwnerOrder {
  return {
    orderId: o.orderId,
    orderNo: o.orderNo,
    status: o.status,
    productName: o.productName ?? '',
    quantity: o.quantity,
    clearanceQuantity: o.clearanceQuantity ?? 0,
    amount: o.amount ?? 0,
    lines: o.lines ?? [],
    paidAt: o.paidAt ?? '',
    pickupDeadline: o.pickupDeadline,
    pickedUpAt: o.pickedUpAt,
    payment: o.payment,
    refundStatus: o.refundStatus,
    cancelRequestedAt: o.cancelRequestedAt ?? null,
    refund: o.refund,
  }
}

function customerOrder(o: MockOrder): CustomerOrderSummary {
  return {
    orderId: o.orderId,
    orderNo: o.orderNo,
    status: o.status,
    failureReason: o.failureReason,
    storeName: o.storeName,
    productName: o.productName,
    quantity: o.quantity,
    clearanceQuantity: o.clearanceQuantity ?? 0,
    amount: o.amount,
    lines: o.lines ?? [],
    createdAt: o.createdAt,
    pickupDeadline: o.pickupDeadline,
    refundStatus: o.refundStatus,
  }
}

function queueStatus(
  storeId: number,
  productId: number,
  entry: FakeQueueEntry | undefined,
): QueueStatusResponse {
  const remaining = FIRST_COME_PRODUCTS.get(productId) ?? null
  const base = {
    storeId,
    productId,
    position: null,
    ahead: null,
    waiting: entry?.inQueue ? entry.ahead + 1 : 0,
    remaining,
    ticketExpiresAt: null,
    serverTime: kstIso(Date.now()),
  }
  if (entry?.ticketExpiresMs) {
    return { ...base, status: 'ADMITTED', ticketExpiresAt: kstIso(entry.ticketExpiresMs) }
  }
  if (!entry?.inQueue) return { ...base, status: 'NOT_IN_QUEUE' }
  return { ...base, status: 'WAITING', position: entry.ahead + 1, ahead: entry.ahead }
}

function notFirstCome() {
  return HttpResponse.json(
    { code: 'NOT_FIRST_COME', message: '선착순 상품이 아닙니다' },
    { status: 404 },
  )
}

const queueHandlers = [
  http.post('/api/orders/queue/:productId', ({ params, request }) => {
    const productId = Number(params.productId)
    const storeId = Number(new URL(request.url).searchParams.get('storeId'))
    if (!FIRST_COME_PRODUCTS.has(productId)) return notFirstCome()
    const key = `${storeId}:${productId}`
    const entry = fakeQueues.get(key)
    if (!entry || (!entry.inQueue && !entry.ticketExpiresMs)) {
      fakeQueues.set(key, { ahead: FAKE_AHEAD, inQueue: true, ticketExpiresMs: null })
    }
    return HttpResponse.json(queueStatus(storeId, productId, fakeQueues.get(key)))
  }),
  http.get('/api/orders/queue/:productId/me', ({ params, request }) => {
    const productId = Number(params.productId)
    const storeId = Number(new URL(request.url).searchParams.get('storeId'))
    if (!FIRST_COME_PRODUCTS.has(productId)) return notFirstCome()
    const entry = fakeQueues.get(`${storeId}:${productId}`)
    if (entry?.inQueue) {
      if (entry.ahead > 0) {
        entry.ahead -= 1
      } else {
        entry.inQueue = false
        entry.ticketExpiresMs = Date.now() + 5 * 60_000
      }
    }
    return HttpResponse.json(queueStatus(storeId, productId, entry))
  }),
  http.delete('/api/orders/queue/:productId/me', ({ params, request }) => {
    const productId = Number(params.productId)
    const storeId = Number(new URL(request.url).searchParams.get('storeId'))
    const entry = fakeQueues.get(`${storeId}:${productId}`)
    if (entry) entry.inQueue = false
    return new HttpResponse(null, { status: 204 })
  }),
]

export const orderHandlers = [
  ...queueHandlers,
  http.post('/api/orders', async ({ request }) => {
    const key = request.headers.get('Idempotency-Key')
    if (!key) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Idempotency-Key' },
        { status: 400 },
      )
    }
    const req = (await request.json()) as CreateOrderRequest
    const clearance = req.clearanceQuantity ?? 0
    if (clearance > req.quantity || clearance < 0) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'clearanceQuantityWithinQuantity: 전체 수량 이하여야 합니다',
        },
        { status: 400 },
      )
    }
    if (clearance > 0 && !clearanceOnSale()) {
      return HttpResponse.json(
        { code: 'CLEARANCE_NOT_ON_SALE', message: '마감세일은 06:00~23:00에만 살 수 있어요' },
        { status: 400 },
      )
    }
    const existing = orderIdByKey.get(key)
    if (existing !== undefined) {
      const o = orders.get(existing)!
      if (
        o.productId !== req.productId ||
        o.quantity !== req.quantity ||
        (o.clearanceQuantity ?? 0) !== clearance ||
        o.storeId !== req.storeId
      ) {
        return HttpResponse.json({ code: 'IDEMPOTENCY_KEY_REUSED', message: '' }, { status: 409 })
      }
      const body: CreateOrderResponse = { orderId: o.orderId, orderNo: o.orderNo, status: o.status }
      return HttpResponse.json(body)
    }
    const id = nextOrderId++
    const now = new Date()
    orders.set(id, {
      orderId: id,
      orderNo: orderNo(id),
      status: 'RESERVING',
      failureReason: null,
      storeId: req.storeId,
      storeName: req.storeName,
      productId: req.productId,
      productName: null,
      quantity: req.quantity,
      clearanceQuantity: clearance,
      unitPrice: null,
      amount: null,
      lines: [],
      availableQuantity: null,
      clearanceAvailableQuantity: null,
      paymentExpiresAt: null,
      paidAt: null,
      createdAt: kstIso(now.getTime()),
      pickupDeadline: null,
      pickedUpAt: null,
      payment: null,
      refundStatus: 'NONE',
      refund: null,
      serverTime: now.toISOString(),
      createdMs: now.getTime(),
    })
    orderIdByKey.set(key, id)
    const body: CreateOrderResponse = { orderId: id, orderNo: orderNo(id), status: 'RESERVING' }
    return HttpResponse.json(body, { status: 201 })
  }),
  // OR-06 고객 주문 내역 (A3): 구분·기간으로 거르고 주문일시 최신순
  http.get('/api/orders', ({ request }) => {
    const q = readListParams(
      new URL(request.url),
      Object.keys(CUSTOMER_TABS) as CustomerOrderTab[],
      'ALL',
    )
    if (q instanceof Response) return q
    const statuses = CUSTOMER_TABS[q.tab]
    for (const o of orders.values()) advance(o)
    const rows = [...orders.values()]
      .filter(
        (o) =>
          (q.tab === 'ALL'
            ? statuses.includes(o.status)
            : inTab(o, statuses, q.tab === 'CANCELED')) && q.inPeriod(o),
      )
      .sort(newestFirst((o) => o.createdAt))
      .map(customerOrder)
    return HttpResponse.json(toPage(rows, q.page, q.size))
  }),
  http.get('/api/orders/:orderId', ({ params }) => {
    const o = orders.get(Number(params.orderId))
    if (!o)
      return HttpResponse.json(
        { code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' },
        { status: 404 },
      )
    advance(o)
    return HttpResponse.json({ ...publicOrder(o), serverTime: new Date().toISOString() })
  }),
  http.post('/api/orders/:orderId/payment/confirm', async ({ params, request }) => {
    const o = orders.get(Number(params.orderId))
    if (!o)
      return HttpResponse.json(
        { code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' },
        { status: 404 },
      )
    const req = (await request.json()) as ConfirmPaymentRequest
    if (req.orderNo !== o.orderNo) {
      return HttpResponse.json({ code: 'ORDER_NO_MISMATCH', message: '' }, { status: 400 })
    }
    if (req.amount !== o.amount) {
      return HttpResponse.json({ code: 'PAYMENT_AMOUNT_MISMATCH', message: '' }, { status: 400 })
    }
    if (
      o.status === 'PAYMENT_WAITING' &&
      o.pickupDeadline &&
      Date.now() > Date.parse(o.pickupDeadline)
    ) {
      // 결제 시간이 남아도 픽업 기한이 지나면 막는다 (OR-03 6-1)
      o.status = 'EXPIRED'
      o.failureReason = 'PICKUP_DEADLINE'
      return HttpResponse.json({ code: 'PICKUP_DEADLINE_PASSED', message: '' }, { status: 409 })
    }
    if (o.status === 'PAYMENT_WAITING') {
      o.status = 'PAID'
      o.paidAt = kstIso(Date.now())
      o.paymentKey = req.paymentKey
      // 짝수 주문은 영수증 주소가 없는 경우를 흉내 낸다 (결제는 그대로 완료)
      o.payment = {
        method: '카드',
        approvedAt: o.paidAt,
        status: 'DONE',
        receiptUrl:
          o.orderId % 2 === 0
            ? null
            : `https://dashboard.tosspayments.com/receipt/redirection?transactionId=mock-${o.orderId}`,
      }
    } else if (o.paymentKey !== req.paymentKey) {
      return HttpResponse.json({ code: 'ORDER_NOT_PAYABLE', message: '' }, { status: 409 })
    }
    const body: ConfirmPaymentResponse = {
      orderId: o.orderId,
      orderNo: o.orderNo,
      status: o.status,
      storeName: o.storeName,
      productName: o.productName,
      quantity: o.quantity,
      amount: o.amount,
      paidAt: o.paidAt,
    }
    return HttpResponse.json(body)
  }),
  // OR-04 점주 주문 목록: tab 이 없으면 MVP 그대로 결제 완료 주문 배열, 있으면 A6 구분별 페이지
  http.get('/api/owner/orders', ({ request }) => {
    const url = new URL(request.url)
    if (!url.searchParams.has('tab')) {
      const paid = [...orders.values()]
        .filter((o) => inTab(o, AWAITING_PICKUP, false))
        .sort(newestFirst((o) => o.paidAt ?? ''))
        .map(ownerOrder)
      return HttpResponse.json(paid)
    }
    const q = readListParams(url, Object.keys(OWNER_TABS) as OwnerOrderTab[], null)
    if (q instanceof Response) return q
    const { statuses, sortBy } = OWNER_TABS[q.tab]
    const rows = [...orders.values()]
      .filter((o) => inTab(o, statuses, q.tab === 'CANCELED') && q.inPeriod(o))
      .sort(newestFirst(sortBy))
      .map(ownerOrder)
    return HttpResponse.json(toPage(rows, q.page, q.size))
  }),
  // N-02 픽업 준비 완료 (가짜 로그인 점주는 점포 확인을 하지 않는다). 이미 준비 완료면 그대로 200
  http.post('/api/owner/orders/:orderId/ready', ({ params }) => {
    const o = orders.get(Number(params.orderId))
    if (!o)
      return HttpResponse.json(
        { code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' },
        { status: 404 },
      )
    if (o.status !== 'PAID' && o.status !== 'READY_FOR_PICKUP') {
      return HttpResponse.json(
        { code: 'ORDER_NOT_READYABLE', message: '픽업 준비 완료로 바꿀 수 없는 주문입니다' },
        { status: 409 },
      )
    }
    if (o.pickupDeadline && Date.now() > Date.parse(o.pickupDeadline)) {
      return HttpResponse.json(
        { code: 'PICKUP_DEADLINE_PASSED', message: '픽업 기한이 지난 주문입니다' },
        { status: 409 },
      )
    }
    o.status = 'READY_FOR_PICKUP'
    const body: ReadyResponse = {
      orderId: o.orderId,
      orderNo: o.orderNo,
      status: o.status,
      pickedUpAt: null,
    }
    return HttpResponse.json(body)
  }),
  // OR-05 픽업 확인 (가짜 로그인 점주는 점포 확인을 하지 않는다). 픽업 준비 완료를 먼저 거친다 (N-02)
  http.post('/api/owner/orders/:orderId/pickup', ({ params }) => {
    const o = orders.get(Number(params.orderId))
    if (!o)
      return HttpResponse.json(
        { code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' },
        { status: 404 },
      )
    if (o.status !== 'READY_FOR_PICKUP') {
      return HttpResponse.json(
        { code: 'ORDER_NOT_PICKABLE', message: '픽업할 수 없는 주문입니다' },
        { status: 409 },
      )
    }
    if (o.pickupDeadline && Date.now() > Date.parse(o.pickupDeadline)) {
      return HttpResponse.json(
        { code: 'PICKUP_DEADLINE_PASSED', message: '픽업 기한이 지난 주문입니다' },
        { status: 409 },
      )
    }
    o.status = 'PICKED_UP'
    o.pickedUpAt = kstIso(Date.now())
    const body: PickupResponse = {
      orderId: o.orderId,
      orderNo: o.orderNo,
      status: o.status,
      pickedUpAt: o.pickedUpAt,
    }
    return HttpResponse.json(body)
  }),
  // A7 결제 전 취소: 결제 대기 주문만, 사유 없이. 환불금액 0원
  http.post('/api/orders/:orderId/payment/cancel', ({ params }) => {
    const o = orders.get(Number(params.orderId))
    if (!o) return notFound()
    advance(o)
    if (o.status === 'CANCELED') return HttpResponse.json(publicOrder(o))
    if (o.status === 'EXPIRED') return conflict('ORDER_EXPIRED', '결제 시간이 지난 주문입니다')
    if (o.status !== 'PAYMENT_WAITING') {
      return conflict('ORDER_NOT_CANCELABLE', '취소할 수 없는 주문입니다')
    }
    o.status = 'CANCELED'
    return HttpResponse.json({ ...publicOrder(o), serverTime: new Date().toISOString() })
  }),
  // A8 고객 결제 후 취소·환불 다시 신청
  http.post('/api/orders/:orderId/cancel', async ({ params, request }) =>
    cancelPaid(Number(params.orderId), 'CUSTOMER', (await request.json()) as CancelOrderRequest),
  ),
  // A8 점주 결제 후 취소·환불 재시도 (가짜 로그인 점주는 점포 확인을 하지 않는다)
  http.post('/api/owner/orders/:orderId/cancel', async ({ params, request }) =>
    cancelPaid(Number(params.orderId), 'OWNER', (await request.json()) as CancelOrderRequest),
  ),
]

function notFound() {
  return HttpResponse.json({ code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' }, { status: 404 })
}

function conflict(code: string, message: string) {
  return HttpResponse.json({ code, message }, { status: 409 })
}

/**
 * A8 결제 후 취소를 흉내 낸다. 수량 4개 이상 주문은 토스 환불 실패(FAILED)로 끝나 [환불 다시 신청]을 볼 수 있다.
 * 나머지는 바로 환불 완료(REFUNDED)다 (진짜는 토스 전액 취소 + 재고 RETURN)
 */
function cancelPaid(orderId: number, requester: CancelRequester, req: CancelOrderRequest) {
  const o = orders.get(orderId)
  if (!o) return notFound()
  const reasons = requester === 'CUSTOMER' ? CUSTOMER_CANCEL_REASONS : OWNER_CANCEL_REASONS
  if (!reasons.some((r) => r.code === req.reason)) {
    return validationError('reason: 고를 수 있는 취소 사유가 아닙니다')
  }
  const detail = req.reasonDetail?.trim() ?? ''
  if (req.reason === 'ETC' && !detail)
    return validationError('reasonDetail: 기타 사유를 입력해 주세요')
  if (o.refundStatus === 'REQUESTED' || o.refundStatus === 'CHECKING') {
    return conflict('REFUND_IN_PROGRESS', '환불을 처리하고 있습니다')
  }
  // 준비 완료 주문은 취소를 받지 않는다 (order-service Order.canStartRefund: 결제 완료만)
  const startable =
    o.status === 'PAID' && (o.refundStatus === 'NONE' || o.refundStatus === 'FAILED')
  if (!startable) return conflict('ORDER_NOT_CANCELABLE', '취소할 수 없는 주문입니다')
  if (o.refundStatus === 'NONE' && o.pickupDeadline && Date.now() > Date.parse(o.pickupDeadline)) {
    return conflict('PICKUP_DEADLINE_PASSED', '픽업 기한이 지난 주문입니다')
  }
  const now = Date.now()
  const failed = o.quantity >= 4 && o.refundStatus === 'NONE'
  const status: RefundStatus = failed ? 'FAILED' : 'COMPLETED'
  o.refundStatus = status
  o.cancelRequestedAt = kstIso(now)
  o.refund = {
    requestedBy: requester,
    reason: req.reason,
    reasonLabel: reasonLabel(requester, req.reason),
    reasonDetail: req.reason === 'ETC' ? detail : null,
    refundAmount: o.amount ?? 0,
    status,
    requestedAt: kstIso(now),
    canceledAt: failed ? null : kstIso(now + 1_000),
  }
  if (!failed) o.status = 'REFUNDED'
  const body: CancelOrderResponse = {
    orderId: o.orderId,
    orderNo: o.orderNo,
    status: o.status,
    refundStatus: o.refundStatus,
    refund: o.refund,
  }
  return HttpResponse.json(body)
}
