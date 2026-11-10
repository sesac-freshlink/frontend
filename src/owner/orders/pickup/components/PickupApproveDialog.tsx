import { LoaderCircle } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { PICKUP_OUTCOME_LABEL } from '../api'
import { usePickupApprove } from '../usePickupApprove'

interface Props {
  /** 표(QR) 또는 고객 6자리 코드 */
  pickupKey: string
  onClose(): void
}

/**
 * 점주 컴퓨터 픽업 승인 창 (추가 명세 A16). 고객의 이 점포 미픽업 주문 중 픽업 준비 완료만 골라 승인한다.
 * 나머지는 흐리게 보인다. [픽업 승인] → "N건을 픽업 완료로 바꿀까요?" → 건마다 결과
 */
export function PickupApproveDialog({ pickupKey, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const flow = usePickupApprove(pickupKey)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const close = () => dialogRef.current?.close()

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pickup-approve-title"
      onClose={(e) => {
        if (!e.currentTarget.open) onClose()
      }}
      className={cn(
        'm-auto max-h-[85dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="pickup-approve-title" className="text-lg font-bold text-slate-900">
        픽업 QR 주문
      </h2>

      {flow.loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          주문을 불러오는 중이에요
        </p>
      )}
      {flow.loadError && (
        <p role="alert" className="text-sm text-red-600">
          {flow.loadError}
        </p>
      )}

      {!flow.loading && !flow.loadError && flow.step !== 'done' && (
        <>
          {flow.orders.length === 0 ? (
            <p className="text-sm text-slate-500">이 점포에서 받아 갈 주문이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {flow.orders.map((o) => (
                <li key={o.orderId}>
                  <label className="flex items-center gap-3 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={flow.selected.includes(o.orderId)}
                      disabled={!o.selectable || flow.step === 'confirm'}
                      onChange={() => flow.toggle(o)}
                      className="size-4 accent-emerald-600"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {o.orderNo} · {o.productName} {o.quantity}개
                    </span>
                    <span className="shrink-0">{o.amount === null ? '' : formatWon(o.amount)}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-emerald-700">
                      준비 완료
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {flow.submitError && (
            <p role="alert" className="text-sm text-red-600">
              {flow.submitError}
            </p>
          )}
        </>
      )}

      {flow.step === 'done' && (
        <ul className="space-y-1 text-sm">
          {flow.results.map((r) => {
            const order = flow.orders.find((o) => o.orderId === r.orderId)
            return (
              <li
                key={r.orderId}
                className={cn(r.result === 'PICKED_UP' ? 'text-emerald-700' : 'text-red-600')}
              >
                {order?.orderNo ?? r.orderId} · {PICKUP_OUTCOME_LABEL[r.result]}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {flow.step === 'select' && (
          <>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={flow.askConfirm}
              disabled={flow.selected.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              픽업 승인
            </button>
          </>
        )}
        {flow.step === 'confirm' && (
          <div className="flex w-full items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              {flow.selected.length}건을 픽업 완료로 바꿀까요?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={flow.back}
                disabled={flow.submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void flow.approve()}
                disabled={flow.submitting}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {flow.submitting && <LoaderCircle className="size-4 animate-spin" />}
                바꾸기
              </button>
            </div>
          </div>
        )}
        {flow.step === 'done' && (
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            확인
          </button>
        )}
      </div>
    </dialog>
  )
}
