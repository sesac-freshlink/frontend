import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { DefaultStoreReason } from '../../homeRows'
import { formatDistance } from '../../nearby'
import type { PickupStore } from '../../pickupStore'

/** 줄 앞 이름표. 손님이 고른 점포는 "픽업 점포", 임시 점포는 고른 까닭을 보인다 */
const LABELS: Record<DefaultStoreReason | 'saved', string> = {
  saved: '픽업 점포',
  nearest: '가까운 점포',
  region: '내 지역 점포',
}

/**
 * 홈 ② 픽업 점포 한 줄. 누르면 점포 검색 화면에서 다른 점포로 바꾼다.
 * 임시 점포(손님이 아직 안 고름)면 "가까운 점포"·"내 지역 점포" 이름표와 [바꾸기]를 보여 임시임을 알린다.
 * 거리는 내 위치와 점포 좌표를 둘 다 알 때만 보인다
 */
export function PickupStoreButton({
  store,
  distanceKm,
  temporary = null,
}: {
  store: PickupStore
  distanceKm: number | null
  /** 임시 점포면 고른 까닭, 손님이 고른 점포면 null */
  temporary?: DefaultStoreReason | null
}) {
  const label = LABELS[temporary ?? 'saved']
  const distance = distanceKm === null ? '' : `, ${formatDistance(distanceKm)}`
  return (
    <Link
      to="/customer/stores"
      aria-label={`${label} ${store.name}${distance}. 다른 점포로 바꾸기`}
      className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 py-2 ring-1 ring-slate-200"
    >
      <span className="shrink-0 text-sm text-slate-600">{label}</span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
        {store.name}
      </span>
      {distanceKm !== null && (
        <span className="shrink-0 text-sm text-slate-600">{formatDistance(distanceKm)}</span>
      )}
      {temporary ? (
        <span className="shrink-0 text-sm font-semibold text-emerald-700">바꾸기</span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-slate-600" aria-hidden />
      )}
    </Link>
  )
}
