import { ChevronLeft, ChevronRight, Info, LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import {
  PRODUCT_KEYWORD_MAX,
  useStoreCategories,
  useStoreProductPages,
  type StoreProduct,
  type StoreProductSort,
} from '../api'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { ProductBadges } from '../components/ProductBadges'
import { PullIndicator } from '../components/PullIndicator'
import { productLabel } from '../productLabel'
import { clearanceOf } from '../clearance'
import { isClearanceProduct } from '../homeRows'
import { isProductShortcut } from '../pickupStore'
import { useLoadMoreOnScroll } from '../useLoadMoreOnScroll'
import { usePullToRefresh } from '../usePullToRefresh'
import { useStoreName } from '../useStoreName'

/**
 * U-10 점포 상품 목록 (/customer/stores/:storeId). 상품을 전부 보여 주고 품절은 흐리게 둔다.
 * 위 검색창에 상품명을 넣고 검색을 누르면 서버가 거른 목록을 보여 준다. 카테고리 칩, 추천상품·신상품만 보기,
 * 이름순·추천순(최근 7일 많이 팔린 순) 정렬도 서버가 처리한다. 상품마다 추천·신상품·선착순 배지가 붙는다.
 * 상품을 누르면 상품 상세로 가고, 거기서 구매하기를 누르면 주문·결제 화면(U-21)으로 넘어간다. 폴링하지 않고 들어올 때·검색할 때·새로고침 때만 읽는다.
 * 상품은 묶음(20개)씩 불러오고, 목록 끝이 보이면 다음 묶음을 이어 붙인다(무한 스크롤). 키보드로도 [더 보기]로 이어 볼 수 있다.
 * 화면 맨 위에서 아래로 당겼다 놓으면 상품과 카테고리를 다시 읽는다(당겨서 새로고침)
 */
export function StoreProductsPage() {
  const { storeId: raw } = useParams()
  const storeId = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
  if (storeId === undefined) return <BackToHome message="점포 주소가 올바르지 않아요." />
  return <StoreProducts key={storeId} storeId={storeId} />
}

function StoreProducts({ storeId }: { storeId: number }) {
  const storeName = useStoreName(storeId)
  // 홈 바로가기(?show=)·홈 상품 검색(?q=)·홈 카테고리 칸(?category=)으로 들어오면 그 조건을 켠 채 시작한다
  const [searchParams] = useSearchParams()
  const initialQ = (searchParams.get('q') ?? '').slice(0, PRODUCT_KEYWORD_MAX)
  const [draft, setDraft] = useState(initialQ)
  const [keyword, setKeyword] = useState(initialQ)
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [sort, setSort] = useState<StoreProductSort>('NAME')
  const showParam = searchParams.get('show')
  const shortcut = isProductShortcut(showParam) ? showParam : null
  const [recommendedOnly, setRecommendedOnly] = useState(shortcut === 'recommended')
  const [newOnly, setNewOnly] = useState(shortcut === 'new')
  // 마감세일·선착순은 서버 조건이 없어 받아 온 목록에서 거른다(마감세일 거르기는 homeRows 한 곳)
  const [clearanceOnly, setClearanceOnly] = useState(shortcut === 'clearance')
  const [firstComeOnly, setFirstComeOnly] = useState(shortcut === 'firstCome')
  const categories = useStoreCategories(storeId)
  const products = useStoreProductPages(storeId, {
    keyword,
    category,
    sort,
    recommendedOnly,
    newOnly,
  })
  const filtered = category !== '' || recommendedOnly || newOnly || clearanceOnly || firstComeOnly
  const {
    ref: pullRef,
    pull,
    ready,
  } = usePullToRefresh<HTMLElement>(() => {
    void products.refetch()
    void categories.refetch()
  })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setKeyword(draft)
  }
  const clearSearch = () => {
    setDraft('')
    setKeyword('')
    setCategory('')
    setRecommendedOnly(false)
    setNewOnly(false)
    setClearanceOnly(false)
    setFirstComeOnly(false)
  }

  return (
    <section ref={pullRef} className="space-y-4">
      <PullIndicator pull={pull} ready={ready} />
      <Link to="/customer/stores" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft className="size-4" />
        점포 찾기
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{storeName ?? '점포 상품'}</h1>
          <p className="text-sm text-slate-500">상품을 고르면 바로 구매로 넘어가요</p>
          <Link
            to={`/customer/stores/${storeId}/info`}
            className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-600"
          >
            <Info className="size-4" aria-hidden="true" />
            점포 정보·위치
          </Link>
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
      <form onSubmit={onSearch} className="flex gap-2" role="search">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <span className="sr-only">상품 검색어</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={PRODUCT_KEYWORD_MAX}
            placeholder="상품명"
            className="w-full text-sm text-slate-900 outline-none"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white"
        >
          검색
        </button>
      </form>
      <div
        role="group"
        aria-label="카테고리"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm"
      >
        <Chip label="전체" pressed={category === ''} onClick={() => setCategory('')} />
        {(categories.data ?? []).map((c) => (
          <Chip key={c} label={c} pressed={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="-ml-4 flex gap-2 overflow-x-auto pl-4">
          <Chip
            label="마감세일"
            pressed={clearanceOnly}
            onClick={() => setClearanceOnly((v) => !v)}
          />
          <Chip
            label="선착순"
            pressed={firstComeOnly}
            onClick={() => setFirstComeOnly((v) => !v)}
          />
          <Chip
            label="추천상품"
            pressed={recommendedOnly}
            onClick={() => setRecommendedOnly((v) => !v)}
          />
          <Chip label="신상품" pressed={newOnly} onClick={() => setNewOnly((v) => !v)} />
        </div>
        <label className="flex items-center gap-1 text-slate-500">
          <span className="sr-only">정렬</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as StoreProductSort)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="NAME">이름순</option>
            <option value="POPULAR">추천순</option>
          </select>
        </label>
      </div>
      <ProductList
        products={products}
        storeId={storeId}
        storeName={storeName}
        keyword={keyword.trim()}
        filtered={filtered}
        clearanceOnly={clearanceOnly}
        firstComeOnly={firstComeOnly}
        onClearSearch={clearSearch}
      />
    </section>
  )
}

interface ListProps {
  products: ReturnType<typeof useStoreProductPages>
  storeId: number
  storeName: string | undefined
  /** 지금 걸려 있는 검색어(앞뒤 공백 뺀 것). 없으면 빈 문자열 */
  keyword: string
  /** 카테고리·추천상품·신상품 조건이 하나라도 걸려 있는지 */
  filtered: boolean
  /** 받아 온 목록에서 마감세일 상품만 */
  clearanceOnly: boolean
  /** 받아 온 목록에서 선착순 상품만 */
  firstComeOnly: boolean
  onClearSearch: () => void
}

function ProductList({
  products,
  storeId,
  storeName,
  keyword,
  filtered,
  clearanceOnly,
  firstComeOnly,
  onClearSearch,
}: ListProps) {
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
  const items = products.data.pages
    .flat()
    .filter((p) => (!clearanceOnly || isClearanceProduct(p)) && (!firstComeOnly || p.firstCome))
  if (items.length === 0) {
    if (keyword || filtered) {
      return (
        <div className="space-y-2 py-10 text-center">
          <p className="text-sm text-slate-500">
            {keyword ? `‘${keyword}’ 상품이 없어요.` : '조건에 맞는 상품이 없어요.'}
          </p>
          <button
            type="button"
            onClick={onClearSearch}
            className="text-sm text-emerald-600 underline"
          >
            전체 상품 보기
          </button>
        </div>
      )
    }
    return <p className="py-10 text-center text-sm text-slate-500">이 점포에는 상품이 없어요.</p>
  }
  // 점포 이름은 점포 검색에서 받아 온다. 주소로 바로 들어와 이름을 모르면 주문 화면에 넘길 수 없다
  if (storeName === undefined) {
    return (
      <>
        <BackToHome message="점포 찾기에서 점포를 다시 골라 주세요." />
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {items.map((p) => (
            <ProductRow key={p.productId} product={p} />
          ))}
        </ul>
        <LoadMore products={products} />
      </>
    )
  }

  return (
    <>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {items.map((p) => (
          <ProductRow
            key={p.productId}
            product={p}
            to={p.soldOut ? undefined : `/customer/stores/${storeId}/products/${p.productId}`}
          />
        ))}
      </ul>
      <LoadMore products={products} />
    </>
  )
}

/**
 * 목록 끝. 다음 묶음이 있으면 화면에 들어올 때 자동으로 부르고, 키보드·화면 읽기 프로그램으로도 쓸 수 있게
 * [더 보기] 버튼을 같이 둔다. 다 불러왔으면 아무것도 그리지 않는다
 */
function LoadMore({ products }: { products: ReturnType<typeof useStoreProductPages> }) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = products
  const ref = useLoadMoreOnScroll<HTMLDivElement>(() => {
    if (!isFetchingNextPage) void fetchNextPage()
  }, hasNextPage)
  if (!hasNextPage) return null
  return (
    <div ref={ref} className="flex justify-center py-2">
      <button
        type="button"
        onClick={() => void fetchNextPage()}
        disabled={isFetchingNextPage}
        aria-busy={isFetchingNextPage}
        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-60"
      >
        {isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {isFetchingNextPage ? '불러오는 중' : '더 보기'}
      </button>
    </div>
  )
}

/** 상품 한 줄. to 가 없으면(품절이거나 점포 이름을 모르면) 누를 수 없다 */
function ProductRow({ product, to }: { product: StoreProduct; to?: string }) {
  const clearance = clearanceOf(product)
  const body = (
    <>
      <ProductThumb src={product.imageUrl} name={product.name} className="size-12" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block text-xs text-slate-500">{product.category}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {clearance && (
            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">
              마감세일
            </span>
          )}
          <ExpiryBadge nearestExpiry={product.nearestExpiry} />
          <ProductBadges product={product} />
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold tabular-nums">{formatWon(product.price)}</span>
        {clearance && (
          <span className="block text-xs font-medium text-rose-700 tabular-nums">
            마감세일 {formatWon(clearance.price)} · {clearance.quantity}개
          </span>
        )}
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
      {to && <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />}
    </>
  )
  const className = cn(
    'flex items-center gap-3 px-4 py-3 text-slate-900',
    product.soldOut && 'opacity-50',
  )

  return (
    <li aria-disabled={to ? undefined : true}>
      {to ? (
        <Link
          to={to}
          aria-label={productLabel(product)}
          className={cn(className, 'hover:bg-slate-50')}
        >
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
      <Link to="/customer/stores" className="text-sm text-emerald-600 underline">
        점포 찾기로
      </Link>
    </section>
  )
}

/** 누르면 켜지고 꺼지는 칩. 켜지면 브랜드 색 */
function Chip({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600',
        pressed && 'border-emerald-600 bg-emerald-600 text-white',
      )}
    >
      {label}
    </button>
  )
}
