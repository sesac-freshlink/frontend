import { toast } from 'sonner'
import {
  Check,
  ChevronLeft,
  Info,
  LayoutGrid,
  LoaderCircle,
  MapPinCheck,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import {
  PRODUCT_KEYWORD_MAX,
  useStoreCategories,
  useStoreDetail,
  useStoreCategoryPhotos,
  useStoreProductPages,
  type StoreProduct,
  type StoreProductSort,
} from '../api'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { ProductBadges } from '../components/ProductBadges'
import { PhotoOrIcon } from '../components/PhotoOrIcon'
import { PullIndicator } from '../components/PullIndicator'
import { productLabel } from '../productLabel'
import { CLEARANCE_DISCOUNT_PERCENT, clearanceOf } from '../clearance'
import {
  isProductShortcut,
  type ProductShortcut,
  readPickupStore,
  savePickupStore,
  type PickupStore,
} from '../pickupStore'
import { FarPickDialog } from '../components/FarPickDialog'
import { useFarPickGuard } from '../useFarPickGuard'
import { useLoadMoreOnScroll } from '../useLoadMoreOnScroll'
import { usePullToRefresh } from '../usePullToRefresh'
import { useStoreName } from '../useStoreName'

/**
 * U-10 점포 상품 목록 = 점포 둘러보기 (/customer/stores/:storeId). 11/11 CU 점포 화면 모양으로 바꿨다:
 * 위 뒤로 + 점포 이름, 검색창, 동그란 아이콘 줄(카테고리·신상품·마감세일·선착순·점주 추천), 정렬, 2칸 사진 카드.
 * 상품을 전부 보여 주고 품절은 흐리게 둔다.
 * 위 검색창에 상품명을 넣고 검색을 누르면 서버가 거른 목록을 보여 준다. 카테고리 칩, 추천상품·신상품만 보기,
 * 이름순·추천순(최근 7일 많이 팔린 순) 정렬도 서버가 처리한다. 상품마다 추천·신상품·선착순 배지가 붙는다.
 * 상품을 누르면 상품 상세로 가고, 거기서 수량을 고르고 [N원 구매하기]를 누르면 바로 결제 대기로 넘어간다. 폴링하지 않고 들어올 때·검색할 때·새로고침 때만 읽는다.
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
  // 홈 베스트 상품 [전체 보기](?sort=POPULAR)로 들어오면 추천순(최근 7일 많이 팔린 순)으로 시작한다
  const [sort, setSort] = useState<StoreProductSort>(
    searchParams.get('sort') === 'POPULAR' ? 'POPULAR' : 'NAME',
  )
  // 아이콘 줄 조건(신상품·마감세일·선착순·점주 추천)은 한 번에 하나만 켠다(11/11 경우 결정).
  // 주소에 ?show= 가 여러 개 오면 알맞은 값 중 맨 앞 하나만 쓴다
  const [shortcut, setShortcut] = useState<ProductShortcut | null>(
    () => searchParams.getAll('show').find(isProductShortcut) ?? null,
  )
  const toggleShortcut = (next: ProductShortcut) =>
    setShortcut((current) => (current === next ? null : next))
  const recommendedOnly = shortcut === 'recommended'
  const newOnly = shortcut === 'new'
  // 마감세일·선착순도 서버가 거른다(inventory #71 clearance·firstCome, 11/12). 묶음(20개) 안에서만 걸리던 한계가 없어졌다
  const clearanceOnly = shortcut === 'clearance'
  const firstComeOnly = shortcut === 'firstCome'
  const categories = useStoreCategories(storeId)
  const categoryPhotos = useStoreCategoryPhotos(storeId)
  const products = useStoreProductPages(storeId, {
    keyword,
    category,
    sort,
    recommendedOnly,
    newOnly,
    clearanceOnly,
    firstComeOnly,
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
      {/* 11/11 경우 시안: 분류 줄([카테고리] 고정 + 점포 분류 사진 동그라미 좌우 스크롤) + 그 아래 조건 버튼 줄.
          분류와 조건은 같이 걸리고, 조건은 하나만 켜진다. 고른 분류·조건을 다시 누르면 꺼진다 */}
      <CategoryRow
        storeId={storeId}
        storeName={storeName}
        categories={categories.data ?? []}
        photos={categoryPhotos.data ?? {}}
        selected={category}
        onSelect={(c) => setCategory((current) => (current === c ? '' : c))}
      />
      <div
        role="group"
        aria-label="상품 조건"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={shortcut === c.value}
            onClick={() => toggleShortcut(c.value)}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm',
              shortcut === c.value
                ? 'border-emerald-700 bg-emerald-700 font-semibold text-white'
                : 'border-slate-300 bg-white text-slate-800',
            )}
          >
            {c.label}
          </button>
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
        className="-ml-1 inline-flex min-h-11 min-w-11 items-center gap-1 pr-2 text-sm text-slate-600"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {fromSearch ? '점포 검색' : '홈'}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold break-keep text-slate-900">
            {storeName ?? '점포 상품'}
          </h1>
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
 * 이미 내 픽업 점포면 버튼 대신 "내 픽업 점포" 표시만 보인다.
 * 옆 "점포 정보·위치" 링크와 같은 높이·글자 크기의 글자 버튼이다(누르는 칸은 44px)
 */
function PickupControl({ storeId, storeName }: { storeId: number; storeName: string }) {
  const [pickup, setPickup] = useState<PickupStore | null>(readPickupStore)
  // 점포 정할 때 확인 창(11/14): 지금 위치에서 10km 넘게 멀고 더 가까운 점포가 있으면 정하기 전에 묻는다
  const farPick = useFarPickGuard()
  const detail = useStoreDetail(storeId)
  const navigate = useNavigate()
  if (pickup?.storeId === storeId) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-700">
        <Check className="size-4" aria-hidden />내 픽업 점포
      </span>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() =>
          farPick.guard(detail.data, () => {
            const store = { storeId, name: storeName }
            savePickupStore(store)
            setPickup(store)
            toast.success('픽업 점포로 정했어요')
          })
        }
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
      >
        <MapPinCheck className="size-4" aria-hidden />
        픽업 점포로 정하기
      </button>
      {farPick.pending && (
        <FarPickDialog
          pick={farPick.pending}
          onClose={farPick.close}
          onShowNearby={() =>
            // 점포 고르기 화면을 지금 지역·가까운순으로 연다
            void navigate(`/customer/stores?pick=1&region=${farPick.pending?.region ?? ''}`)
          }
        />
      )}
    </>
  )
}

/** 조건 버튼 줄 순서(11/11 시안). 신상품·점주 추천은 서버가 거르고, 마감세일·선착순은 받아 온 목록에서 거른다 */
const CONDITIONS: { value: ProductShortcut; label: string }[] = [
  { value: 'clearance', label: '마감세일' },
  { value: 'firstCome', label: '선착순' },
  { value: 'new', label: '신상품' },
  { value: 'recommended', label: '점주 추천' },
]

/**
 * 분류 줄: 맨 왼쪽 [카테고리](전체 분류 화면)는 고정, 세로 구분선 오른쪽에 점포 분류(사진 동그라미 + 이름)를 좌우로 넘긴다.
 * 고른 분류는 초록 테두리. 사진은 꾸밈(alt="")이고 이름 글자가 버튼 이름이다. Tab 으로 분류마다 옮겨 갈 수 있다
 */
function CategoryRow({
  storeId,
  storeName,
  categories,
  photos,
  selected,
  onSelect,
}: {
  storeId: number
  storeName: string | undefined
  categories: string[]
  photos: Record<string, string>
  selected: string
  onSelect: (category: string) => void
}) {
  return (
    <div className="-mx-4 flex items-start">
      <Link
        to={`/customer/stores/${storeId}/categories`}
        state={storeName ? { storeName } : undefined}
        className="mt-1 flex w-18 shrink-0 flex-col items-center gap-1.5 border-r border-slate-200 pr-3 pl-4 text-xs text-slate-800"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
          <LayoutGrid className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        카테고리
      </Link>
      <ul aria-label="분류" className="flex min-w-0 gap-3 overflow-x-auto py-1 pr-4 pl-2.5">
        {categories.map((c) => {
          const on = c === selected
          return (
            <li key={c} className="shrink-0">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(c)}
                className={cn(
                  'flex w-15 flex-col items-center gap-1.5 text-xs',
                  on ? 'font-bold text-emerald-700' : 'text-slate-800',
                )}
              >
                <PhotoOrIcon
                  src={photos[c]}
                  icon={LayoutGrid}
                  className={cn(
                    'size-14 rounded-full bg-slate-50 p-1.5',
                    on && 'outline-2 outline-offset-2 outline-emerald-700',
                  )}
                />
                <span className="break-keep">{c}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
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
  onClearSearch: () => void
}

function ProductList({
  products,
  storeId,
  storeName,
  keyword,
  filtered,
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
        <p className="text-sm text-rose-700">상품을 불러오지 못했어요.</p>
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
  const items = products.data.pages.flat()
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
            className="text-sm text-emerald-700 underline hover:text-emerald-800"
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
            <span className="rounded-full bg-rose-700 px-1.5 py-0.5 text-xs font-semibold text-white">
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
            <span className="text-sm font-bold text-rose-700">{CLEARANCE_DISCOUNT_PERCENT}%</span>
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
        <span className="block text-sm font-medium text-rose-700">
          마감세일로만 {clearance.quantity}개 남았어요
        </span>
      ) : (
        <span
          className={cn(
            'block text-sm tabular-nums',
            left <= LOW_STOCK ? 'font-medium text-rose-700' : 'text-slate-600',
          )}
        >
          {/* 숫자와 "개"가 줄바꿈으로 떨어지지 않게 묶음마다 줄바꿈을 막는다(11/11 dev 확인) */}
          <span className="whitespace-nowrap">{left}개 남았어요</span>
          {clearance && (
            <>
              {' · '}
              <span className="whitespace-nowrap">마감세일 {clearance.quantity}개</span>
            </>
          )}
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
        className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
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
      <Link
        to="/customer/stores"
        className="text-sm text-emerald-700 underline hover:text-emerald-800"
      >
        점포 찾기로
      </Link>
    </section>
  )
}
