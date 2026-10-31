import axios from 'axios'
import { CircleCheck, CircleX, LoaderCircle, PackageCheck, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import { useOrder, type Order } from '../api'
import { CancelReasonDialog } from '../components/CancelReasonDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { OrderSummary, type SummaryRow } from '../components/OrderSummary'
import { ReceiptLink } from '../components/ReceiptLink'
import { formatRemaining } from '../countdown'
import { formatDateTime, formatHHmm, formatPickupDate, formatWon } from '../format'
import { customerMessage, paymentInterruptedMessage } from '../orderStatus'
import {
  cancelErrorMessage,
  isRefundInProgress,
  refundStatusLabel,
  useCancelBeforePayment,
  useCancelOrder,
} from '../refund'
import { TossPaymentWidget } from '../TossPaymentWidget'
import { useCountdown } from '../useCountdown'
import { useTossReturn } from '../useTossReturn'
import { OrderCheckoutView } from './OrderCheckoutView'

/**
 * U-21·U-22·U-31 /customer/orders/:id
 * - :id 가 new 면 주문·결제 화면 (주문 만들기 전)
 * - 숫자면 주문 상태를 2초마다 읽어(POLL_MS.orderDetail) 상태별 화면을 보여 준다
 */
export function OrderDetailPage() {
  const { id } = useParams()
  if (id === 'new') return <OrderCheckoutView />

  const orderId = id !== undefined && /^\d+$/.test(id) ? Number(id) : undefined
  if (orderId === undefined) return <NotFound />
  return <OrderView key={orderId} orderId={orderId} />
}

function OrderView({ orderId }: { orderId: number }) {
  const order = useOrder(orderId)
  const toss = useTossReturn(orderId)

  if (order.isPending) return <Waiting title="주문을 불러오고 있어요" />
  if (order.isError) {
    const status = axios.isAxiosError(order.error) ? order.error.response?.status : undefined
    if (status === 403 || status === 404) return <NotFound />
    return (
      <section className="space-y-3 py-10 text-center">
        <p className="text-sm text-red-600">주문을 불러오지 못했어요.</p>
        <button
          type="button"
          onClick={() => void order.refetch()}
          className="text-sm text-slate-500 underline"
        >
          다시 시도
        </button>
      </section>
    )
  }

  const data = order.data
  // 토스에서 돌아와 승인 요청 중이면 서버 상태가 바뀌기 전이라도 결과 확인 중으로 보여 준다
  if (toss.confirming) return <Waiting title="결제 결과를 확인하고 있어요" />

  const message = customerMessage(data.status, data.failureReason)
  switch (message.tone) {
    case 'loading':
      return <Waiting title={message.title} />
    case 'payable':
      return (
        <Payable
          order={data}
          receivedAtMs={order.dataUpdatedAt}
          interrupted={toss.interrupted}
          onInterrupted={toss.markInterrupted}
        />
      )
    case 'done':
      return <Paid order={data} />
    case 'pickedUp':
      return <PickedUp order={data} />
    case 'refunded':
      return <Refunded order={data} />
    case 'failed':
      return <Failed order={data} title={message.title} />
  }
}

function Waiting({ title }: { title: string }) {
  return (
    <section className="flex flex-col items-center gap-3 py-16">
      <LoaderCircle className="size-8 animate-spin text-emerald-600" />
      <p className="font-medium text-slate-900">{title}</p>
    </section>
  )
}

function summaryRows(order: Order): SummaryRow[] {
  return [
    { label: '점포', value: order.storeName },
    { label: '상품', value: order.productName ?? '-' },
    { label: '수량', value: `${order.quantity}개` },
    { label: '결제 금액', value: order.amount === null ? '-' : formatWon(order.amount) },
  ]
}

/** 픽업 기한 한 줄 (A4). 재고 확보 전이거나 서버가 아직 안 주면 없다 */
function pickupRows(order: Order): SummaryRow[] {
  return order.pickupDeadline
    ? [{ label: '픽업 기한', value: `${formatPickupDate(order.pickupDeadline)}까지` }]
    : []
}

/** 결제 전·완료 화면의 픽업 기한 안내 (추가 명세 A4) */
function PickupNotice({ order }: { order: Order }) {
  if (!order.pickupDeadline) return null
  return <p className="text-sm text-slate-500">픽업 기한이 지나면 취소·환불할 수 없어요</p>
}

/** 결제 완료 화면의 결제 내역. 승인 시각이 없으면 결제 완료 시각(paidAt)을 쓴다 */
function paymentRows(order: Order): SummaryRow[] {
  const approvedAt = order.payment?.approvedAt ?? order.paidAt
  const rows: SummaryRow[] = []
  if (order.payment?.method) rows.push({ label: '결제 수단', value: order.payment.method })
  rows.push({ label: '결제 시각', value: approvedAt ? formatDateTime(approvedAt) : '-' })
  return rows
}

function Payable({
  order,
  receivedAtMs,
  interrupted,
  onInterrupted,
}: {
  order: Order
  /** 이 주문 응답을 받은 기기 시각. serverTime 과의 차이로 기기 시계를 보정한다 */
  receivedAtMs: number
  interrupted: boolean
  onInterrupted(): void
}) {
  const expiresAt = order.paymentExpiresAt ? formatHHmm(order.paymentExpiresAt) : undefined
  // 서버 시각 기준 남은 초. 0이 돼도 상태는 바꾸지 않고, 다음 폴링에서 서버가 준 상태를 따른다
  const remaining = useCountdown(order.paymentExpiresAt, order.serverTime, receivedAtMs)
  const timeUp = remaining === 0
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">결제 대기</h1>
      <OrderSummary rows={[...summaryRows(order), ...pickupRows(order)]} />
      <PickupNotice order={order} />
      {remaining !== null && (
        <p
          role="timer"
          className={cn(
            'rounded-lg p-3 text-center text-lg font-bold',
            timeUp ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700',
          )}
        >
          {timeUp ? '결제 시간이 끝났어요' : formatRemaining(remaining)}
        </p>
      )}
      {interrupted && expiresAt ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {paymentInterruptedMessage(expiresAt)}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          10분 안에 결제하지 않으면 주문이 취소돼요{expiresAt && ` (${expiresAt}까지)`}
        </p>
      )}
      {/* 금액·상품명은 PAYMENT_WAITING 이면 서버가 채워 준다 */}
      {!timeUp && order.amount !== null && order.productName !== null && (
        <TossPaymentWidget
          orderId={order.orderId}
          orderNo={order.orderNo}
          amount={order.amount}
          orderName={order.productName}
          onInterrupted={onInterrupted}
        />
      )}
      {!timeUp && <CancelBeforePayment orderId={order.orderId} />}
    </section>
  )
}

/** A7 결제 전 취소: "주문을 취소하시겠습니까?"만 묻고 사유는 받지 않는다. 환불금액은 0원이다 */
function CancelBeforePayment({ orderId }: { orderId: number }) {
  const cancel = useCancelBeforePayment(orderId)
  const [open, setOpen] = useState(false)
  const onConfirm = async () => {
    try {
      await cancel.mutateAsync()
      toast.success('주문을 취소했어요')
    } catch (e) {
      toast.error(cancelErrorMessage(e))
    }
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-lg border border-slate-300 py-3 text-center text-sm font-medium text-slate-600"
      >
        주문 취소
      </button>
      {open && (
        <ConfirmDialog
          title="주문을 취소하시겠습니까?"
          confirmLabel="주문 취소"
          pending={cancel.isPending}
          onConfirm={() => void onConfirm()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** 픽업 기한이 지났는지 (서버 시각 기준). 서버도 요청 때 다시 확인한다 */
function deadlinePassed(order: Order): boolean {
  return (
    order.pickupDeadline !== null && Date.parse(order.serverTime) > Date.parse(order.pickupDeadline)
  )
}

/** 취소·환불 표시 (추가 명세 A8): 요청자·사유·환불금액·처리 상태·취소 요청 시각·취소 완료 시각 */
function refundRows(order: Order): SummaryRow[] {
  const r = order.refund
  if (!r) return []
  const rows: SummaryRow[] = [
    { label: '요청자', value: r.requestedBy === 'CUSTOMER' ? '고객' : '점주' },
    {
      label: '취소 사유',
      value: r.reasonDetail ? `${r.reasonLabel}: ${r.reasonDetail}` : r.reasonLabel,
    },
    { label: '환불금액', value: formatWon(r.refundAmount) },
    { label: '처리 상태', value: refundStatusLabel(order.refundStatus) },
    { label: '취소 요청 시각', value: formatDateTime(r.requestedAt) },
  ]
  if (r.canceledAt) rows.push({ label: '취소 완료 시각', value: formatDateTime(r.canceledAt) })
  return rows
}

/**
 * A8 결제 후 취소·A9 환불 상태. 결제 완료·준비 완료 화면 아래에 둔다.
 * 환불 없음·기한 이내면 [주문 취소], 처리·확인 중이면 안내(2초마다 다시 읽음), 실패면 [환불 다시 신청](사유를 새로 받는다)
 */
function RefundSection({ order }: { order: Order }) {
  const cancel = useCancelOrder(order.orderId)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = order.refundStatus
  const canStart = status === 'FAILED' || (status === 'NONE' && !deadlinePassed(order))
  const retry = status === 'FAILED'

  const onSubmit = async (body: Parameters<typeof cancel.mutateAsync>[0]) => {
    setError(null)
    try {
      const res = await cancel.mutateAsync(body)
      setOpen(false)
      if (res.refundStatus === 'COMPLETED') toast.success('취소·환불이 끝났어요')
      else if (res.refundStatus === 'FAILED')
        toast.error('환불에 실패했어요. 다시 신청할 수 있어요')
      else toast('환불 결과를 확인하고 있어요')
    } catch (e) {
      setError(cancelErrorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      {order.refund && <OrderSummary rows={refundRows(order)} />}
      {isRefundInProgress(status) && (
        <p className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          환불 결과를 확인하고 있어요
        </p>
      )}
      {retry && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          환불에 실패했어요. 다시 신청해 주세요.
        </p>
      )}
      {canStart && order.amount !== null && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium',
            retry ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-600',
          )}
        >
          {retry && <RotateCcw className="size-4" aria-hidden="true" />}
          {retry ? '환불 다시 신청' : '주문 취소'}
        </button>
      )}
      {open && order.amount !== null && (
        <CancelReasonDialog
          requester="CUSTOMER"
          orderNo={order.orderNo}
          itemText={`${order.productName ?? ''} ${order.quantity}개`}
          refundAmount={order.amount}
          retry={retry}
          pending={cancel.isPending}
          error={error}
          onSubmit={(body) => void onSubmit(body)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/** A9 취소·환불 완료 화면: 주문번호·상품명·수량·환불금액·취소 완료 시각, [주문 내역으로] (추가 명세 A8) */
function Refunded({ order }: { order: Order }) {
  const r = order.refund
  const rows: SummaryRow[] = [
    { label: '주문번호', value: order.orderNo },
    { label: '상품', value: order.productName ?? '-' },
    { label: '수량', value: `${order.quantity}개` },
    { label: '환불금액', value: formatWon(r?.refundAmount ?? order.amount ?? 0) },
  ]
  if (r?.canceledAt) rows.push({ label: '취소 완료 시각', value: formatDateTime(r.canceledAt) })
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <CircleCheck className="size-12 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900">취소·환불이 끝났어요</h1>
        <p className="text-sm text-slate-500">결제한 금액 전액을 환불했어요</p>
      </div>
      <OrderSummary rows={rows} />
      <Link
        to="/customer/orders"
        className="block rounded-lg bg-emerald-600 py-3 text-center font-medium text-white"
      >
        주문 내역으로
      </Link>
    </section>
  )
}

function Paid({ order }: { order: Order }) {
  const ready = order.status === 'READY_FOR_PICKUP'
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <CircleCheck className="size-12 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900">
          {ready ? '픽업 준비 완료' : '결제 완료'}
        </h1>
        <p className="text-sm text-slate-500">
          주문번호 <span className="font-medium text-slate-900">{order.orderNo}</span>
        </p>
      </div>
      <OrderSummary rows={[...summaryRows(order), ...paymentRows(order), ...pickupRows(order)]} />
      <ReceiptLink url={order.payment?.receiptUrl ?? null} className="flex justify-center" />
      <div className="space-y-1 text-center">
        {/* 기한 날짜는 위 표의 "픽업 기한" 줄에 있다. 문장에 다시 넣으면 폰 폭에서 "까/지"로 끊긴다 */}
        <p className="text-sm text-slate-500">
          {ready
            ? '준비가 끝났어요. 매장에서 주문번호를 보여 주고 받아 가세요'
            : '매장에서 주문번호를 보여 주고 픽업하세요'}
        </p>
        <PickupNotice order={order} />
      </div>
      <RefundSection order={order} />
      <Link
        to="/customer"
        className="block rounded-lg border border-slate-300 py-3 text-center text-sm font-medium text-slate-600"
      >
        홈으로
      </Link>
    </section>
  )
}

/** A5 점주가 픽업 확인한 주문 */
function PickedUp({ order }: { order: Order }) {
  const rows = summaryRows(order)
  if (order.pickedUpAt) rows.push({ label: '픽업 시각', value: formatDateTime(order.pickedUpAt) })
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <PackageCheck className="size-12 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900">픽업 완료</h1>
        <p className="text-sm text-slate-500">
          주문번호 <span className="font-medium text-slate-900">{order.orderNo}</span>
        </p>
      </div>
      <OrderSummary rows={rows} />
      <Link
        to="/customer"
        className="block rounded-lg border border-slate-300 py-3 text-center text-sm font-medium text-slate-600"
      >
        홈으로
      </Link>
    </section>
  )
}

function Failed({ order, title }: { order: Order; title: string }) {
  // 결제 뒤 픽업 기한이 지난 주문은 결제 금액을 그대로 두고 환불은 0원 (추가 명세 A4)
  // 결제 전 직접 취소(A7)도 환불금액 0원으로 보여 준다 (추가 명세 A8 환불금액 표)
  const pickupExpired = order.status === 'PICKUP_EXPIRED'
  const canceled = order.status === 'CANCELED'
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <CircleX className="size-12 text-red-600" />
        <h1 className="text-center text-lg font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">주문번호 {order.orderNo}</p>
      </div>
      {(pickupExpired || canceled) && (
        <OrderSummary
          rows={[
            ...summaryRows(order),
            ...(pickupExpired ? pickupRows(order) : []),
            { label: '환불금액', value: formatWon(0) },
          ]}
        />
      )}
      {/* 같은 주문을 다시 결제하지 않고 새 주문으로 시작한다 */}
      <Link
        to={`/customer/stores/${order.storeId}`}
        state={{ storeName: order.storeName }}
        className="block rounded-lg bg-emerald-600 py-3 text-center font-medium text-white"
      >
        상품으로 돌아가기
      </Link>
    </section>
  )
}

function NotFound() {
  return (
    <section className="space-y-3 py-10 text-center">
      <p className="text-sm text-slate-500">주문을 찾을 수 없어요.</p>
      <Link to="/customer" className="text-sm text-emerald-600 underline">
        홈으로
      </Link>
    </section>
  )
}
