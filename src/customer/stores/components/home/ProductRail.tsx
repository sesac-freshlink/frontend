import type { UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { ErrorState } from '@/shared/ui/QueryState'
import type { StoreProduct } from '../../api'
import { CLEARANCE_DISCOUNT_PERCENT, clearanceOf } from '../../clearance'
import { CLOCK_TICK_MS, homeRow, remainingText } from '../../homeRows'
import type { ProductShortcut } from '../../pickupStore'

export type RailKind = Extract<ProductShortcut, 'clearance' | 'recommended' | 'new'>

const TITLES: Record<RailKind, { title: string; empty: string }> = {
  clearance: { title: '마감세일', empty: '지금 마감세일 중인 상품이 없어요.' },
  recommended: { title: '점주 추천', empty: '점주가 고른 추천 상품이 아직 없어요.' },
  new: { title: '신상품', empty: '이번 주에 새로 들어온 상품이 없어요.' },
}

/** 지금 시각(1분마다 바뀐다). 마감세일 남은 시간 글자에만 쓴다 */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => window.clearInterval(timer)
  }, [enabled])
  return now
}

/**
 * 홈 ⑥ 상품 줄: 제목 + [전체 보기] + 정사각 사진 카드 가로 스크롤(최대 10개, 거르기는 homeRows).
 * 마감세일 줄은 할인율·할인가·원래 가격·남은 시간·남은 개수를 같이 보여 준다
 */
export function ProductRail({
  kind,
  storeId,
  storeName,
  query,
}: {
  kind: RailKind
  storeId: number
  storeName: string
  query: UseQueryResult<StoreProduct[]>
}) {
  const { title, empty } = TITLES[kind]
  const headingId = `home-rail-${kind}`
  const now = useNow(kind === 'clearance')

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id={headingId} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <Link
          to={`/customer/stores/${storeId}?show=${kind}`}
          state={{ storeName }}
          aria-label={`${title} 전체 보기`}
          className="-mr-2 flex min-h-11 items-center px-2 text-sm font-medium text-slate-600"
        >
          전체 보기
        </Link>
      </div>
      <RailBody
        kind={kind}
        storeId={storeId}
        storeName={storeName}
        query={query}
        now={now}
        empty={empty}
      />
    </section>
  )
}

function RailBody({
  kind,
  storeId,
  storeName,
  query,
  now,
  empty,
}: {
  kind: RailKind
  storeId: number
  storeName: string
  query: UseQueryResult<StoreProduct[]>
  now: number
  empty: string
}) {
  if (query.isPending) {
    return (
      <div role="status" className="flex gap-3 overflow-hidden">
        <span className="sr-only">상품을 불러오는 중</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="size-32 shrink-0 animate-pulse rounded-xl bg-slate-200"
          />
        ))}
      </div>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        className="py-4"
        message="상품을 불러오지 못했어요."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  }
  const rows = homeRow(query.data)
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-slate-600">{empty}</p>
  }
  return (
    <ul className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1">
      {rows.map((p) => (
        <li key={p.productId} className="w-32 shrink-0 snap-start">
          <ProductCard
            product={p}
            storeId={storeId}
            storeName={storeName}
            sale={kind === 'clearance'}
            now={now}
          />
        </li>
      ))}
    </ul>
  )
}

function ProductCard({
  product,
  storeId,
  storeName,
  sale,
  now,
}: {
  product: StoreProduct
  storeId: number
  storeName: string
  sale: boolean
  now: number
}) {
  const clearance = sale ? clearanceOf(product) : null
  const left = clearance ? remainingText(product.clearanceExpiry, now) : null
  return (
    <Link
      to={`/customer/stores/${storeId}/products/${product.productId}`}
      state={{ storeName }}
      className="relative block space-y-1.5"
    >
      <ProductThumb
        src={product.imageUrl}
        name={product.name}
        className={cn('size-32 rounded-xl bg-white', product.soldOut && 'opacity-50')}
      />
      <span className="line-clamp-2 text-sm leading-snug text-slate-900">{product.name}</span>
      {clearance ? (
        <span className="block">
          <span className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-rose-700">{CLEARANCE_DISCOUNT_PERCENT}%</span>
            <span className="text-base font-bold text-slate-900">{formatWon(clearance.price)}</span>
          </span>
          <span className="block text-sm text-slate-600 line-through">
            <span className="sr-only">원래 가격 </span>
            {formatWon(product.price)}
          </span>
          {left && <span className="block text-sm font-medium text-rose-700">{left}</span>}
          <span className="block text-sm text-slate-600">{clearance.quantity}개 남음</span>
        </span>
      ) : (
        <span className="block text-base font-bold text-slate-900">
          {product.soldOut ? (
            <span className="text-sm font-medium text-slate-600">품절</span>
          ) : (
            formatWon(product.price)
          )}
        </span>
      )}
    </Link>
  )
}
