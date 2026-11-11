import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { useStoreProducts } from '../api'
import { similarProducts } from '../similar'
import { ExpiryBadge } from './ExpiryBadge'

/**
 * U-10 상세 아래 "같은 카테고리 상품". 지금 살 수 있는 다른 상품을 추천순으로 앞에서 몇 개 보여 준다.
 * 따로 API 를 만들지 않고 상품 목록 API 에 카테고리 조건을 붙여 읽는다(gateway 경로를 늘리지 않으려고).
 * 버튼 없이 상세를 열 때 바로 읽어 펼쳐 보인다(11/11 경우 결정. 전에는 품절일 때만 바로, 팔고 있으면 버튼을 눌러야 읽었다).
 * 보여 줄 상품이 없거나 아직 못 읽었거나 읽지 못하면 아무것도 그리지 않는다
 */
export function SimilarProducts({
  storeId,
  productId,
  category,
}: {
  storeId: number
  productId: number
  category: string
}) {
  const products = useStoreProducts(storeId, { category, sort: 'POPULAR' })

  const items = similarProducts(products.data, productId)
  if (items.length === 0) return null

  return (
    <section aria-labelledby="similar-title" className="space-y-2">
      <h2 id="similar-title" className="text-sm font-semibold text-slate-900">
        같은 카테고리 상품
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((p) => (
          <li key={p.productId}>
            <Link
              to={`/customer/stores/${storeId}/products/${p.productId}`}
              className="block space-y-1 rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
            >
              <ProductThumb src={p.imageUrl} name={p.name} className="mx-auto size-16" />
              <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-slate-900 tabular-nums">
                  {formatWon(p.price)}
                </span>
                <ExpiryBadge nearestExpiry={p.nearestExpiry} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
