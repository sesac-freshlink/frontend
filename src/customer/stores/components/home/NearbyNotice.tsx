import { MapPin } from 'lucide-react'
import { formatDistance } from '../../nearby'
import { withSubject, withTo } from '../../nearbyNotice'

/**
 * 홈 픽업 점포 줄 바로 아래 "더 가까운 점포" 안내 띠 (11/14 경우 결정: 시안 (가) + 버튼 안 1).
 * 지금 위치에서 픽업 점포가 10km 넘게 멀고 지금 시·도에 더 가까운 점포가 있을 때, 이번 접속 동안 한 번
 */
export function NearbyNotice({
  nearestName,
  nearestKm,
  onSwitch,
  onKeep,
}: {
  nearestName: string
  nearestKm: number
  onSwitch: () => void
  onKeep: () => void
}) {
  return (
    <section
      aria-label="더 가까운 점포 안내"
      className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
    >
      <div className="flex gap-2.5">
        <MapPin className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
        <p className="text-sm break-keep text-slate-900">
          픽업 점포가 지금 계신 곳에서 멀어요. 더 가까운{' '}
          {withSubject(nearestName, `(${formatDistance(nearestKm)})`)} 있어요.
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSwitch}
          className="min-h-12 flex-1 rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white hover:bg-emerald-800"
        >
          {withTo(nearestName)} 바꾸기
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="min-h-12 rounded-xl px-3 text-base text-slate-600 hover:bg-slate-100"
        >
          그대로 두기
        </button>
      </div>
    </section>
  )
}
