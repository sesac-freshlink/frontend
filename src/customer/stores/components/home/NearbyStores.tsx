import { ChevronRight, MapPinOff } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/QueryState'
import type { StoreSummary } from '../../api'
import { nearestStores } from '../../homeRows'
import { formatDistance } from '../../nearby'
import type { PickupStore } from '../../pickupStore'
import type { PositionState } from '../../useCurrentPosition'

/**
 * 홈 ⑦ 내 주변 점포: 내 위치에서 가까운 3곳(같은 지역 점포 목록의 좌표로 거리 계산). 오른쪽에 거리.
 * 위치 권한을 거절했거나 위치를 못 얻으면 점포 검색으로 안내한다. 누르면 그 점포를 픽업 점포로 정하고 상품 목록으로 간다
 */
export function NearbyStores({
  position,
  stores,
  pickupId,
  onPick,
}: {
  position: PositionState
  stores: {
    isPending: boolean
    isError: boolean
    data: StoreSummary[] | undefined
    refetch: () => unknown
    isFetching: boolean
  }
  pickupId: number
  onPick: (store: PickupStore) => void
}) {
  return (
    <section aria-labelledby="home-nearby" className="space-y-2">
      <h2 id="home-nearby" className="text-lg font-bold text-slate-900">
        내 주변 점포
      </h2>
      <NearbyBody position={position} stores={stores} pickupId={pickupId} onPick={onPick} />
    </section>
  )
}

function NearbyBody({ position, stores, pickupId, onPick }: Parameters<typeof NearbyStores>[0]) {
  if (position.status === 'unavailable') {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <MapPinOff className="mt-0.5 size-5 shrink-0 text-slate-600" aria-hidden />
        <div className="space-y-2">
          <p className="text-sm text-slate-800">
            위치를 알 수 없어 가까운 점포를 찾지 못했어요. 브라우저 설정에서 위치 권한을 켜거나
            점포를 직접 찾아 주세요.
          </p>
          <Link
            to="/customer/stores"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700"
          >
            점포 검색으로 가기
          </Link>
        </div>
      </div>
    )
  }
  if (position.status === 'pending' || stores.isPending) {
    return <LoadingState label="가까운 점포를 찾는 중" className="py-6" />
  }
  if (stores.isError) {
    return (
      <ErrorState
        className="py-4"
        message="점포를 불러오지 못했어요."
        onRetry={() => void stores.refetch()}
        retrying={stores.isFetching}
      />
    )
  }
  const rows = nearestStores(stores.data ?? [], position.position)
  if (rows.length === 0) {
    return (
      <EmptyState
        className="py-4"
        message="거리를 알 수 있는 점포가 아직 없어요."
        hint="점포 검색에서 지역으로 찾아 보세요."
      />
    )
  }
  return (
    <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
      {rows.map(({ store, distanceKm }) => (
        <li key={store.storeId}>
          <Link
            to={`/customer/stores/${store.storeId}`}
            state={{ storeName: store.name }}
            onClick={() => onPick({ storeId: store.storeId, name: store.name })}
            className="flex min-h-14 items-center gap-3 px-4 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold text-slate-900">
                  {store.name}
                </span>
                {store.storeId === pickupId && (
                  <span className="shrink-0 text-xs font-semibold text-emerald-700">픽업 점포</span>
                )}
              </span>
              <span className="block truncate text-sm text-slate-600">{store.address}</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-slate-800">
              {formatDistance(distanceKm)}
            </span>
            <ChevronRight className="size-4 shrink-0 text-slate-600" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
