import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'
import { formatPickupDate, formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { type OwnerOrder, pickupErrorMessage, usePickUpOrder } from '../api'

interface PickupConfirmModalProps {
  order: OwnerOrder
  onClose(): void
}

/** A5 픽업 확인 모달. "픽업 완료 처리하시겠습니까?"를 묻고 OR-05 를 부른다. 되돌리기는 없다 */
export function PickupConfirmModal({ order, onClose }: PickupConfirmModalProps) {
  const pickUp = usePickUpOrder()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pending = pickUp.isPending

  // 네이티브 모달로 연다 (StoreEditModal 과 같은 방식). 언마운트 때 close() 해야 [픽업 확인] 버튼으로 포커스가 돌아간다
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  // Escape(cancel). 처리 중에는 막는다
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    if (pending) e.preventDefault()
  }

  // 브라우저가 닫은 경우(Escape 등)만 부모에 알린다. 처리 중에 닫히면 다시 연다
  const onDialogClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget
    if (dialog.open) return
    if (pending) dialog.showModal()
    else onClose()
  }

  const onConfirm = async () => {
    try {
      await pickUp.mutateAsync(order.orderId)
      toast.success(`${order.orderNo} 픽업 완료했어요`)
    } catch (e) {
      toast.error(pickupErrorMessage(e))
    }
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pickup-confirm-title"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="pickup-confirm-title" className="text-lg font-bold text-slate-900">
        픽업 완료 처리하시겠습니까?
      </h2>
      <dl className="grid grid-cols-3 gap-y-1 text-sm">
        <dt className="text-slate-500">주문번호</dt>
        <dd className="col-span-2 font-medium text-slate-900">{order.orderNo}</dd>
        <dt className="text-slate-500">상품</dt>
        <dd className="col-span-2 text-slate-900">
          {order.productName} {order.quantity}개
        </dd>
        <dt className="text-slate-500">금액</dt>
        <dd className="col-span-2 text-slate-900">{formatWon(order.amount)}</dd>
        {order.pickupDeadline && (
          <>
            <dt className="text-slate-500">픽업 기한</dt>
            <dd className="col-span-2 text-slate-900">
              {formatPickupDate(order.pickupDeadline)}까지
            </dd>
          </>
        )}
      </dl>
      <p className="text-sm text-slate-500">완료하면 되돌릴 수 없어요.</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={pending}
          aria-busy={pending}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          픽업 완료
        </button>
      </div>
    </dialog>
  )
}
