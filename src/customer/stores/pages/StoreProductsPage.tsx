import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { checkoutPath } from '@/customer/order/checkout'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { useStoreProducts, type StoreProduct } from '../api'
import { useStoreName } from '../useStoreName'

/**
 * U-10 점포 상품 목록 (/customer/stores/:storeId). 상품 30개를 전부 보여 주고 품절은 흐리게 둔다.
 * 상품을 누르면 주문·결제 화면(U-21)으로 넘어간다. 폴링하지 않고 들어올 때와 새로고침 때만 읽는다
 */
export function StoreProductsPage() {
  const { storeId: raw } = useParams()
  const storeId = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
  if (storeId === undefined) return <BackToHome message="점포 주소가 올바르지 않아요." />
  return <StoreProducts key={storeId} storeId={storeId} />
}

function StoreProducts({ storeId }: { storeId: number }) {
  const storeName = useStoreName(storeId)
  const products = useStoreProducts(storeId)

  return (
    <section className="space-y-4">
      <Link to="/customer" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft className="size-4" />
        점포 찾기
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{storeName ?? '점포 상품'}</h1>
          <p className="text-sm text-slate-500">상품을 고르면 바로 구매로 넘어가요</p>
        </div>
        <button
          type="button"
          onClick={() => void products.refetch()}
          disabled={products.isFetching}
          aria-label="새로고침"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <RefreshCw className={cn('size-5', products.isFetching && 'animate-spin')} />
        </button>
      </div>
      <ProductList products={products} storeId={storeId} storeName={storeName} />
    </section>
  )
}

interface ListProps {
  products: ReturnType<typeof useStoreProducts>
  storeId: number
  storeName: string | undefined
}

function ProductList({ products, storeId, storeName }: ListProps) {
  if (products.isPending) {
    return (
      <div className="flex justify-center py-10 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (products.isError) {
    return (
      <div className="space-y-2 py-10 text-center">
        <p className="text-sm text-red-600">상품을 불러오지 못했어요.</p>
        <button
          type="button"
          onClick={() => void products.refetch()}
          className="text-sm text-slate-500 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }
  if (products.data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">이 점포에는 상품이 없어요.</p>
  }
  // 점포 이름은 점포 검색에서 받아 온다. 주소로 바로 들어와 이름을 모르면 주문 화면에 넘길 수 없다
  if (storeName === undefined) {
    return (
      <>
        <BackToHome message="점포 찾기에서 점포를 다시 골라 주세요." />
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {products.data.map((p) => (
            <ProductRow key={p.productId} product={p} />
          ))}
        </ul>
      </>
    )
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
      {products.data.map((p) => (
        <ProductRow
          key={p.productId}
          product={p}
          to={
            p.soldOut
              ? undefined
              : checkoutPath({
                  storeId,
                  storeName,
                  productId: p.productId,
                  productName: p.name,
                  price: p.price,
                  available: p.availableQuantity,
                })
          }
        />
      ))}
    </ul>
  )
}

/** 상품 한 줄. to 가 없으면(품절이거나 점포 이름을 모르면) 누를 수 없다 */
function ProductRow({ product, to }: { product: StoreProduct; to?: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block text-xs text-slate-400">{product.category}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold tabular-nums">{formatWon(product.price)}</span>
        {product.soldOut ? (
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            품절
          </span>
        ) : (
          <span className="block text-xs text-emerald-700 tabular-nums">
            {product.availableQuantity}개 남음
          </span>
        )}
      </span>
      {to && <ChevronRight className="size-4 shrink-0 text-slate-400" />}
    </>
  )
  const className = cn(
    'flex items-center gap-3 px-4 py-3 text-slate-900',
    product.soldOut && 'opacity-50',
  )

  return (
    <li aria-disabled={to ? undefined : true}>
      {to ? (
        <Link to={to} className={cn(className, 'hover:bg-slate-50')}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

function BackToHome({ message }: { message: string }) {
  return (
    <section className="space-y-3 py-6 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      <Link to="/customer" className="text-sm text-emerald-600 underline">
        점포 찾기로
      </Link>
    </section>
  )
}
