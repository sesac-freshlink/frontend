import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/ui/cn'

interface ConfirmDialogProps {
  title: string
  confirmLabel: string
  pending: boolean
  onConfirm(): void
  onClose(): void
}

/** 한 번 더 묻는 작은 확인 모달 (A7 결제 전 취소). 처리 중에는 닫히지 않는다 */
export function ConfirmDialog({
  title,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    if (pending) e.preventDefault()
  }

  const onDialogClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget
    if (dialog.open) return
    if (pending) dialog.showModal()
    else onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
        {title}
      </h2>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
