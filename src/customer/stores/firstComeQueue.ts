import { checkoutQuery, productPath, type CheckoutItem } from '@/customer/order/checkout'

/**
 * 선착순 상품의 [구매하기] 목적지: 경우님 대기 화면 `/customer/stores/:storeId/products/:productId/queue`.
 * 대기 화면은 쿼리를 parseCheckout 으로 읽고, 차례가 오면 그 값으로 1개 주문을 만든다
 */
export function queuePath(item: CheckoutItem): string {
  return `${productPath(item)}/queue?${checkoutQuery(item)}`
}
