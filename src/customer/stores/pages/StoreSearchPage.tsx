import { ChevronDown, ChevronRight, Heart, List, MapPin, Search, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useMyProfile } from '@/auth/api'
import { DEFAULT_REGION, isRegionCode, REGIONS, type RegionCode } from '@/auth/regions'
import { useCustomerOrders } from '@/customer/order/api'
import { EMPTY_PERIOD } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/QueryState'
import { STORE_KEYWORD_MAX, useStores, type StoreSummary } from '../api'
import { StoreSearchMap } from '../components/StoreSearchMap'
import {
  markFavoriteHintShown,
  readFavoriteStores,
  toggleFavoriteStore,
  type FavoriteStore,
} from '../favoriteStores'
import { formatDistance, type LatLng } from '../nearby'
import { readPickupStore, savePickupStore, type PickupStore } from '../pickupStore'
import {
  favoriteRows,
  nearRows,
  recentRows,
  type StoreRow,
  type StoreSearchTab,
} from '../storeSearchTabs'
import { useCurrentPosition } from '../useCurrentPosition'

/**
 * U-01 점포 검색 (/customer/stores, 하단 메뉴 [점포 검색]): 거주 지역의 점포를 지도와 목록으로 보여 주고 지역·검색어로 다시 찾는다.
 * 11/11 지도형(경우 결정): 탭 가까운순·최근 주문·단골, 지도에 점포 핀과 내 위치, 핀을 누르면 아래 점포 칸. 서버 변경 없음
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
 * 점포 검색이 어디서 열렸는지에 따라 제목과 점포 칸의 버튼 순서만 다르다(11/11 경우 결정: 누르기만으로는 픽업 점포를 바꾸지 않는다).
 * - 고르기(?pick=1): 홈 맨 위 픽업 점포 줄·점포 찾기 안내·내 주변 점포 안내에서 연다. 지도 점포 칸의 [픽업 점포로 정하기]가 앞에 오고, 누르면 저장하고 홈으로.
 * - 둘러보기(쿼리 없음): 하단 메뉴 [점포 검색]에서 연다. [점포 보기]가 앞에 오고, [픽업 점포로 정하기]는 저장만 한다.
 * 목록 줄을 누르면 어느 쪽이든 그 점포 둘러보기(상품 목록)로 간다. 픽업 점포는 그 화면의 [픽업 점포로 정하기]로도 정할 수 있다
 */
export const PICK_STORE_PATH = '/customer/stores?pick=1'

const TABS: { value: StoreSearchTab; label: string }[] = [
  { value: 'near', label: '가까운순' },
  { value: 'recent', label: '최근 주문' },
  { value: 'favorite', label: '단골 점포' },
]

/** 최근 주문 탭이 읽는 주문 수(OR-06 한 묶음 최대). 이 안에 나온 점포만 보여 준다 */
const RECENT_ORDER_COUNT = 50

function StoreSearch({ initialRegion }: { initialRegion: RegionCode }) {
  const [region, setRegion] = useState<RegionCode>(initialRegion)
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<StoreSearchTab>('near')
  const [showMap, setShowMap] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // 겹친 핀 묶음을 더 확대할 수 없을 때 지도 위에 보여 줄 점포들(목록 시트)
  const [clusterIds, setClusterIds] = useState<number[] | null>(null)
  const clearSelection = () => {
    setSelectedId(null)
    setClusterIds(null)
  }
  const stores = useStores({ region, keyword })
  const [pickup, setPickup] = useState<PickupStore | null>(readPickupStore)
  const [favorites, setFavorites] = useState<FavoriteStore[]>(readFavoriteStores)
  // 위치 권한은 [내 위치로]·[가까운순]을 누를 때 묻는다(11/11 검수). 이미 허용한 기기면 바로 쓴다.
  // 홈은 들어올 때 묻는 그대로 둔다(임시 점포를 정해야 해서)
  const [locating, setLocating] = useState(false)
  useEffect(() => {
    let alive = true
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (alive && status.state === 'granted') setLocating(true)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  const located = useCurrentPosition(locating)
  const position = locating && located.status === 'ok' ? located.position : null
  const [focusPinId, setFocusPinId] = useState<number | null>(null)
  const tabRefs = useRef<Map<StoreSearchTab, HTMLButtonElement>>(new Map())
  const [searchParams] = useSearchParams()
  const picking = searchParams.get('pick') === '1'
  const navigate = useNavigate()
  const regionName = REGIONS.find((r) => r.code === region)?.name ?? ''

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setKeyword(draft)
    clearSelection()
  }
  const pick = (store: PickupStore) => {
    savePickupStore(store)
    setPickup(store)
  }
  const toggleFavorite = (row: StoreRow) => {
    const next = toggleFavoriteStore({ storeId: row.storeId, name: row.name, address: row.address })
    setFavorites(next)
    // ♥ 색이 바뀌는 것으로 충분해 알림은 이 기기에서 처음 넣을 때 한 번만 띄운다(11/11 검수)
    if (next.some((f) => f.storeId === row.storeId) && markFavoriteHintShown()) {
      toast.success('단골 점포에 넣었어요. [단골 점포] 탭에서 모아 볼 수 있어요.')
    }
  }
  const onSelect = useCallback((storeId: number) => {
    setClusterIds(null)
    setSelectedId(storeId)
  }, [])
  const onClusterList = useCallback((storeIds: number[]) => {
    setSelectedId(null)
    setClusterIds(storeIds)
  }, [])
  const onPinFocused = useCallback(() => setFocusPinId(null), [])
  const requestLocation = useCallback(() => {
    if (located.status === 'unavailable' && locating) {
      toast('위치를 알 수 없어요. 브라우저 설정에서 위치 권한을 켜 주세요.')
      return
    }
    setLocating(true)
  }, [located.status, locating])
  const selectTab = (next: StoreSearchTab) => {
    setTab(next)
    clearSelection()
    if (next === 'near') requestLocation()
  }
  // 탭 목록: 왼쪽·오른쪽 화살표, Home·End 로 옮기고 바로 고른다(WAI-ARIA 탭 패턴)
  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.value === tab)
    const last = TABS.length - 1
    const to =
      e.key === 'ArrowRight'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowLeft'
          ? i === 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (to === null) return
    e.preventDefault()
    const next = TABS[to].value
    selectTab(next)
    tabRefs.current.get(next)?.focus()
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3" aria-labelledby="store-search-title">
        <div className="flex items-center justify-between gap-3">
          <h1 id="store-search-title" className="text-xl font-bold text-slate-900">
            {picking ? '픽업할 점포 고르기' : '점포 검색'}
          </h1>
          {/* 지역은 바꿀 일이 드물어 제목 옆에 작게 둔다. 위치를 거절했을 때도 지역으로 찾는다 */}
          <label className="relative flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-medium text-slate-700 focus-within:ring-2 focus-within:ring-emerald-700">
            <MapPin className="size-4 text-slate-500" aria-hidden />
            <span className="sr-only">지역</span>
            <select
              value={region}
              onChange={(e) => {
                if (isRegionCode(e.target.value)) {
                  setRegion(e.target.value)
                  clearSelection()
                }
              }}
              className="min-h-11 appearance-none bg-transparent pr-5 text-base outline-none sm:text-sm"
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
              className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              검색
            </button>
          </label>
        </form>

        <div className="flex items-end justify-between gap-2 border-b border-slate-200">
          <div role="tablist" aria-label="점포 보기 기준" className="flex" onKeyDown={onTabKeyDown}>
            {TABS.map((t) => (
              <button
                key={t.value}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.value, el)
                }}
                type="button"
                role="tab"
                id={`store-tab-${t.value}`}
                aria-selected={tab === t.value}
                aria-controls="store-tab-panel"
                tabIndex={tab === t.value ? 0 : -1}
                onClick={() => selectTab(t.value)}
                className={cn(
                  '-mb-px min-h-11 border-b-2 px-3 text-sm font-semibold',
                  tab === t.value
                    ? 'border-emerald-700 text-emerald-700'
                    : 'border-transparent text-slate-600',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* 켜면 지도를 접고 목록만 보인다. 켜짐 상태는 aria-pressed 로 알린다 */}
          <button
            type="button"
            aria-pressed={!showMap}
            onClick={() => {
              setShowMap((v) => !v)
              clearSelection()
            }}
            className={cn(
              'mb-0.5 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium',
              showMap ? 'text-slate-700' : 'bg-emerald-50 text-emerald-800',
            )}
          >
            <List className="size-4" aria-hidden />
            목록만
          </button>
        </div>

        {tab === 'near' && !locating && (
          <p className="flex flex-wrap items-center gap-x-1 text-sm text-slate-600">
            {regionName} 점포를 이름순으로 보여 드려요.
            <button
              type="button"
              onClick={requestLocation}
              className="inline-flex min-h-11 items-center font-semibold text-emerald-700 underline underline-offset-2"
            >
              내 위치로 가까운 순 보기
            </button>
          </p>
        )}
        {tab === 'near' && locating && located.status === 'unavailable' && (
          <p className="text-sm text-slate-600">
            위치를 알 수 없어 {regionName} 점포를 이름순으로 보여 드려요. 위치 권한을 켜면 가까운
            순으로 보여 드려요.
          </p>
        )}

        {/* 화면 읽기 프로그램에 점포 칸이 열린 것을 알린다(포커스도 칸 제목으로 옮긴다) */}
        <p aria-live="polite" className="sr-only">
          {selectedId !== null ? '지도에서 고른 점포 정보를 열었어요' : ''}
        </p>

        <div role="tabpanel" id="store-tab-panel" aria-labelledby={`store-tab-${tab}`}>
          <TabRows
            tab={tab}
            stores={stores}
            searched={keyword.trim() !== ''}
            regionName={regionName}
            favorites={favorites}
            position={position}
          >
            {(rows) => {
              const selected = rows.find((r) => r.storeId === selectedId) ?? null
              const clustered = clusterIds ? rows.filter((r) => clusterIds.includes(r.storeId)) : []
              return (
                <>
                  {showMap && (
                    <StoreSearchMap
                      rows={rows}
                      selectedId={selected?.storeId ?? null}
                      pickupId={pickup?.storeId}
                      position={position}
                      onSelect={onSelect}
                      onRequestLocation={requestLocation}
                      onClusterList={onClusterList}
                      focusPinId={focusPinId}
                      onPinFocused={onPinFocused}
                      sheet={
                        clustered.length > 1 ? (
                          <ClusterSheet
                            rows={clustered}
                            onPick={onSelect}
                            onClose={() => {
                              // 닫으면 그 묶음 핀으로 포커스를 돌려준다
                              setFocusPinId(clustered[0].storeId)
                              setClusterIds(null)
                            }}
                          />
                        ) : (
                          selected && (
                            <SelectedStore
                              row={selected}
                              picking={picking}
                              isPickup={selected.storeId === pickup?.storeId}
                              isFavorite={favorites.some((f) => f.storeId === selected.storeId)}
                              onClose={() => {
                                // 닫으면 그 점포 핀으로 포커스를 돌려준다
                                setFocusPinId(selected.storeId)
                                setSelectedId(null)
                              }}
                              onToggleFavorite={() => toggleFavorite(selected)}
                              onPick={() => {
                                pick({ storeId: selected.storeId, name: selected.name })
                                if (picking) {
                                  void navigate('/customer')
                                  return
                                }
                                toast.success('픽업 점포로 정했어요')
                              }}
                            />
                          )
                        )
                      }
                    />
                  )}
                  <StoreList
                    rows={rows}
                    pickupId={pickup?.storeId}
                    favoriteIds={new Set(favorites.map((f) => f.storeId))}
                    onToggleFavorite={toggleFavorite}
                  />
                </>
              )
            }}
          </TabRows>
        </div>
      </section>
    </div>
  )
}

type StoresQuery = ReturnType<typeof useStores>

interface TabRowsProps {
  tab: StoreSearchTab
  stores: StoresQuery
  searched: boolean
  regionName: string
  favorites: FavoriteStore[]
  position: LatLng | null
  children: (rows: StoreRow[]) => ReactNode
}

/** 탭마다 목록 줄을 만든다. 점포 목록을 읽는 중·실패·빈 목록은 여기서 보여 준다 */
function TabRows(props: TabRowsProps) {
  const { stores, searched, tab, favorites, position } = props
  // 같은 점포 목록·위치·단골이면 같은 배열을 내려 지도가 핀을 다시 맞추지 않게 한다
  const near = useMemo(
    () => (stores.data ? nearRows(stores.data, position) : []),
    [stores.data, position],
  )
  const favs = useMemo(
    () => (stores.data ? favoriteRows(favorites, stores.data, position) : []),
    [favorites, stores.data, position],
  )
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
  if (tab === 'recent') return <RecentRows {...props} storeList={stores.data} />
  if (tab === 'favorite') {
    if (favs.length === 0) {
      return (
        <EmptyState
          message="단골 점포가 아직 없어요."
          hint="점포 옆 ♥를 누르면 여기에 모아 둬요. 이 기기에만 남아요."
        />
      )
    }
    return <RowsCaption label="단골 점포" rows={favs} render={props.children} />
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
    <RowsCaption
      label={searched ? '검색 결과' : props.regionName}
      rows={near}
      render={props.children}
    />
  )
}

/** 최근 주문 탭: 주문 내역(OR-06)에서 점포 이름을 모은다. 이 탭을 열 때만 읽는다 */
function RecentRows({
  storeList,
  position,
  children,
  regionName,
}: TabRowsProps & { storeList: StoreSummary[] }) {
  const orders = useCustomerOrders({
    tab: 'ALL',
    page: 0,
    size: RECENT_ORDER_COUNT,
    period: EMPTY_PERIOD,
  })
  const data = orders.data
  const rows = useMemo(
    () =>
      data
        ? recentRows(
            data.content.map((o) => o.storeName),
            storeList,
            position,
          )
        : [],
    [data, storeList, position],
  )
  if (orders.isPending) return <LoadingState label="주문한 점포를 불러오는 중" />
  if (orders.isError) {
    return (
      <ErrorState
        message="주문 내역을 불러오지 못했어요."
        onRetry={() => void orders.refetch()}
        retrying={orders.isFetching}
      />
    )
  }
  const names = orders.data?.content.map((o) => o.storeName) ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        message={`${regionName}에서 주문한 점포가 없어요.`}
        hint={
          names.length > 0
            ? '다른 지역 점포에서 주문했다면 지역을 바꿔 보세요.'
            : '주문하면 여기에서 다시 찾을 수 있어요.'
        }
      />
    )
  }
  return (
    <RowsCaption
      label="최근 주문한 점포"
      note={`지금 고른 지역(${regionName})에서 주문한 점포만 보여요.`}
      rows={rows}
      render={children}
    />
  )
}

function RowsCaption({
  label,
  note,
  rows,
  render,
}: {
  label: string
  /** 목록 수 옆에 붙이는 한 줄 설명(최근 주문 탭) */
  note?: string
  rows: StoreRow[]
  render: (rows: StoreRow[]) => ReactNode
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {label} {rows.length}곳{note && <span className="block">{note}</span>}
      </p>
      {render(rows)}
    </div>
  )
}

/** 겹친 핀 묶음을 더 확대할 수 없을 때(같은 자리 점포) 지도 위에 띄우는 점포 목록. 누르면 그 점포 칸을 연다 */
function ClusterSheet({
  rows,
  onPick,
  onClose,
}: {
  rows: StoreRow[]
  onPick: (storeId: number) => void
  onClose: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <section
      aria-label="이 자리 점포 목록"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      className="absolute inset-x-2 bottom-2 z-20 space-y-1 rounded-2xl bg-white px-4 pt-2 pb-3 shadow-lg ring-1 ring-slate-200"
    >
      <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-slate-300" />
      <div className="flex items-center gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="flex-1 text-base font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          이 자리 점포 {rows.length}곳
        </h2>
        <button
          type="button"
          aria-label="점포 목록 닫기"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <ul className="max-h-40 divide-y divide-slate-200 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.storeId}>
            <button
              type="button"
              onClick={() => onPick(r.storeId)}
              className="flex min-h-11 w-full items-center gap-2 py-1 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{r.name}</span>
                <span className="block truncate text-xs text-slate-600">{r.address}</span>
              </span>
              {r.distanceKm !== null && (
                <span className="shrink-0 text-sm text-slate-600 tabular-nums">
                  {formatDistance(r.distanceKm)}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-slate-500" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 지도에서 고른 점포 칸: 이름·거리·주소·♥ 단골, [점포 보기]·[픽업 점포로 정하기] */
function SelectedStore({
  row,
  picking,
  isPickup,
  isFavorite,
  onClose,
  onToggleFavorite,
  onPick,
}: {
  row: StoreRow
  picking: boolean
  isPickup: boolean
  isFavorite: boolean
  onClose: () => void
  onToggleFavorite: () => void
  onPick: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // 점포 칸이 열리거나 다른 점포로 바뀌면 제목으로 포커스를 옮긴다(화면 읽기 프로그램이 점포 이름부터 읽는다)
  useEffect(() => {
    headingRef.current?.focus()
  }, [row.storeId])
  const view = (
    <Link
      to={`/customer/stores/${row.storeId}`}
      state={{ storeName: row.name, from: 'search' }}
      className={cn(
        'flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold',
        picking
          ? 'border border-slate-300 text-slate-800'
          : 'bg-emerald-700 text-white hover:bg-emerald-800',
      )}
    >
      점포 보기
    </Link>
  )
  const pickButton = isPickup ? (
    <p className="flex min-h-11 flex-1 items-center justify-center gap-1 text-sm font-semibold text-emerald-700">
      ✓ 내 픽업 점포
    </p>
  ) : (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold',
        picking
          ? 'bg-emerald-700 text-white hover:bg-emerald-800'
          : 'border border-slate-300 text-slate-800',
      )}
    >
      픽업 점포로 정하기
    </button>
  )
  return (
    // 지도 아래쪽에 겹쳐 띄우는 바텀 시트(11/11 검수). 열리면 제목으로 포커스, Esc 로 닫는다
    <section
      aria-label={`${row.name} 정보`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      className="absolute inset-x-2 bottom-2 z-20 space-y-2 rounded-2xl bg-white px-4 pt-2 pb-3 shadow-lg ring-1 ring-slate-200"
    >
      <span aria-hidden className="mx-auto block h-1 w-10 rounded-full bg-slate-300" />
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <span className="break-keep">{row.name}</span>
            {row.distanceKm !== null && (
              <span className="text-sm font-medium text-slate-600">
                {formatDistance(row.distanceKm)}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-600">{row.address}</p>
        </div>
        <FavoriteButton name={row.name} active={isFavorite} onClick={onToggleFavorite} />
        <button
          type="button"
          aria-label="점포 정보 닫기"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex gap-2">
        {picking ? (
          <>
            {pickButton}
            {view}
          </>
        ) : (
          <>
            {view}
            {pickButton}
          </>
        )}
      </div>
    </section>
  )
}

function FavoriteButton({
  name,
  active,
  onClick,
}: {
  name: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`${name} 단골 점포`}
      aria-pressed={active}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <Heart
        className={cn('size-5', active ? 'fill-red-600 text-red-600' : 'text-slate-500')}
        aria-hidden
      />
    </button>
  )
}

function StoreList({
  rows,
  pickupId,
  favoriteIds,
  onToggleFavorite,
}: {
  rows: StoreRow[]
  pickupId: number | undefined
  favoriteIds: ReadonlySet<number>
  onToggleFavorite: (row: StoreRow) => void
}) {
  return (
    <ul className="divide-y divide-slate-200 border-t border-slate-200">
      {rows.map((s) => (
        <li key={s.storeId} className="flex items-center gap-1">
          {/* 누르면 저장하지 않고 그 점포 상품 화면(둘러보기)으로. 픽업 점포는 [픽업 점포로 정하기]로만 정한다 */}
          <Link
            to={`/customer/stores/${s.storeId}`}
            state={{ storeName: s.name, from: 'search' }}
            className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="text-base font-semibold text-slate-900">{s.name}</span>
                {s.storeId === pickupId && (
                  <span className="text-xs font-semibold text-emerald-700">픽업 점포</span>
                )}
              </span>
              <span className="block truncate text-sm text-slate-600">{s.address}</span>
            </span>
            {s.distanceKm !== null && (
              <span className="shrink-0 text-sm text-slate-600 tabular-nums">
                {formatDistance(s.distanceKm)}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-slate-500" aria-hidden />
          </Link>
          <FavoriteButton
            name={s.name}
            active={favoriteIds.has(s.storeId)}
            onClick={() => onToggleFavorite(s)}
          />
        </li>
      ))}
    </ul>
  )
}
