import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { apiErrorMessage, useDisposeExpired, type ExpiringLot } from '../api'
import { formatDateTime } from '../format'

interface Props {
  /** 지금 화면에 보이는 경과 lot 중 폐기 가능 수량이 남은 것(확인용으로 보여 준다) */
  lots: ExpiringLot[]
  onClose(): void
}

/**
 * S-32 경과 lot 한 번에 폐기 확인 모달. 요청은 한 번이고, 버릴 lot 과 수량은 서버가 요청 시점에 다시 정한다
 * (이미 요청해 두고 처리 전인 수량은 뺀다). 그래서 목록은 확인용이고, 토스트는 서버가 실제로 접수한 값으로 알린다
 */
export function DisposeExpiredDialog({ lots, onClose }: Props) {
  const disposeExpired = useDisposeExpired()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const total = lots.reduce((sum, lot) => sum + lot.disposableQuantity, 0)
  const submitting = disposeExpired.isPending

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const submit = () => {
    disposeExpired.mutate(undefined, {
      onSuccess: (result) => {
        if (result.lotCount === 0) toast.info('새로 폐기할 소비기한 지난 상품이 없어요.')
        else toast.success(`소비기한 지난 ${result.lotCount}묶음, ${result.quantity}개 폐기 요청됨`)
        onClose()
      },
      onError: (e) => toast.error(apiErrorMessage(e, '폐기 요청에 실패했어요.')),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispose-expired-title"
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="dispose-expired-title" className="text-lg font-bold text-slate-900">
          소비기한 지난 상품 전부 폐기
        </h2>
        <p className="text-sm text-slate-500">
          소비기한이 지난 묶음마다 폐기 가능 수량 전부를 한 번에 요청해요.
        </p>
        <ul className="max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 text-sm">
          {lots.map((lot) => (
            <li key={lot.lotId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <p className="font-medium text-slate-900">{lot.productName}</p>
                <p className="text-xs text-slate-500">소비기한 {formatDateTime(lot.expiryDate)}</p>
              </div>
              <span className="font-semibold text-slate-900 tabular-nums">
                {lot.disposableQuantity}개
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">합계</span>
          <span className="font-bold text-slate-900 tabular-nums">{total}개</span>
        </div>
        <p className="text-sm text-red-600">폐기하면 되돌릴 수 없어요.</p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-busy={submitting}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            전부 폐기 요청
          </button>
        </div>
      </div>
    </div>
  )
}
