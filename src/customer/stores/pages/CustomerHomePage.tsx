import { Search, Store } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { DEFAULT_REGION, isRegionCode, type RegionCode } from '@/auth/regions'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { PRODUCT_KEYWORD_MAX, useClearanceProducts, useStoreProducts, useStores } from '../api'
import { CategoryGrid } from '../components/home/CategoryGrid'
import { HomeBanner } from '../components/home/HomeBanner'
import { NearbyStores } from '../components/home/NearbyStores'
import { PickupStoreButton } from '../components/home/PickupStoreButton'
import { ProductRail } from '../components/home/ProductRail'
import { storeDistance } from '../homeRows'
import { readPickupStore, savePickupStore, type PickupStore } from '../pickupStore'
import { useCurrentPosition } from '../useCurrentPosition'

/**
 * U-01 고객 홈 (/customer). 위에서 아래로: 픽업 점포 한 줄 → 메인 배너 → 카테고리 4×2 → 점포 상품 검색 →
 * 상품 줄 3개(오늘 마감세일·점주 추천·신상품) → 내 주변 점포. 로고·알림 종·하단 메뉴는 CustomerLayout 이 그린다.
 * 픽업 점포를 아직 안 골랐으면 점포 고르기 안내만 보인다. 점포 찾기는 하단 메뉴 [점포 검색](StoreSearchPage)으로 옮겼다
 */
export function CustomerHomePage() {
  const profile = useMyProfile()
  const [pickup, setPickup] = useState<PickupStore | null>(readPickupStore)

  if (profile.isPending) return <FullScreenSpinner />
  // 로그인했는데 프로필이 없으면 프로필 등록 마무리 화면으로 (기능명세 M1)
  if (profile.data === null) return <Navigate to="/signup" replace />

  if (pickup === null) return <ChooseStore />

  const me = profile.data?.role === 'CUSTOMER' ? profile.data : undefined
  const region = me && isRegionCode(me.region) ? me.region : DEFAULT_REGION
  return (
    <Home
      pickup={pickup}
      region={region}
      onPick={(store) => {
        savePickupStore(store)
        setPickup(store)
      }}
    />
  )
}

/** 픽업 점포를 고르기 전: 홈의 다른 칸은 점포마다 달라 보여 줄 수 없어 고르기 안내만 둔다 */
function ChooseStore() {
  return (
    <section aria-labelledby="choose-store" className="space-y-4 py-12 text-center">
      <Store className="mx-auto size-10 text-emerald-700" strokeWidth={1.5} aria-hidden />
      <div className="space-y-1">
        <h1 id="choose-store" className="text-xl font-bold text-slate-900">
          픽업할 점포를 먼저 골라 주세요
        </h1>
        <p className="text-sm text-slate-600">
          고른 점포의 마감세일과 상품을 여기서 바로 볼 수 있어요.
        </p>
      </div>
      <Link
        to="/customer/stores"
        className="inline-flex min-h-12 items-center rounded-xl bg-emerald-700 px-6 text-base font-semibold text-white hover:bg-emerald-800"
      >
        점포 고르기
      </Link>
    </section>
  )
}

function Home({
  pickup,
  region,
  onPick,
}: {
  pickup: PickupStore
  region: RegionCode
  onPick: (store: PickupStore) => void
}) {
  const { storeId, name } = pickup
  const position = useCurrentPosition(true)
  const stores = useStores({ region, keyword: '' })
  const origin = position.status === 'ok' ? position.position : null
  const distance = storeDistance(
    stores.data?.find((s) => s.storeId === storeId),
    origin,
  )
  const clearance = useClearanceProducts(storeId)
  const recommended = useStoreProducts(storeId, { recommendedOnly: true })
  const newArrivals = useStoreProducts(storeId, { newOnly: true })

  return (
    <div className="space-y-6">
      <h1 className="sr-only">freshLink 홈</h1>
      <PickupStoreButton store={pickup} distanceKm={distance} />
      <HomeBanner />
      <CategoryGrid storeId={storeId} storeName={name} />
      <ProductSearch storeId={storeId} storeName={name} />
      <ProductRail kind="clearance" storeId={storeId} storeName={name} query={clearance} />
      <ProductRail kind="recommended" storeId={storeId} storeName={name} query={recommended} />
      <ProductRail kind="new" storeId={storeId} storeName={name} query={newArrivals} />
      <NearbyStores position={position} stores={stores} pickupId={storeId} onPick={onPick} />
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
