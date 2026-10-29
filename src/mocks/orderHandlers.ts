import { http, HttpResponse } from 'msw'
import type {
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  Order,
} from '@/customer/order/api'
import type { OwnerOrder, PickupResponse } from '@/owner/orders/api'

/** order-service 가짜 API (김경우): OR-01~03 고객 주문·결제, OR-04 점주 신규 주문, OR-05 픽업 확인 */
// 상품 999 는 재고 부족으로 끝나는 주문을 흉내 낸다
const products: Record<number, { name: string; price: number }> = {
  1: { name: '삼각김밥 참치마요', price: 1500 },
  2: { name: '바나나우유', price: 1700 },
  3: { name: '샌드위치 햄치즈', price: 3200 },
}
const orders = new Map<number, Order & { createdMs: number; paymentKey?: string }>()
const orderIdByKey = new Map<string, number>()
let nextOrderId = 1

function orderNo(id: number) {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `FL-${day}-${String(id).padStart(6, '0')}`
}

/** 픽업 기한: 오늘부터 days 일 뒤 그날 23:59:59 KST (진짜는 lot 유통기한 중 가장 빠른 날) */
function pickupDeadline(days: number) {
  const kstDate = new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return `${kstDate}T23:59:59+09:00`
}

/** 진짜처럼 1.5초 뒤 재고 결과(RESERVED·RESERVE_FAILED)가 온 것으로 본다 */
function advance(order: Order & { createdMs: number }) {
  if (order.status !== 'RESERVING' || Date.now() - order.createdMs < 1500) return
  const product = products[order.productId]
  if (!product) {
    order.status = 'OUT_OF_STOCK'
    order.failureReason = 'OUT_OF_STOCK'
    return
  }
  order.status = 'PAYMENT_WAITING'
  order.productName = product.name
  order.unitPrice = product.price
  order.amount = product.price * order.quantity
  order.paymentExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  order.pickupDeadline = pickupDeadline(2)
}

function publicOrder({
  createdMs: _c,
  paymentKey: _p,
  ...order
}: Order & { createdMs: number; paymentKey?: string }): Order {
  return order
}

export const orderHandlers = [
  http.post('/api/orders', async ({ request }) => {
    const key = request.headers.get('Idempotency-Key')
    if (!key) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Idempotency-Key' },
        { status: 400 },
      )
    }
    const req = (await request.json()) as CreateOrderRequest
    const existing = orderIdByKey.get(key)
    if (existing !== undefined) {
      const o = orders.get(existing)!
      if (
        o.productId !== req.productId ||
        o.quantity !== req.quantity ||
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
      unitPrice: null,
      amount: null,
      paymentExpiresAt: null,
      paidAt: null,
      createdAt: now.toISOString(),
      pickupDeadline: null,
      pickedUpAt: null,
      payment: null,
      serverTime: now.toISOString(),
      createdMs: now.getTime(),
    })
    orderIdByKey.set(key, id)
    const body: CreateOrderResponse = { orderId: id, orderNo: orderNo(id), status: 'RESERVING' }
    return HttpResponse.json(body, { status: 201 })
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
      o.paidAt = new Date().toISOString()
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
  http.get('/api/owner/orders', () => {
    const paid: OwnerOrder[] = [...orders.values()]
      .filter((o) => o.status === 'PAID' && o.paidAt && o.productName && o.amount !== null)
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
      .map((o) => ({
        orderId: o.orderId,
        orderNo: o.orderNo,
        productName: o.productName ?? '',
        quantity: o.quantity,
        amount: o.amount ?? 0,
        paidAt: o.paidAt ?? '',
        pickupDeadline: o.pickupDeadline,
        payment: o.payment,
      }))
    return HttpResponse.json(paid)
  }),
  // OR-05 픽업 확인 (가짜 로그인 점주는 점포 확인을 하지 않는다)
  http.post('/api/owner/orders/:orderId/pickup', ({ params }) => {
    const o = orders.get(Number(params.orderId))
    if (!o)
      return HttpResponse.json(
        { code: 'ORDER_NOT_FOUND', message: '주문이 없습니다' },
        { status: 404 },
      )
    if (o.status !== 'PAID') {
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
    o.pickedUpAt = new Date().toISOString()
    const body: PickupResponse = {
      orderId: o.orderId,
      orderNo: o.orderNo,
      status: o.status,
      pickedUpAt: o.pickedUpAt,
    }
    return HttpResponse.json(body)
  }),
]
