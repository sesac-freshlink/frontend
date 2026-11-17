import { MapPin } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { formatDistance } from '../nearby'
import { withSubject, withTo, withTopic } from '../nearbyNotice'
import type { FarPick } from '../useFarPickGuard'

/**
 * 점포 정할 때 확인 창 (11/14 경우 결정, 시안 ②): "멀리 있는 점포예요" [가까운 점포 보기] [○○점으로 정하기].
 * 네이티브 모달이라 초점 가두기·Esc 닫기는 브라우저가 맡는다(Esc 는 아무것도 정하지 않고 닫는다)
 */
export function FarPickDialog({
  pick,
  onClose,
  onShowNearby,
}: {
  pick: FarPick
  onClose: () => void
  onShowNearby: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])
  const finish = (after: () => void) => {
    dialogRef.current?.close()
    after()
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="far-pick-title"
      onClose={(e) => {
        if (!e.currentTarget.open) onClose()
      }}
      className="m-auto w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg backdrop:bg-slate-900/40"
    >
      <MapPin className="size-6 text-emerald-700" aria-hidden />
      <h2 id="far-pick-title" className="mt-2 text-lg font-bold text-slate-900">
        멀리 있는 점포예요
      </h2>
      <p className="mt-2 text-sm break-keep text-slate-600">
        {withTopic(pick.targetName)} 지금 계신 곳에서 {formatDistance(pick.farKm)}예요. 더 가까운{' '}
        {withSubject(pick.nearest.name, `(${formatDistance(pick.nearestKm)})`)} 있어요.
      </p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => finish(onShowNearby)}
          className="min-h-12 rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white hover:bg-emerald-800"
        >
          가까운 점포 보기
        </button>
        <button
          type="button"
          onClick={() => finish(pick.save)}
          className="min-h-12 rounded-xl bg-white px-4 text-base font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          {withTo(pick.targetName)} 정하기
        </button>
      </div>
    </dialog>
  )
}
