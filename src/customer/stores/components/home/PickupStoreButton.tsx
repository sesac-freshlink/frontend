import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatDistance } from '../../nearby'
import type { PickupStore } from '../../pickupStore'

/**
 * 홈 ② 내 픽업 점포 한 줄. 누르면 점포 검색 화면에서 다른 점포로 바꾼다.
 * 거리는 내 위치와 점포 좌표를 둘 다 알 때만 보인다
 */
export function PickupStoreButton({
  store,
  distanceKm,
}: {
  store: PickupStore
  distanceKm: number | null
}) {
  return (
    <Link
      to="/customer/stores"
      aria-label={`픽업 점포 ${store.name}${distanceKm === null ? '' : `, ${formatDistance(distanceKm)}`}. 다른 점포로 바꾸기`}
      className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 py-2 ring-1 ring-slate-200"
    >
      <span className="shrink-0 text-sm text-slate-600">픽업 점포</span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
        {store.name}
      </span>
      {distanceKm !== null && (
        <span className="shrink-0 text-sm text-slate-600">{formatDistance(distanceKm)}</span>
      )}
      <ChevronRight className="size-4 shrink-0 text-slate-600" aria-hidden />
    </Link>
  )
}
