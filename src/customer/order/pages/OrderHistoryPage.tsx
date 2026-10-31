import { ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { type DatePeriod, EMPTY_PERIOD, isReversedPeriod } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { PageNav } from '@/shared/ui/PageNav'
import { PeriodFilter } from '@/shared/ui/PeriodFilter'
import {
  type CustomerOrderSummary,
  type CustomerOrderTab,
  DEFAULT_ORDER_PAGE_SIZE,
  ORDER_PAGE_SIZES,
  type OrderPageSize,
  useCustomerOrders,
} from '../api'
import { formatDateTime, formatPickupDate, formatWon } from '../format'
import { orderStatusLabel } from '../orderStatus'
import { hasRefundStarted, refundStatusLabel } from '../refund'

const TABS: { tab: CustomerOrderTab; label: string }[] = [
  { tab: 'ALL', label: '전체' },
  { tab: 'PICKUP_WAITING', label: '픽업 대기' },
  { tab: 'PICKED_UP', label: '픽업 완료' },
  { tab: 'CANCELED', label: '취소·환불' },
]

const EMPTY_TEXT: Record<CustomerOrderTab, string> = {
  ALL: '아직 주문이 없어요.',
  PICKUP_WAITING: '픽업을 기다리는 주문이 없어요.',
  PICKED_UP: '픽업한 주문이 없어요.',
  CANCELED: '취소·환불된 주문이 없어요.',
}

/**
 * A3 /customer/orders 고객 주문 내역 (추가 명세 A3). 구분별로 주문일시 최신순, 한 페이지 기본 20개.
 * 기간(주문일 기준)은 구분과 같이 쓴다. 진입·구분·기간 변경·[새로 고침] 때만 조회한다.
 * 줄을 누르면 주문 상세(/customer/orders/:id)로 간다
 */
export function OrderHistoryPage() {
  const [tab, setTab] = useState<CustomerOrderTab>('ALL')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState<OrderPageSize>(DEFAULT_ORDER_PAGE_SIZE)
  const [period, setPeriod] = useState<DatePeriod>(EMPTY_PERIOD)
  const orders = useCustomerOrders({ tab, page, size, period })
  const reversed = isReversedPeriod(period)
  const filtered = period.from !== '' || period.to !== ''

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">주문 내역</h1>
        <button
          type="button"
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching || reversed}
          aria-label="새로 고침"
          className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={cn('size-4', orders.isFetching && 'animate-spin')} />
        </button>
      </div>

      <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            role="tab"
            aria-selected={tab === t.tab}
            onClick={() => {
              setTab(t.tab)
              setPage(0)
            }}
            className={cn(
              'flex-1 rounded-md py-2 text-slate-500',
              tab === t.tab && 'bg-white font-medium text-emerald-700 shadow-sm',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PeriodFilter
        period={period}
        onChange={(p) => {
          setPeriod(p)
          setPage(0)
        }}
      />

      {reversed ? null : orders.isPending ? (
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : orders.isError ? (
        <p className="py-16 text-center text-sm text-red-600">주문 내역을 불러오지 못했어요.</p>
      ) : orders.data.content.length === 0 && page === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          {filtered ? '고른 기간에 해당하는 주문이 없어요.' : EMPTY_TEXT[tab]}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {orders.data.content.map((o) => (
              <OrderRow key={o.orderId} order={o} />
            ))}
          </ul>
          <PageNav
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            size={size}
            sizes={ORDER_PAGE_SIZES}
            loading={orders.isPlaceholderData}
            onPageChange={setPage}
            onSizeChange={(s) => {
              setSize(s)
              setPage(0)
            }}
          />
        </>
      )}
    </section>
  )
}

function OrderRow({ order }: { order: CustomerOrderSummary }) {
  // 결제 완료·준비 완료라도 환불이 시작됐으면 픽업 대신 환불 상태를 보여 준다 (A8·A9)
  const refunding = hasRefundStarted(order.refundStatus)
  const done = order.status === 'PICKED_UP' || order.status === 'REFUNDED'
  const closed =
    order.status === 'EXPIRED' ||
    order.status === 'PICKUP_EXPIRED' ||
    order.status === 'CANCELED' ||
    order.refundStatus === 'FAILED'
  return (
    <li>
      <Link to={`/customer/orders/${order.orderId}`} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                done && 'bg-slate-100 text-slate-600',
                closed && 'bg-red-50 text-red-600',
                !done && !closed && 'bg-emerald-50 text-emerald-700',
              )}
            >
              {refunding
                ? refundStatusLabel(order.refundStatus)
                : orderStatusLabel(order.status, order.failureReason)}
            </span>
            <span className="truncate text-xs text-slate-400">{order.orderNo}</span>
          </div>
          <p className="truncate font-medium text-slate-900">
            {order.productName ?? '상품 확인 중'} · {order.quantity}개
          </p>
          <p className="truncate text-xs text-slate-500">
            {order.storeName} · {formatDateTime(order.createdAt)}
          </p>
          {(order.status === 'PAID' || order.status === 'READY_FOR_PICKUP') &&
            !refunding &&
            order.pickupDeadline && (
              <p className="text-xs text-emerald-700">
                {formatPickupDate(order.pickupDeadline)}까지 픽업
              </p>
            )}
        </div>
        <p className="shrink-0 text-right text-sm font-medium text-slate-900">
          {order.amount === null ? '-' : formatWon(order.amount)}
        </p>
        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  )
}
