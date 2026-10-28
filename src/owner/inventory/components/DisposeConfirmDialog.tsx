import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiErrorMessage, useDisposeLot, type ExpiringLot } from '../api'
import { formatDateTime } from '../format'

interface Props {
  lots: ExpiringLot[]
  /** 요청이 끝나면 성공한 lot 의 ID 를 넘긴다. 취소면 빈 배열 */
  onClose(succeededLotIds: number[]): void
}

/**
 * S-32 폐기 확인 모달. 고른 lot 마다 폐기 가능 수량 전량을 순서대로 요청한다(lot 하나씩 POST).
 * 전부 202 면 성공 토스트, 일부 실패면 실패한 lot 만 오류 토스트로 알린다. 수량은 쪽지 처리 뒤 폴링으로 줄어든다
 */
export function DisposeConfirmDialog({ lots, onClose }: Props) {
  const dispose = useDisposeLot()
  const [submitting, setSubmitting] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const total = lots.reduce((sum, lot) => sum + lot.disposableQuantity, 0)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const submit = async () => {
    setSubmitting(true)
    const succeeded: number[] = []
    let failed = 0
    for (const lot of lots) {
      try {
        await dispose.mutateAsync({ lotId: lot.lotId, quantity: lot.disposableQuantity })
        succeeded.push(lot.lotId)
      } catch (e) {
        failed++
        toast.error(apiErrorMessage(e, '폐기 요청에 실패했어요.'), {
          description: `${lot.productName} · ${formatDateTime(lot.expiryDate)}`,
        })
      }
    }
    if (failed === 0) toast.success('폐기 요청됨')
    setSubmitting(false)
    onClose(succeeded)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispose-title"
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="dispose-title" className="text-lg font-bold text-slate-900">
          폐기 요청
        </h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
          {lots.map((lot) => (
            <li key={lot.lotId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <p className="font-medium text-slate-900">{lot.productName}</p>
                <p className="text-xs text-slate-400">유통기한 {formatDateTime(lot.expiryDate)}</p>
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
            onClick={() => onClose([])}
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
            폐기 요청
          </button>
        </div>
      </div>
    </div>
  )
}
