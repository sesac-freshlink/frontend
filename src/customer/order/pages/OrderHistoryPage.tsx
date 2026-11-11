import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { type DatePeriod, EMPTY_PERIOD, isReversedPeriod } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { PeriodFilter } from '@/shared/ui/PeriodFilter'
import {
  type CustomerOrderSummary,
  type CustomerOrderTab,
  DEFAULT_ORDER_PAGE_SIZE,
  limitCodePoints,
  ORDER_KEYWORD_MAX,
  useCustomerOrderPages,
  useCustomerOrders,
} from '../api'
import { quantityText } from '../clearance'
import { formatDateTime, formatPickupDate, formatWon } from '../format'
import { orderStatusLabel } from '../orderStatus'
import { canRequestPickup } from '../pickupRequest'
import { PickupRequestButton } from '../components/PickupRequestButton'
import { hasRefundStarted, refundStatusLabel } from '../refund'
import { PullIndicator } from '@/customer/stores/components/PullIndicator'
import { useLoadMoreOnScroll } from '@/customer/stores/useLoadMoreOnScroll'
import { usePullToRefresh } from '@/customer/stores/usePullToRefresh'

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
 * A3 /customer/orders 고객 주문 내역 (추가 명세 A3). 구분별로 주문일시 최신순, 20개씩 이어 붙인다(무한 스크롤).
 * 기간(주문일 기준)은 구분과 같이 쓴다. 진입·구분·기간 변경·[새로 고침]·당겨서 새로고침 때만 조회한다.
 * 줄을 누르면 주문 상세(/customer/orders/:id)로 간다
 */
export function OrderHistoryPage() {
  const [tab, setTab] = useState<CustomerOrderTab>('ALL')
  const [period, setPeriod] = useState<DatePeriod>(EMPTY_PERIOD)
  // 상품명 검색: 치는 동안(draft)은 묻지 않고 [검색]·Enter 때만 keyword 로 서버에 묻는다
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  // [픽업 신청] 기한 판단용 화면 진입 시각. 기한은 서버가 신청 때 다시 확인한다
  const [nowMs] = useState(() => Date.now())
  const reversed = isReversedPeriod(period)
  // 핸드폰이라 페이지 번호 대신 20개씩 이어 붙인다(무한 스크롤, 11/11 경우 결정, 추가 명세 A3 변경)
  const orders = useCustomerOrderPages({
    tab,
    size: DEFAULT_ORDER_PAGE_SIZE,
    period,
    keyword,
  })
  // [픽업 QR]은 준비 완료된 주문이 있을 때만 (추가 명세 A16, 픽업 신청 11/10). 픽업 대기는 50건이면 충분하다
  const waiting = useCustomerOrders({
    tab: 'PICKUP_WAITING',
    page: 0,
    size: 50,
    period: EMPTY_PERIOD,
  })
  // 화면 맨 위에서 당겼다 놓으면 처음 묶음부터 다시 읽는다(태우님 usePullToRefresh 그대로 쓴다)
  const refresh = () => {
    if (reversed) return
    void orders.refetch()
    void waiting.refetch()
  }
  const { ref: pullRef, pull, ready } = usePullToRefresh<HTMLElement>(() => refresh())
  const hasWaiting = waiting.data?.content.some((o) => o.status === 'READY_FOR_PICKUP') ?? false
  const filtered = period.from !== '' || period.to !== ''

  return (
    <section ref={pullRef} className="space-y-4">
      <PullIndicator pull={pull} ready={ready} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">주문 내역</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={orders.isFetching || reversed}
          aria-label="새로 고침"
          className="flex size-11 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={cn('size-4', orders.isFetching && 'animate-spin')} />
        </button>
      </div>
      {hasWaiting && (
        <Link
          to="/customer/orders/pickup-qr"
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-3 font-medium text-white"
        >
          <QrCode className="size-5" />
          픽업 QR 보여 주기
        </Link>
      )}

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setKeyword(draft.trim())
        }}
      >
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white pr-1 pl-3 focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700">
          <Search className="size-4 shrink-0 text-slate-600" aria-hidden />
          <input
            aria-label="주문한 상품 검색"
            value={draft}
            onChange={(e) => setDraft(limitCodePoints(e.target.value, ORDER_KEYWORD_MAX))}
            placeholder="주문한 상품 이름으로 찾기"
            enterKeyHint="search"
            className="min-h-11 w-full min-w-0 text-base text-slate-900 outline-none placeholder:text-slate-500"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setDraft('')
                setKeyword('')
              }}
              aria-label="검색어 지우기"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800"
          >
            검색
          </button>
        </label>
      </form>

      <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            role="tab"
            aria-selected={tab === t.tab}
            onClick={() => setTab(t.tab)}
            className={cn(
              'min-h-11 flex-1 rounded-md text-slate-600',
              tab === t.tab && 'bg-white font-medium text-emerald-700 shadow-sm',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 기간 칸은 늘 펼쳐 두면 무엇인지 안 보이고 목록을 밀어 내서 [기간으로 찾기]로 접어 둔다. 기간을 고른 동안은 펼쳐 둔다 */}
      <details open={filtered || undefined} className="group text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-slate-700">
          <CalendarDays className="size-4" aria-hidden />
          기간으로 찾기
          {filtered && <span className="text-emerald-700">(적용 중)</span>}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-1 pt-1">
          <p className="text-xs text-slate-600">주문한 날 기준, 시작일 ~ 끝일</p>
          <PeriodFilter period={period} onChange={setPeriod} />
        </div>
      </details>

      {reversed ? null : orders.isPending ? (
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : orders.isError ? (
        <p className="py-16 text-center text-sm text-red-600">주문 내역을 불러오지 못했어요.</p>
      ) : orders.data.pages.every((p) => p.content.length === 0) ? (
        <p className="py-16 text-center text-sm text-slate-500">
          {keyword
            ? `‘${keyword}’이(가) 들어간 주문이 없어요.`
            : filtered
              ? '고른 기간에 해당하는 주문이 없어요.'
              : EMPTY_TEXT[tab]}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {orders.data.pages
              .flatMap((p) => p.content)
              .map((o) => (
                <OrderRow key={o.orderId} order={o} nowMs={nowMs} />
              ))}
          </ul>
          <LoadMoreOrders orders={orders} />
        </>
      )}
    </section>
  )
}

/**
 * 목록 끝이 보이면 다음 20개를 불러온다(태우님 useLoadMoreOnScroll 그대로 쓴다).
 * 끝을 지켜보지 못하는 브라우저·키보드 사용자를 위해 [더 보기] 버튼도 같이 둔다
 */
function LoadMoreOrders({ orders }: { orders: ReturnType<typeof useCustomerOrderPages> }) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = orders
  const ref = useLoadMoreOnScroll<HTMLDivElement>(() => {
    if (!isFetchingNextPage) void fetchNextPage()
  }, hasNextPage)
  if (!hasNextPage) return null
  return (
    <div ref={ref} className="flex justify-center py-2">
      <button
        type="button"
        onClick={() => void fetchNextPage()}
        disabled={isFetchingNextPage}
        aria-busy={isFetchingNextPage}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        {isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {isFetchingNextPage ? '불러오는 중' : '더 보기'}
      </button>
    </div>
  )
}

function OrderRow({ order, nowMs }: { order: CustomerOrderSummary; nowMs: number }) {
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
                closed && 'bg-red-50 text-red-700',
                !done && !closed && 'bg-emerald-50 text-emerald-700',
              )}
            >
              {refunding
                ? refundStatusLabel(order.refundStatus)
                : orderStatusLabel(order.status, order.failureReason)}
            </span>
            <span className="truncate text-xs text-slate-500">{order.orderNo}</span>
          </div>
          <p className="truncate font-medium text-slate-900">
            {order.productName ?? '상품 확인 중'} · {quantityText(order)}
          </p>
          <p className="truncate text-xs text-slate-500">
            {order.storeName} · {formatDateTime(order.createdAt)}
          </p>
          {(order.status === 'PAID' ||
            order.status === 'PICKUP_REQUESTED' ||
            order.status === 'READY_FOR_PICKUP') &&
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
      {/* 줄 전체가 링크라 버튼은 링크 밖에 둔다. 서버도 신청 때 기한·상태를 다시 확인한다 */}
      {canRequestPickup(order, nowMs) && (
        <div className="flex justify-end px-4 pb-3">
          <PickupRequestButton orderId={order.orderId} orderNo={order.orderNo} size="compact" />
        </div>
      )}
    </li>
  )
}
