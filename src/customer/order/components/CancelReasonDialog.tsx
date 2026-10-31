import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { formatWon } from '../format'
import {
  CANCEL_DETAIL_MAX,
  CUSTOMER_CANCEL_REASONS,
  cancelBody,
  type CancelOrderRequest,
  type CancelReasonCode,
  type CancelRequester,
  OWNER_CANCEL_REASONS,
} from '../refund'

interface CancelReasonDialogProps {
  requester: CancelRequester
  orderNo: string
  /** 예: "매운 컵라면 115g 2개" */
  itemText: string
  refundAmount: number
  /** 다시 신청(환불 실패 뒤)이면 제목만 바뀐다. 이전 사유는 채우지 않고 새로 받는다(추가 명세 A9) */
  retry?: boolean
  pending: boolean
  /** 서버 오류 문구. 있으면 확인 단계에 보여 준다 */
  error: string | null
  onSubmit(body: CancelOrderRequest): void
  onClose(): void
}

/**
 * A8 결제 후 취소 사유·최종 확인 모달 (고객·점주 공통). 1단계에서 사유를 고르고(기타는 상세 필수),
 * 2단계에서 "주문 전체를 취소하고 전액 환불하시겠습니까?"를 묻는다(추가 명세 A8 고객·점주·공통).
 * 사유 목록은 요청자에 따라 다르다
 */
export function CancelReasonDialog({
  requester,
  orderNo,
  itemText,
  refundAmount,
  retry = false,
  pending,
  error,
  onSubmit,
  onClose,
}: CancelReasonDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'reason' | 'confirm'>('reason')
  const [reason, setReason] = useState<CancelReasonCode | null>(null)
  const [detail, setDetail] = useState('')
  const [touched, setTouched] = useState(false)
  const reasons = requester === 'CUSTOMER' ? CUSTOMER_CANCEL_REASONS : OWNER_CANCEL_REASONS
  const reasonLabel = reasons.find((r) => r.code === reason)?.label
  const detailMissing = reason === 'ETC' && detail.trim().length === 0

  // 네이티브 모달로 연다 (PickupConfirmModal 과 같은 방식)
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

  const next = () => {
    setTouched(true)
    if (reason === null || detailMissing) return
    setStep('confirm')
  }

  const title = retry ? (requester === 'OWNER' ? '환불 재시도' : '환불 다시 신청') : '주문 취소'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cancel-reason-title"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto max-h-screen w-full max-w-sm space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="cancel-reason-title" className="text-lg font-bold text-slate-900">
        {step === 'reason' ? title : '주문 전체를 취소하고 전액 환불하시겠습니까?'}
      </h2>
      <dl className="grid grid-cols-3 gap-y-1 text-sm">
        <dt className="text-slate-500">주문번호</dt>
        <dd className="col-span-2 font-medium text-slate-900">{orderNo}</dd>
        <dt className="text-slate-500">상품</dt>
        <dd className="col-span-2 text-slate-900">{itemText}</dd>
        <dt className="text-slate-500">환불금액</dt>
        <dd className="col-span-2 font-medium text-slate-900">{formatWon(refundAmount)}</dd>
        {step === 'confirm' && reasonLabel && (
          <>
            <dt className="text-slate-500">취소 사유</dt>
            <dd className="col-span-2 text-slate-900">
              {reason === 'ETC' ? `${reasonLabel}: ${detail.trim()}` : reasonLabel}
            </dd>
          </>
        )}
      </dl>

      {step === 'reason' ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">
            취소 사유를 골라 주세요
          </legend>
          {reasons.map((r) => (
            <label
              key={r.code}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                reason === r.code ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200',
              )}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r.code}
                checked={reason === r.code}
                onChange={() => setReason(r.code)}
                className="accent-emerald-600"
              />
              {r.label}
            </label>
          ))}
          {reason === 'ETC' && (
            <div className="space-y-1">
              <label htmlFor="cancel-detail" className="text-sm text-slate-700">
                기타 사유
              </label>
              <textarea
                id="cancel-detail"
                rows={3}
                maxLength={CANCEL_DETAIL_MAX}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                aria-invalid={touched && detailMissing}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400">{CANCEL_DETAIL_MAX}자까지</p>
            </div>
          )}
          {touched && reason === null && (
            <p role="alert" className="text-sm text-red-600">
              취소 사유를 골라 주세요
            </p>
          )}
          {touched && detailMissing && (
            <p role="alert" className="text-sm text-red-600">
              기타 사유를 입력해 주세요
            </p>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-slate-500">취소하면 되돌릴 수 없어요.</p>
      )}

      {step === 'confirm' && error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={step === 'reason' ? onClose : () => setStep('reason')}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {step === 'reason' ? '닫기' : '이전'}
        </button>
        {step === 'reason' ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={() => reason && onSubmit(cancelBody(reason, detail))}
            disabled={pending}
            aria-busy={pending}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            취소하고 환불
          </button>
        )}
      </div>
    </dialog>
  )
}
