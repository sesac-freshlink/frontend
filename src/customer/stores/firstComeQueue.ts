import { checkoutPath, type CheckoutItem } from '@/customer/order/checkout'

/**
 * 선착순 상품의 [구매하기] 목적지: 경우님 대기 화면 `/customer/stores/:storeId/products/:productId/queue`.
 * 쿼리는 주문 화면(checkoutPath)과 같은 값이라, 대기 화면은 parseCheckout 으로 읽고 입장하면 그대로 주문 화면으로 보낼 수 있다
 */
export function queuePath(item: CheckoutItem): string {
  const checkout = checkoutPath(item)
  const query = checkout.slice(checkout.indexOf('?'))
  return `/customer/stores/${item.storeId}/products/${item.productId}/queue${query}`
}
