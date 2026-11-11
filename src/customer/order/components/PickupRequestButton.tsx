import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import {
  PICKUP_REQUEST_CONFIRM,
  pickupRequestErrorMessage,
  usePickupRequest,
} from '../pickupRequest'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * [픽업 신청]: 한 번 더 묻고 신청한다. 신청하면 점주에게 새 픽업 주문 알림이 가고, 점주가 준비 완료를 누를 수 있다.
 * full: 주문 상세의 넓은 버튼, compact: 주문 내역 줄의 작은 버튼
 */
export function PickupRequestButton({
  orderId,
  orderNo,
  size = 'full',
}: {
  orderId: number
  orderNo: string
  size?: 'full' | 'compact'
}) {
  const request = usePickupRequest(orderId)
  const [open, setOpen] = useState(false)
  const onConfirm = async () => {
    try {
      await request.mutateAsync()
      toast.success('픽업 신청을 했어요. 준비되면 알려 드려요')
    } catch (e) {
      toast.error(pickupRequestErrorMessage(e))
    }
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={size === 'compact' ? `${orderNo} 픽업 신청` : undefined}
        className={cn(
          'rounded-lg bg-emerald-700 font-medium text-white hover:bg-emerald-800',
          size === 'full' ? 'block w-full py-3 text-center' : 'min-h-11 px-3 text-sm',
        )}
      >
        픽업 신청
      </button>
      {open && (
        <ConfirmDialog
          title="픽업 신청할까요?"
          description={PICKUP_REQUEST_CONFIRM}
          confirmLabel="픽업 신청"
          tone="primary"
          pending={request.isPending}
          onConfirm={() => void onConfirm()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
