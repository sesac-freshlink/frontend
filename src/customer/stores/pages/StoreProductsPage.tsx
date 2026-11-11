import { toast } from 'sonner'
import {
  Check,
  ChevronLeft,
  Info,
  LayoutGrid,
  LoaderCircle,
  Percent,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsUp,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
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
import { CLEARANCE_DISCOUNT_PERCENT, clearanceOf } from '../clearance'
import { isClearanceProduct } from '../homeRows'
import {
  isProductShortcut,
  type ProductShortcut,
  readPickupStore,
  savePickupStore,
  type PickupStore,
} from '../pickupStore'
import { useLoadMoreOnScroll } from '../useLoadMoreOnScroll'
import { usePullToRefresh } from '../usePullToRefresh'
import { useStoreName } from '../useStoreName'

/**
 * U-10 점포 상품 목록 = 점포 둘러보기 (/customer/stores/:storeId). 11/11 CU 점포 화면 모양으로 바꿨다:
 * 위 뒤로 + 점포 이름, 검색창, 동그란 아이콘 줄(카테고리·신상품·마감세일·선착순·점주 추천), 정렬, 2칸 사진 카드.
 * 상품을 전부 보여 주고 품절은 흐리게 둔다.
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
  // 아이콘 줄 조건(신상품·마감세일·선착순·점주 추천)은 한 번에 하나만 켠다(11/11 경우 결정).
  // 주소에 ?show= 가 여러 개 오면 알맞은 값 중 맨 앞 하나만 쓴다
  const [shortcut, setShortcut] = useState<ProductShortcut | null>(
    () => searchParams.getAll('show').find(isProductShortcut) ?? null,
  )
  const toggleShortcut = (next: ProductShortcut) =>
    setShortcut((current) => (current === next ? null : next))
  const recommendedOnly = shortcut === 'recommended'
  const newOnly = shortcut === 'new'
  // 마감세일·선착순은 서버 조건이 없어 받아 온 목록에서 거른다(마감세일 거르기는 homeRows 한 곳)
  const clearanceOnly = shortcut === 'clearance'
  const firstComeOnly = shortcut === 'firstCome'
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
    setShortcut(null)
  }

  return (
    <section ref={pullRef} className="space-y-4">
      <PullIndicator pull={pull} ready={ready} />
      <StoreHeader storeId={storeId} storeName={storeName} products={products} />
      <form onSubmit={onSearch} role="search">
        <label className="flex items-center gap-2 rounded-full border border-slate-300 bg-white pr-1 pl-4 focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700">
          <span className="sr-only">상품 검색어</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={PRODUCT_KEYWORD_MAX}
            placeholder="이 점포의 상품을 찾아보세요"
            enterKeyHint="search"
            className="min-h-12 w-full min-w-0 text-base text-slate-900 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            aria-label="검색"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Search className="size-5" aria-hidden />
          </button>
        </label>
      </form>
      {/* 동그란 아이콘 줄: 카테고리(전체 분류 화면) + 조건 4개. 조건은 하나만 켜지고, 켜진 것을 다시 누르면 꺼진다 */}
      <nav aria-label="상품 조건" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-4">
          <li>
            <IconLink
              to={`/customer/stores/${storeId}/categories`}
              storeName={storeName}
              label="카테고리"
              icon={LayoutGrid}
            />
          </li>
          <li>
            <IconToggle
              label="신상품"
              icon={Sparkles}
              pressed={newOnly}
              onClick={() => toggleShortcut('new')}
            />
          </li>
          <li>
            <IconToggle
              label="마감세일"
              icon={Percent}
              pressed={clearanceOnly}
              onClick={() => toggleShortcut('clearance')}
            />
          </li>
          <li>
            <IconToggle
              label="선착순"
              icon={Timer}
              pressed={firstComeOnly}
              onClick={() => toggleShortcut('firstCome')}
            />
          </li>
          <li>
            <IconToggle
              label="점주 추천"
              icon={ThumbsUp}
              pressed={recommendedOnly}
              onClick={() => toggleShortcut('recommended')}
            />
          </li>
        </ul>
      </nav>
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
      <div className="flex justify-end text-sm">
        <SortSelect sort={sort} onChange={setSort} />
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

/**
 * 맨 위: 뒤로 + 점포 이름 + 점포 정보·위치 + 새로고침.
 * 하단 [점포 검색]에서 둘러보러 들어왔으면(state.from === 'search') 점포 검색으로, 아니면(홈) 홈으로 돌아간다
 */
function StoreHeader({
  storeId,
  storeName,
  products,
}: {
  storeId: number
  storeName: string | undefined
  products: ReturnType<typeof useStoreProductPages>
}) {
  const { state } = useLocation()
  const fromSearch =
    typeof state === 'object' && state !== null && 'from' in state && state.from === 'search'
  return (
    <div className="space-y-1">
      <Link
        to={fromSearch ? '/customer/stores' : '/customer'}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-2 text-sm text-slate-600"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {fromSearch ? '점포 검색' : '홈'}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{storeName ?? '점포 상품'}</h1>
          <div className="flex flex-wrap items-center gap-x-3">
            <Link
              to={`/customer/stores/${storeId}/info`}
              state={storeName ? { storeName } : undefined}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-emerald-700"
            >
              <Info className="size-4" aria-hidden="true" />
              점포 정보·위치
            </Link>
            {storeName && <PickupControl storeId={storeId} storeName={storeName} />}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void products.refetch()}
          disabled={products.isFetching}
          aria-label="새로고침"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <RefreshCw className={cn('size-5', products.isFetching && 'animate-spin')} />
        </button>
      </div>
    </div>
  )
}

/**
 * 둘러보기 화면에서 이 점포를 내 픽업 점포로 정한다(11/11 경우 결정). 누르면 이 기기에 저장하고 짧게 알린다.
 * 이미 내 픽업 점포면 버튼 대신 "내 픽업 점포" 표시만 보인다
 */
function PickupControl({ storeId, storeName }: { storeId: number; storeName: string }) {
  const [pickup, setPickup] = useState<PickupStore | null>(readPickupStore)
  if (pickup?.storeId === storeId) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-700">
        <Check className="size-4" aria-hidden />내 픽업 점포
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        const store = { storeId, name: storeName }
        savePickupStore(store)
        setPickup(store)
        toast.success('픽업 점포로 정했어요')
      }}
      className="inline-flex min-h-11 items-center rounded-full border border-emerald-700 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
    >
      픽업 점포로 정하기
    </button>
  )
}

/** 동그란 아이콘 + 이름. 누르면 켜지고 꺼지는 조건(켜지면 진한 초록 동그라미) */
function IconToggle({
  label,
  icon: Icon,
  pressed,
  onClick,
}: {
  label: string
  icon: LucideIcon
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex w-14 flex-col items-center gap-1 text-xs text-slate-800"
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700',
          pressed && 'bg-emerald-700 text-white',
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className={cn(pressed && 'font-semibold text-emerald-700')}>{label}</span>
    </button>
  )
}

/** 동그란 아이콘 + 이름 링크(카테고리 → 전체 분류 화면) */
function IconLink({
  to,
  storeName,
  label,
  icon: Icon,
}: {
  to: string
  storeName: string | undefined
  label: string
  icon: LucideIcon
}) {
  return (
    <Link
      to={to}
      state={storeName ? { storeName } : undefined}
      className="flex w-14 flex-col items-center gap-1 text-xs text-slate-800"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      {label}
    </Link>
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
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
          {items.map((p) => (
            <ProductCard key={p.productId} product={p} />
          ))}
        </ul>
        <LoadMore products={products} />
      </>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
        {items.map((p) => (
          <ProductCard
            key={p.productId}
            product={p}
            storeName={storeName}
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

/** 이 수량 이하로 남으면 "N개 남았어요"를 빨갛게 보인다(서두르게) */
const LOW_STOCK = 3

/**
 * 상품 카드(2칸). 정사각 사진 + 배지(신상품·마감세일·선착순·추천) + 이름 + 가격 + 남은 수량.
 * 마감세일이 있으면 할인율·할인가·원래 가격을 보이고, 기본 수량이 0이고 마감세일만 남았으면 "마감세일로만 N개 남았어요".
 * to 가 없으면(품절이거나 점포 이름을 모르면) 누를 수 없다
 */
function ProductCard({
  product,
  to,
  storeName,
}: {
  product: StoreProduct
  to?: string
  storeName?: string
}) {
  const clearance = clearanceOf(product)
  const left = product.availableQuantity
  const body = (
    <>
      <span className="relative block">
        <ProductThumb
          src={product.imageUrl}
          name={product.name}
          className={cn(
            'aspect-square size-auto w-full rounded-xl bg-white',
            product.soldOut && 'opacity-40',
          )}
        />
        <span className="absolute top-2 left-2 flex flex-wrap gap-1">
          {clearance && (
            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">
              마감세일
            </span>
          )}
          <ProductBadges product={product} />
        </span>
      </span>
      <span className="mt-2 line-clamp-2 text-sm leading-snug text-slate-900">{product.name}</span>
      {clearance ? (
        <span className="block">
          <span className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-red-600">{CLEARANCE_DISCOUNT_PERCENT}%</span>
            <span className="text-base font-bold text-slate-900 tabular-nums">
              {formatWon(clearance.price)}
            </span>
          </span>
          <span className="block text-sm text-slate-600 tabular-nums line-through">
            <span className="sr-only">원래 가격 </span>
            {formatWon(product.price)}
          </span>
        </span>
      ) : (
        <span className="block text-base font-bold text-slate-900 tabular-nums">
          {formatWon(product.price)}
        </span>
      )}
      {product.soldOut ? (
        <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          품절
        </span>
      ) : clearance && left === 0 ? (
        // 기본 수량이 0이고 마감세일만 남았으면 "0개 남음"을 보이지 않는다(품절로 보이지 않게)
        <span className="block text-sm font-medium text-red-700">
          마감세일로만 {clearance.quantity}개 남았어요
        </span>
      ) : (
        <span
          className={cn(
            'block text-sm tabular-nums',
            left <= LOW_STOCK ? 'font-medium text-red-700' : 'text-slate-600',
          )}
        >
          {left}개 남았어요
          {clearance && ` · 마감세일 ${clearance.quantity}개`}
        </span>
      )}
      <ExpiryBadge nearestExpiry={product.nearestExpiry} />
    </>
  )

  return (
    <li aria-disabled={to ? undefined : true}>
      {to ? (
        <Link
          to={to}
          state={storeName ? { storeName } : undefined}
          aria-label={productLabel(product)}
          className="relative block space-y-0.5"
        >
          {body}
        </Link>
      ) : (
        <div className="relative space-y-0.5">{body}</div>
      )}
    </li>
  )
}

/** 정렬(이름순·추천순). 상품 카드 위 오른쪽에 둔다 */
function SortSelect({
  sort,
  onChange,
}: {
  sort: StoreProductSort
  onChange: (sort: StoreProductSort) => void
}) {
  return (
    <label className="flex items-center gap-1 text-slate-600">
      <span className="sr-only">정렬</span>
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as StoreProductSort)}
        className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
      >
        <option value="NAME">이름순</option>
        <option value="POPULAR">추천순</option>
      </select>
    </label>
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
