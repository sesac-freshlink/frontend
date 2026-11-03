import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { useStoreProducts } from '../api'
import { similarProducts } from '../similar'
import { ExpiryBadge } from './ExpiryBadge'

/**
 * U-10 상세 아래 "같은 카테고리 상품". 지금 살 수 있는 다른 상품을 추천순으로 앞에서 몇 개 보여 준다.
 * 따로 API 를 만들지 않고 상품 목록 API 에 카테고리 조건을 붙여 읽는다(gateway 경로를 늘리지 않으려고).
 * 품절이면 대신 살 상품이 필요하니 바로 읽고, 팔고 있으면 버튼을 누를 때만 읽는다(상세를 열 때마다 목록까지 읽지 않게).
 * 보여 줄 상품이 없거나 읽지 못하면 아무것도 그리지 않는다
 */
export function SimilarProducts({
  storeId,
  productId,
  category,
  autoOpen,
}: {
  storeId: number
  productId: number
  category: string
  /** true 면 버튼 없이 바로 읽어서 보여 준다(품절일 때) */
  autoOpen: boolean
}) {
  const [opened, setOpened] = useState(autoOpen)
  const products = useStoreProducts(storeId, { category, sort: 'POPULAR' }, { enabled: opened })

  if (!opened) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        같은 카테고리 상품 보기
        <ChevronDown className="size-4" aria-hidden />
      </button>
    )
  }

  const items = similarProducts(products.data, productId)
  if (items.length === 0) {
    return products.isSuccess ? (
      <p className="text-center text-sm text-slate-500">같은 카테고리에 다른 상품이 없어요.</p>
    ) : null
  }

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
