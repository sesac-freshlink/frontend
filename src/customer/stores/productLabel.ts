import { formatWon } from '@/customer/order/format'
import type { StoreProduct } from './api'
import { clearanceOf } from './clearance'
import { expiryBadge } from './expiry'

/**
 * 고객 상품 목록 한 줄을 화면 읽기 프로그램이 읽을 이름. 썸네일 대체 텍스트 때문에 상품명이 두 번 읽히지 않게,
 * "상품명, 가격, 남은 수량, 배지" 순으로 한 번에 읽히도록 링크 이름으로 쓴다
 */
export function productLabel(
  product: Pick<
    StoreProduct,
    | 'name'
    | 'price'
    | 'availableQuantity'
    | 'soldOut'
    | 'recommended'
    | 'newArrival'
    | 'firstCome'
    | 'nearestExpiry'
    | 'clearanceQuantity'
    | 'clearancePrice'
  >,
  now: Date = new Date(),
): string {
  const parts = [
    product.name,
    formatWon(product.price),
    product.soldOut ? '품절' : `${product.availableQuantity}개 남음`,
  ]
  const clearance = clearanceOf(product)
  if (clearance) parts.push(`마감세일 ${formatWon(clearance.price)} ${clearance.quantity}개`)
  const expiry = expiryBadge(product.nearestExpiry, now)
  if (expiry) parts.push(`유통기한 ${expiry.label}`)
  if (product.recommended) parts.push('추천')
  if (product.newArrival) parts.push('신상품')
  if (product.firstCome) parts.push('선착순')
  return parts.join(', ')
}
