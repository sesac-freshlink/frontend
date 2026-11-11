import { ChevronDown, ChevronRight, MapPin, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { DEFAULT_REGION, isRegionCode, REGIONS, type RegionCode } from '@/auth/regions'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/QueryState'
import { STORE_KEYWORD_MAX, useStores } from '../api'
import { readPickupStore, savePickupStore, type PickupStore } from '../pickupStore'

/**
 * U-01 점포 검색 (/customer/stores, 하단 메뉴 [점포 검색]): 거주 지역의 점포를 보여 주고 지역·검색어로 다시 찾는다.
 * 점포를 누르면 그 점포를 픽업 점포로 정하고(이 기기에 저장) 고객 홈으로 돌아간다. 홈에 있던 찾기를 옮겼다
 */
export function StoreSearchPage() {
  const profile = useMyProfile()

  if (profile.isPending) return <FullScreenSpinner />
  // 로그인했는데 프로필이 없으면 프로필 등록 마무리 화면으로 (기능명세 M1)
  if (profile.data === null) return <Navigate to="/signup" replace />

  const me = profile.data?.role === 'CUSTOMER' ? profile.data : undefined
  const myRegion = me && isRegionCode(me.region) ? me.region : DEFAULT_REGION
  return <StoreSearch initialRegion={myRegion} />
}

/**
 * 점포 검색이 어디서 열렸는지에 따라 점포를 눌렀을 때 하는 일이 다르다(11/11 경우 시나리오).
 * - 고르기(?pick=1): 홈 맨 위 픽업 점포 줄·점포 고르기 안내·내 주변 점포 안내에서 연다. 누르면 픽업 점포로 저장하고 홈으로.
 * - 둘러보기(쿼리 없음): 하단 메뉴 [점포 검색]에서 연다. 누르면 픽업 점포는 그대로 두고 그 점포 상품 화면(둘러보기)으로
 */
export const PICK_STORE_PATH = '/customer/stores?pick=1'

function StoreSearch({ initialRegion }: { initialRegion: RegionCode }) {
  const [region, setRegion] = useState<RegionCode>(initialRegion)
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const stores = useStores({ region, keyword })
  const [pickup, setPickup] = useState<PickupStore | null>(readPickupStore)
  const [searchParams] = useSearchParams()
  const picking = searchParams.get('pick') === '1'
  const regionName = REGIONS.find((r) => r.code === region)?.name ?? ''

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setKeyword(draft)
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="store-search-title">
        <div className="flex items-center justify-between gap-3">
          <h1 id="store-search-title" className="text-xl font-bold text-slate-900">
            {picking ? '픽업할 점포 고르기' : '점포 검색'}
          </h1>
          {/* 지역은 바꿀 일이 드물어 제목 옆에 작게 둔다. 검색창이 화면 폭을 다 쓰게 한다 */}
          <label className="relative flex min-h-11 items-center gap-1 text-sm font-medium text-slate-700">
            <MapPin className="size-4 text-slate-500" aria-hidden />
            <span className="sr-only">지역</span>
            <select
              value={region}
              onChange={(e) => {
                if (isRegionCode(e.target.value)) setRegion(e.target.value)
              }}
              className="appearance-none bg-transparent pr-5 text-base outline-none sm:text-sm"
            >
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 size-4 text-slate-500"
              aria-hidden
            />
          </label>
        </div>

        <form onSubmit={onSearch} role="search">
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 pr-1 pl-3 focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700">
            <Search className="size-4 shrink-0 text-slate-500" aria-hidden />
            <span className="sr-only">검색어</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={STORE_KEYWORD_MAX}
              placeholder="점포명이나 주소"
              className="min-h-12 w-full min-w-0 text-base text-slate-900 outline-none placeholder:text-slate-500 sm:text-sm"
            />
            <button
              type="submit"
              className="min-h-10 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              검색
            </button>
          </label>
        </form>

        <StoreList
          stores={stores}
          searched={keyword.trim() !== ''}
          regionName={regionName}
          pickupId={pickup?.storeId}
          picking={picking}
          onPick={(store) => {
            savePickupStore(store)
            setPickup(store)
          }}
        />
      </section>
    </div>
  )
}

function StoreList({
  stores,
  searched,
  regionName,
  pickupId,
  picking,
  onPick,
}: {
  stores: ReturnType<typeof useStores>
  searched: boolean
  regionName: string
  pickupId: number | undefined
  /** true 면 고르기(저장하고 홈으로), false 면 둘러보기(저장하지 않고 그 점포 상품 화면으로) */
  picking: boolean
  onPick: (store: PickupStore) => void
}) {
  if (stores.isPending) return <LoadingState label="점포를 불러오는 중" />
  if (stores.isError) {
    return (
      <ErrorState
        message="점포를 불러오지 못했어요."
        onRetry={() => void stores.refetch()}
        retrying={stores.isFetching}
      />
    )
  }
  if (stores.data.length === 0) {
    return (
      <EmptyState
        message={searched ? '검색어에 맞는 점포가 없어요.' : '이 지역에는 아직 점포가 없어요.'}
        hint={searched ? '점포명이나 주소를 다르게 넣어 보세요.' : '다른 지역을 골라 보세요.'}
      />
    )
  }

  return (
    <div>
      <p className="pb-1 text-sm text-slate-600">
        {searched ? '검색 결과' : regionName} {stores.data.length}곳
      </p>
      <ul className="divide-y divide-slate-200 border-t border-slate-200">
        {stores.data.map((s) => (
          <li key={s.storeId}>
            {/* 고르기면 픽업 점포로 저장하고 홈으로(홈이 그 점포로 다시 채워진다), 둘러보기면 저장하지 않고 그 점포 상품 화면으로 */}
            <Link
              to={picking ? '/customer' : `/customer/stores/${s.storeId}`}
              state={picking ? undefined : { storeName: s.name, from: 'search' }}
              onClick={picking ? () => onPick({ storeId: s.storeId, name: s.name }) : undefined}
              className="flex min-h-16 items-center gap-3 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">{s.name}</span>
                  {s.storeId === pickupId && (
                    <span className="text-xs font-semibold text-emerald-700">픽업 점포</span>
                  )}
                </span>
                <span className="block truncate text-sm text-slate-600">{s.address}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
