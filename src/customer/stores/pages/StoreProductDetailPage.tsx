import { BellRing, CalendarClock, ChevronLeft, LoaderCircle, Store } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { checkoutPath } from '@/customer/order/checkout'
import { formatDateTime, formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { useStoreProduct, type StoreProductDetail } from '../api'
import { useRestockSubscription, useToggleRestock } from '../restock'
import { useStoreName } from '../useStoreName'

/**
 * U-10 고객 상품 상세 (/customer/stores/:storeId/products/:productId). 가격·남은 수량·먼저 받게 될 상품의 유통기한·점포를
 * 보여 주고, 구매하기를 누르면 주문·결제 화면(U-21)으로 넘어간다. 폴링하지 않고 들어올 때만 읽는다.
 * 품절이면 "재입고 알림 받기"로 notification-service 에 신청한다(다시 입고되면 화면 알림이 한 번 온다)
 */
export function StoreProductDetailPage() {
  const { storeId: rawStore, productId: rawProduct } = useParams()
  const storeId = toId(rawStore)
  const productId = toId(rawProduct)
  if (storeId === undefined || productId === undefined) {
    return (
      <section className="space-y-3 py-6 text-center">
        <p className="text-sm text-slate-500">상품 주소가 올바르지 않아요.</p>
        <Link to="/customer" className="text-sm text-emerald-600 underline">
          점포 찾기로
        </Link>
      </section>
    )
  }
  return <ProductDetail key={`${storeId}-${productId}`} storeId={storeId} productId={productId} />
}

function toId(raw: string | undefined): number | undefined {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
}

function ProductDetail({ storeId, productId }: { storeId: number; productId: number }) {
  const storeName = useStoreName(storeId)
  const product = useStoreProduct(storeId, productId)

  return (
    <section className="space-y-4">
      <Link
        to={`/customer/stores/${storeId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ChevronLeft className="size-4" />
        상품 목록
      </Link>
      {product.isPending ? (
        <div className="flex justify-center py-10 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : product.isError ? (
        <div className="space-y-2 py-10 text-center">
          <p className="text-sm text-red-600">상품을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => void product.refetch()}
            className="text-sm text-slate-500 underline"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <DetailBody product={product.data} storeId={storeId} storeName={storeName} />
      )}
    </section>
  )
}

interface BodyProps {
  product: StoreProductDetail
  storeId: number
  storeName: string | undefined
}

function DetailBody({ product, storeId, storeName }: BodyProps) {
  // 점포 이름은 점포 검색에서 받아 온다. 주소로 바로 들어와 이름을 모르면 주문 화면에 넘길 수 없다
  const buyPath =
    product.soldOut || storeName === undefined
      ? undefined
      : checkoutPath({
          storeId,
          storeName,
          productId: product.productId,
          productName: product.name,
          price: product.price,
          available: product.availableQuantity,
          ...(product.imageUrl !== null && { imageUrl: product.imageUrl }),
        })

  return (
    <div className="space-y-5">
      <ProductThumb
        src={product.imageUrl}
        name={product.name}
        className={cn('mx-auto size-48 rounded-xl', product.soldOut && 'opacity-50')}
      />
      <div className="space-y-1">
        <p className="text-xs text-slate-400">{product.category}</p>
        <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
        <p className="text-lg font-semibold text-slate-900 tabular-nums">
          {formatWon(product.price)}
        </p>
      </div>

      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-slate-500">남은 수량</dt>
          <dd>
            {product.soldOut ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                품절
              </span>
            ) : (
              <span className="font-semibold text-emerald-700 tabular-nums">
                {product.availableQuantity}개
              </span>
            )}
          </dd>
        </div>
        {product.nearestExpiry !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <CalendarClock className="size-4" aria-hidden />
              유통기한
            </dt>
            <dd className="text-right">
              <span className="font-medium text-slate-900 tabular-nums">
                {formatDateTime(product.nearestExpiry)}까지
              </span>
              <span className="block text-xs text-slate-400">유통기한이 빠른 상품부터 드려요</span>
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <Store className="size-4" aria-hidden />
            점포
          </dt>
          <dd className="font-medium text-slate-900">{storeName ?? '-'}</dd>
        </div>
      </dl>

      {buyPath ? (
        <Link
          to={buyPath}
          className="block rounded-lg bg-emerald-600 py-3 text-center text-sm font-medium text-white"
        >
          구매하기
        </Link>
      ) : (
        <div className="space-y-2 text-center">
          <button
            type="button"
            disabled
            className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white opacity-40"
          >
            {product.soldOut ? '품절' : '구매하기'}
          </button>
          {product.soldOut && <RestockButton storeId={storeId} productId={product.productId} />}
          {!product.soldOut && (
            <p className="text-sm text-slate-500">
              점포 찾기에서 점포를 다시 골라 주세요.{' '}
              <Link to="/customer" className="text-emerald-600 underline">
                점포 찾기로
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** 품절 상품의 재입고 알림 신청·취소 버튼 */
function RestockButton({ storeId, productId }: { storeId: number; productId: number }) {
  const status = useRestockSubscription(storeId, productId, true)
  const toggle = useToggleRestock(storeId, productId)
  const subscribed = status.data?.subscribed === true

  const onClick = () =>
    toggle.mutate(!subscribed, {
      onSuccess: (on) =>
        toast.success(on ? '다시 들어오면 알려 드릴게요' : '재입고 알림을 취소했어요', {
          id: 'restock',
        }),
      onError: () => toast.error('잠시 뒤 다시 시도해 주세요', { id: 'restock' }),
    })

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status.isPending || toggle.isPending}
      aria-pressed={subscribed}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-medium disabled:opacity-50',
        subscribed
          ? 'border-slate-200 bg-white text-slate-600'
          : 'border-emerald-600 bg-white text-emerald-700',
      )}
    >
      <BellRing className="size-4" aria-hidden />
      {subscribed ? '재입고 알림 신청됨 · 취소' : '재입고 알림 받기'}
    </button>
  )
}
