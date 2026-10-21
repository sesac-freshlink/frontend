import axios from 'axios'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useOrder, type Order } from '../api'
import { OrderSummary, type SummaryRow } from '../components/OrderSummary'
import { formatDateTime, formatHHmm, formatWon } from '../format'
import { customerMessage, paymentInterruptedMessage } from '../orderStatus'
import { TossPaymentWidget } from '../TossPaymentWidget'
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
        <Payable order={data} interrupted={toss.interrupted} onInterrupted={toss.markInterrupted} />
      )
    case 'done':
      return <Paid order={data} />
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

function Payable({
  order,
  interrupted,
  onInterrupted,
}: {
  order: Order
  interrupted: boolean
  onInterrupted(): void
}) {
  const expiresAt = order.paymentExpiresAt ? formatHHmm(order.paymentExpiresAt) : undefined
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">결제 대기</h1>
      <OrderSummary rows={summaryRows(order)} />
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
      {order.amount !== null && order.productName !== null && (
        <TossPaymentWidget
          orderId={order.orderId}
          orderNo={order.orderNo}
          amount={order.amount}
          orderName={order.productName}
          onInterrupted={onInterrupted}
        />
      )}
    </section>
  )
}

function Paid({ order }: { order: Order }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <CircleCheck className="size-12 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900">결제 완료</h1>
        <p className="text-sm text-slate-500">
          주문번호 <span className="font-medium text-slate-900">{order.orderNo}</span>
        </p>
      </div>
      <OrderSummary
        rows={[
          ...summaryRows(order),
          { label: '결제 시각', value: order.paidAt ? formatDateTime(order.paidAt) : '-' },
        ]}
      />
      <p className="text-center text-sm text-slate-500">매장에서 주문번호를 보여 주고 픽업하세요</p>
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
  return (
    <section className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-6">
        <CircleX className="size-12 text-red-600" />
        <h1 className="text-center text-lg font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">주문번호 {order.orderNo}</p>
      </div>
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
