import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/ui/cn'
import type { Order } from '../api'
import { formatRemaining } from '../countdown'
import { formatWon } from '../format'
import { useCountdown } from '../useCountdown'

export interface PendingOrderDialogProps {
  order: Order
  /** 이 주문 상세를 받은 기기 시각. 남은 시간을 서버 시각 기준으로 센다 */
  receivedAtMs: number
  /** 선착순 상품이면 [새로 주문하기]를 뺀다(취소해도 입장권이 돌아오지 않아 새 주문이 실패한다) */
  allowNewOrder: boolean
  /** [새로 주문하기]를 처리하는 중 (앞 주문 취소 → 새 주문) */
  pending: boolean
  onContinue(): void
  onNewOrder(): void
  onClose(): void
}

/**
 * 같은 점포·같은 상품을 다시 [구매하기] 했는데 결제하지 않은 주문이 있을 때 묻는 창 (11/12 경우 결정).
 * [이어서 결제하기] 그 주문 결제 화면 / [새로 주문하기] 앞 주문을 결제 전 취소한 뒤 새 주문 / [닫기].
 * 처리 중에는 닫히지 않는다. Esc 는 [닫기]와 같다
 */
export function PendingOrderDialog({
  order,
  receivedAtMs,
  allowNewOrder,
  pending,
  onContinue,
  onNewOrder,
  onClose,
}: PendingOrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const remaining = useCountdown(order.paymentExpiresAt, order.serverTime, receivedAtMs)
  const timeUp = remaining === 0

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // 닫히면 연 버튼([구매하기])으로 포커스를 돌려준다. 화면을 옮겨 버튼이 없어졌으면 그대로 둔다
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      if (opener?.isConnected) opener.focus()
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

  const buttonClass =
    'flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium disabled:opacity-50'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pending-order-title"
      aria-describedby="pending-order-detail"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="pending-order-title" className="text-lg font-bold text-slate-900">
        결제하지 않은 주문이 있어요
      </h2>
      <div id="pending-order-detail" className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium text-slate-900">
          {order.productName ?? '상품'} {order.quantity}개
        </p>
        {order.amount !== null && <p className="text-slate-600">{formatWon(order.amount)}</p>}
        {remaining !== null && (
          <p className={cn('font-medium', timeUp ? 'text-rose-700' : 'text-emerald-700')}>
            {timeUp ? '결제 시간이 끝났어요' : `자동 취소까지 ${formatRemaining(remaining)}`}
          </p>
        )}
      </div>
      <div className="space-y-2">
        {!timeUp && (
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className={cn(buttonClass, 'bg-emerald-700 text-white')}
          >
            이어서 결제하기
          </button>
        )}
        {allowNewOrder && (
          <button
            type="button"
            onClick={onNewOrder}
            disabled={pending}
            aria-busy={pending}
            className={cn(buttonClass, 'border border-slate-300 bg-white text-slate-800')}
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            새로 주문하기
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={cn(buttonClass, 'text-slate-600')}
        >
          닫기
        </button>
      </div>
    </dialog>
  )
}
