import type { StoreProduct } from './api'

/** 상세 아래에 보여 줄 비슷한 상품 수 */
export const SIMILAR_PRODUCT_COUNT = 4

/** 비슷한 상품: 같은 카테고리 목록에서 지금 보는 상품과 품절을 빼고 앞에서 count 개(목록 순서 그대로) */
export function similarProducts(
  products: StoreProduct[] | undefined,
  productId: number,
  count: number = SIMILAR_PRODUCT_COUNT,
): StoreProduct[] {
  // 아직 안 읽었거나 응답이 목록 모양이 아니면 보여 줄 것이 없다
  if (!Array.isArray(products)) return []
  return products.filter((p) => p.productId !== productId && !p.soldOut).slice(0, count)
}
