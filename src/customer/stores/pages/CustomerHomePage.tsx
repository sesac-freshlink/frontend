import { Search, Store } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { DEFAULT_REGION, isRegionCode, type RegionCode } from '@/auth/regions'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { ErrorState } from '@/shared/ui/QueryState'
import { PRODUCT_KEYWORD_MAX, useClearanceProducts, useStoreProducts, useStores } from '../api'
import { CategoryGrid } from '../components/home/CategoryGrid'
import { PullIndicator } from '../components/PullIndicator'
import { HomeBanner } from '../components/home/HomeBanner'
import { BestProducts } from '../components/home/BestProducts'
import { NearbyStores } from '../components/home/NearbyStores'
import { PickupStoreButton } from '../components/home/PickupStoreButton'
import { ProductRail } from '../components/home/ProductRail'
import { defaultPickupStore, storeDistance, type DefaultStoreReason } from '../homeRows'
import { readPickupStore, type PickupStore } from '../pickupStore'
import { useCurrentPosition, type PositionState } from '../useCurrentPosition'
import { usePullToRefresh } from '../usePullToRefresh'

/**
 * U-01 고객 홈 (/customer). 위에서 아래로: 픽업 점포 한 줄 → 메인 배너 → 카테고리 4×2 → 점포 상품 검색 →
 * 상품 줄 3개(오늘 마감세일·점주 추천·신상품) → 내 주변 점포. 로고·알림 종·하단 메뉴는 CustomerLayout 이 그린다.
 * 픽업 점포를 아직 안 골랐으면 임시 픽업 점포(위치 허용이면 가장 가까운 점포, 아니면 내 지역 첫 점포)로 홈 전체를 채운다.
 * 임시 점포는 이 기기에 저장하지 않고, 손님이 [픽업 점포로 정하기]를 누를 때만 저장한다(11/11). 내 지역에 점포가 없을 때만 점포 찾기 안내를 보인다.
 * 점포 찾기는 하단 메뉴 [점포 검색](StoreSearchPage)으로 옮겼다
 */
export function CustomerHomePage() {
  const profile = useMyProfile()
  // 픽업 점포는 점포 둘러보기·점포 검색의 [픽업 점포로 정하기]로만 바뀐다. 홈은 들어올 때 한 번 읽는다
  const [pickup] = useState<PickupStore | null>(readPickupStore)

  if (profile.isPending) return <FullScreenSpinner />
  // 로그인했는데 프로필이 없으면 프로필 등록 마무리 화면으로 (기능명세 M1)
  if (profile.data === null) return <Navigate to="/signup" replace />

  const me = profile.data?.role === 'CUSTOMER' ? profile.data : undefined
  const region = me && isRegionCode(me.region) ? me.region : DEFAULT_REGION
  return <HomeWithStore saved={pickup} region={region} />
}

/**
 * 홈에 쓸 점포를 정한다. 고른 점포(saved)가 있으면 그것, 없으면 임시 점포(defaultPickupStore).
 * 임시 점포는 위치 답(허용·거절·8초 시간 초과)과 내 지역 점포 목록을 기다린 뒤 정한다. 그동안은 자리표시를 보인다
 */
function HomeWithStore({ saved, region }: { saved: PickupStore | null; region: RegionCode }) {
  const position = useCurrentPosition(true)
  const stores = useStores({ region, keyword: '' })
  const homeProps = { region, position, stores }

  if (saved) return <Home pickup={saved} temporary={null} {...homeProps} />
  if (stores.isError) {
    return (
      <ErrorState
        message="점포를 불러오지 못했어요."
        onRetry={() => void stores.refetch()}
        retrying={stores.isFetching}
      />
    )
  }
  if (stores.isPending || position.status === 'pending') return <HomeSkeleton />
  const origin = position.status === 'ok' ? position.position : null
  const picked = defaultPickupStore(stores.data, origin)
  if (picked === null) return <ChooseStore />
  return (
    <Home
      pickup={{ storeId: picked.store.storeId, name: picked.store.name }}
      temporary={picked.reason}
      {...homeProps}
    />
  )
}

/** 임시 점포를 정하는 동안의 자리표시(빈 화면 대신 홈 모양을 미리 보인다) */
function HomeSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">가까운 점포를 찾는 중</span>
      <div aria-hidden className="h-12 animate-pulse rounded-xl bg-slate-200" />
      <div aria-hidden className="aspect-2/1 animate-pulse rounded-2xl bg-slate-200" />
      <div aria-hidden className="grid grid-cols-4 gap-y-4">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="mx-auto size-11 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>
      <div aria-hidden className="h-12 animate-pulse rounded-xl bg-slate-200" />
    </div>
  )
}

/** 내 지역에 점포가 하나도 없을 때만: 홈의 다른 칸은 점포마다 달라 보여 줄 수 없어 고르기 안내만 둔다 */
function ChooseStore() {
  return (
    <section aria-labelledby="choose-store" className="space-y-4 py-12 text-center">
      <Store className="mx-auto size-10 text-emerald-700" strokeWidth={1.5} aria-hidden />
      <div className="space-y-1">
        <h1 id="choose-store" className="text-xl font-bold text-slate-900">
          내 지역에는 아직 점포가 없어요
        </h1>
        <p className="text-sm text-slate-600">
          점포 검색에서 다른 지역 점포를 찾아 [픽업 점포로 정하기]를 눌러 주세요.
        </p>
      </div>
      <Link
        to="/customer/stores?pick=1"
        className="inline-flex min-h-12 items-center rounded-xl bg-emerald-700 px-6 text-base font-semibold text-white hover:bg-emerald-800"
      >
        점포 찾기
      </Link>
    </section>
  )
}

function Home({
  pickup,
  temporary,
  position,
  stores,
}: {
  pickup: PickupStore
  /** 임시 점포면 고른 까닭, 손님이 고른 점포면 null */
  temporary: DefaultStoreReason | null
  region: RegionCode
  position: PositionState
  stores: ReturnType<typeof useStores>
}) {
  const { storeId, name } = pickup
  const origin = position.status === 'ok' ? position.position : null
  const distance = storeDistance(
    stores.data?.find((s) => s.storeId === storeId),
    origin,
  )
  const clearance = useClearanceProducts(storeId)
  const newArrivals = useStoreProducts(storeId, { newOnly: true })
  // 화면 맨 위에서 당겼다 놓으면 상품 줄·카테고리 사진·점포 목록·배너를 다시 읽는다(태우님 usePullToRefresh 그대로 쓴다)
  const queryClient = useQueryClient()
  const {
    ref: pullRef,
    pull,
    ready,
  } = usePullToRefresh<HTMLDivElement>(() => {
    void clearance.refetch()
    void newArrivals.refetch()
    void queryClient.invalidateQueries({
      queryKey: ['customer', 'stores', storeId, 'products', 'best'],
    })
    void stores.refetch()
    void queryClient.invalidateQueries({ queryKey: ['customer', 'banners'] })
  })

  return (
    <div ref={pullRef} className="space-y-6">
      <PullIndicator pull={pull} ready={ready} />
      <h1 className="sr-only">freshLink 홈</h1>
      <PickupStoreButton store={pickup} distanceKm={distance} temporary={temporary} />
      <HomeBanner />
      <CategoryGrid storeId={storeId} storeName={name} />
      <ProductSearch storeId={storeId} storeName={name} />
      {/* 11/11 경우 시안: 신상품 → 오늘 마감세일 → 베스트 상품(세로 1~5위). 점주 추천 줄은 홈에서 빼고 점포 목록 조건 버튼에만 둔다 */}
      <ProductRail kind="new" storeId={storeId} storeName={name} query={newArrivals} />
      <ProductRail kind="clearance" storeId={storeId} storeName={name} query={clearance} />
      <BestProducts storeId={storeId} storeName={name} />
      <NearbyStores
        position={position}
        stores={stores}
        pickupId={temporary ? undefined : storeId}
      />
    </div>
  )
}

/** 홈 ⑤ 픽업 점포 상품 검색. 검색하면 그 점포 상품 목록을 검색어(?q=)와 함께 연다 */
function ProductSearch({ storeId, storeName }: { storeId: number; storeName: string }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = draft.trim()
    navigate(`/customer/stores/${storeId}${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      state: { storeName },
    })
  }
  return (
    <form onSubmit={onSubmit} role="search">
      <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white pr-1 pl-3 focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700">
        <Search className="size-4 shrink-0 text-slate-600" aria-hidden />
        <span className="sr-only">{storeName} 상품 검색</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={PRODUCT_KEYWORD_MAX}
          placeholder={`${storeName} 상품 검색`}
          enterKeyHint="search"
          className="min-h-12 w-full min-w-0 text-base text-slate-900 outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          검색
        </button>
      </label>
    </form>
  )
}
