import type { ConfirmPaymentRequest } from './api'

/** 한 번에 살 수 있는 수량 (OR-01 quantity 1~5) */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 5

/** 상품 화면(U-10)에서 선착순 대기 화면으로 넘기는 값. 차례가 오면 대기 화면이 이 값으로 주문을 만든다 */
export interface CheckoutItem {
  storeId: number
  storeName: string
  productId: number
  productName: string
  /** 표시용 단가. 실제 금액은 서버가 정한다 (OR-02 amount) */
  price: number
  /** 구매 가능 수량. 알면 넘긴다 */
  available?: number
  /** 상품 이미지 주소. 있으면 넘긴다 */
  imageUrl?: string
}

/** 상품 상세 주소 (/customer/stores/:storeId/products/:productId) */
export function productPath(item: Pick<CheckoutItem, 'storeId' | 'productId'>): string {
  return `/customer/stores/${item.storeId}/products/${item.productId}`
}

/**
 * 대기 화면 주소에 붙이는 쿼리. 새로 고침해도 남도록 쿼리에 담는다 (개인 정보 없음).
 * 대기 화면은 parseCheckout 으로 읽는다
 */
export function checkoutQuery(item: CheckoutItem): string {
  const q = new URLSearchParams({
    storeId: String(item.storeId),
    storeName: item.storeName,
    productId: String(item.productId),
    productName: item.productName,
    price: String(item.price),
  })
  if (item.available !== undefined) q.set('available', String(item.available))
  if (item.imageUrl) q.set('imageUrl', item.imageUrl)
  return q.toString()
}

function nonNegativeInt(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined
}

function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n > 0 ? n : undefined
}

export function parseCheckout(q: URLSearchParams): CheckoutItem | null {
  const storeId = positiveInt(q.get('storeId'))
  const productId = positiveInt(q.get('productId'))
  const price = positiveInt(q.get('price'))
  const storeName = q.get('storeName')?.trim()
  const productName = q.get('productName')?.trim()
  if (!storeId || !productId || !price || !storeName || !productName) return null

  const available = nonNegativeInt(q.get('available'))
  return {
    storeId,
    storeName,
    productId,
    productName,
    price,
    ...(available !== undefined && { available }),
  }
}

export function clampQuantity(quantity: number, available?: number): number {
  const max = available === undefined ? MAX_QUANTITY : Math.min(MAX_QUANTITY, available)
  return Math.max(MIN_QUANTITY, Math.min(quantity, Math.max(max, MIN_QUANTITY)))
}

export type TossRedirect =
  { kind: 'success'; confirm: ConfirmPaymentRequest } | { kind: 'fail'; code: string }

/**
 * 토스 결제창이 successUrl·failUrl 로 돌려보낼 때 붙이는 쿼리를 읽는다.
 * 성공: paymentKey·orderId(= 우리 orderNo)·amount, 실패: code·message·orderId
 */
export function parseTossRedirect(q: URLSearchParams): TossRedirect | null {
  const paymentKey = q.get('paymentKey')
  const orderNo = q.get('orderId')
  const amount = positiveInt(q.get('amount'))
  if (paymentKey && orderNo && amount) {
    return { kind: 'success', confirm: { paymentKey, orderNo, amount } }
  }
  const code = q.get('code')
  if (code) return { kind: 'fail', code }
  return null
}

/** 성공·실패 모두 같은 주문 화면으로 돌아온다 (쿼리는 토스가 붙인다) */
export function successUrlFor(orderId: number, origin: string): string {
  return `${origin}/customer/orders/${orderId}`
}
