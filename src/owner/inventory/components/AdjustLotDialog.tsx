import { LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import { REASON_LABEL, checkCount } from '../adjustment'
import { apiErrorMessage, useAdjustLot, type AdjustmentReason, type InventoryLotItem } from '../api'
import { formatExpiry, formatSignedQuantity } from '../format'

const REASONS: AdjustmentReason[] = ['COUNT', 'DAMAGE', 'LOSS', 'OTHER']

interface Props {
  productName: string
  lot: InventoryLotItem
  onClose(): void
}

/**
 * S-14 lot 수동 조정 모달. 점주가 직접 센 수량을 넣으면 (센 수량 − 지금 수량)을 증감으로 보낸다.
 * 폐기와 달리 쪽지를 거치지 않아 응답 때 이미 반영돼 있다. 같은 lot 을 쪽지가 먼저 고쳤으면 409 가 오고,
 * 다시 읽은 수량이 패널에 보이므로 확인하고 다시 저장하면 된다
 */
export function AdjustLotDialog({ productName, lot, onClose }: Props) {
  const adjust = useAdjustLot()
  const [counted, setCounted] = useState(String(lot.quantity))
  const [reason, setReason] = useState<AdjustmentReason>('COUNT')
  const [memo, setMemo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const countId = useId()
  const memoId = useId()
  const check = checkCount(counted, lot)
  const submitting = adjust.isPending

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const submit = () => {
    if (!check.ok) return
    const trimmedMemo = memo.trim()
    adjust.mutate(
      {
        lotId: lot.lotId,
        delta: check.delta,
        reason,
        ...(trimmedMemo ? { memo: trimmedMemo } : {}),
      },
      {
        onSuccess: (result) => {
          toast.success(
            `${productName} ${result.quantityBefore}개 → ${result.quantityAfter}개로 조정했어요`,
          )
          onClose()
        },
        onError: (e) => toast.error(apiErrorMessage(e, '조정하지 못했어요.')),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-title"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg"
      >
        <div>
          <h2 id="adjust-title" className="text-lg font-bold text-slate-900">
            재고 조정
          </h2>
          <p className="text-sm text-slate-500">
            {productName} · 유통기한 {formatExpiry(lot.expiryDate)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">지금 실물</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{lot.quantity}개</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">예약</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{lot.reservedQuantity}개</dd>
          </div>
        </dl>

        <div className="space-y-1 text-sm">
          <label htmlFor={countId} className="block font-medium text-slate-700">
            실제 수량
          </label>
          <div className="flex items-center gap-3">
            <input
              id={countId}
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={lot.reservedQuantity}
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              aria-invalid={!check.ok || undefined}
              className={cn(
                'w-28 rounded-md border border-slate-200 px-2 py-1.5 text-right tabular-nums focus:border-emerald-600 focus:outline-none',
                !check.ok && 'border-red-600 focus:border-red-600',
              )}
            />
            {check.ok && (
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  check.delta > 0 ? 'text-emerald-700' : 'text-red-600',
                )}
              >
                {formatSignedQuantity(check.delta)}개
              </span>
            )}
          </div>
          {!check.ok && <p className="text-xs text-red-600">{check.message}</p>}
        </div>

        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium text-slate-700">사유</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((value) => (
              <label
                key={value}
                className={cn(
                  'cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50',
                  reason === value && 'border-emerald-600 bg-emerald-50 text-emerald-700',
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="sr-only"
                />
                {REASON_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1 text-sm">
          <label htmlFor={memoId} className="block font-medium text-slate-700">
            메모 (선택)
          </label>
          <input
            id={memoId}
            type="text"
            maxLength={200}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!check.ok || submitting}
            aria-busy={submitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600"
          >
            {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            조정
          </button>
        </div>
      </form>
    </div>
  )
}
