import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/ui/cn'

interface ConfirmDialogProps {
  title: string
  /** 제목 아래 안내 한 줄 (픽업 신청) */
  description?: string
  confirmLabel: string
  /** danger: 취소처럼 되돌릴 수 없는 일(빨강), primary: 신청(초록) */
  tone?: 'danger' | 'primary'
  pending: boolean
  onConfirm(): void
  onClose(): void
}

/** 한 번 더 묻는 작은 확인 모달 (A7 결제 전 취소, 픽업 신청). 처리 중에는 닫히지 않는다 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = 'danger',
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
      {description && <p className="text-sm text-slate-600">{description}</p>}
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
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
            tone === 'danger' ? 'bg-red-600' : 'bg-emerald-700',
          )}
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
