import { Download, LoaderCircle, RefreshCw } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_ORDER_PAGE_SIZE, ORDER_PAGE_SIZES, type OrderPageSize } from '@/customer/order/api'
import { CancelReasonDialog } from '@/customer/order/components/CancelReasonDialog'
import { quantityText } from '@/customer/order/clearance'
import { formatDateTime, formatShortPickupDate, formatWon } from '@/customer/order/format'
import { orderStatusLabel } from '@/customer/order/orderStatus'
import {
  type CancelOrderRequest,
  cancelErrorMessage,
  hasRefundStarted,
  refundStatusLabel,
} from '@/customer/order/refund'
import { type DatePeriod, EMPTY_PERIOD, isReversedPeriod } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { PageNav } from '@/shared/ui/PageNav'
import { PeriodFilter } from '@/shared/ui/PeriodFilter'
import {
  type OwnerOrder,
  type OwnerOrderTab,
  readyErrorMessage,
  useMarkReadyForPickup,
  useOwnerCancelOrder,
  useOwnerOrders,
} from '../api'
import { PickupConfirmModal } from '../components/PickupConfirmModal'
import { PickupCodeEntry } from '../pickup/components/PickupCodeEntry'
import { downloadCsv, ordersToCsv } from '../ordersCsv'

interface TabInfo {
  tab: OwnerOrderTab
  label: string
  description: string
  empty: string
}

/**
 * A6 구분. 11/15 경우: 픽업 대기에 섞여 있던 고객 신청 전·픽업 신청·준비 완료를 나눠
 * 전체 / 픽업 대기(픽업 신청) / 준비 완료 / 픽업 완료 / 취소·환불 / 기한 경과 순으로 둔다.
 * 고객 신청 전(결제만 한 주문)은 점주가 할 일이 없어 전체에만 나온다
 */
const TABS: TabInfo[] = [
  {
    tab: 'ALL',
    label: '전체',
    description: '결제가 끝난 주문을 모두 보여 줘요. 결제 시각 최신순이에요.',
    empty: '결제한 주문이 없어요.',
  },
  {
    tab: 'PICKUP_REQUESTED',
    label: '픽업 대기',
    description:
      '고객이 픽업을 신청한 주문이에요. 상품을 챙긴 뒤 [준비 완료]를 눌러 주세요. 결제 시각 최신순이에요.',
    empty: '픽업을 신청한 주문이 없어요.',
  },
  {
    tab: 'READY_FOR_PICKUP',
    label: '준비 완료',
    description:
      '준비를 마치고 고객을 기다리는 주문이에요. 고객이 오면 [픽업 확인]을 눌러 주세요. 결제 시각 최신순이에요.',
    empty: '준비 완료한 주문이 없어요.',
  },
  {
    tab: 'PICKED_UP',
    label: '픽업 완료',
    description: '픽업을 마친 주문이에요. 픽업 시각 최신순이에요.',
    empty: '픽업 완료한 주문이 없어요.',
  },
  {
    tab: 'CANCELED',
    label: '취소·환불',
    description:
      '취소·환불 요청이 들어온 주문이에요. 취소 요청 최신순이에요. 환불에 실패하면 [환불 재시도]를 눌러 주세요.',
    empty: '취소·환불된 주문이 없어요.',
  },
  {
    tab: 'PICKUP_EXPIRED',
    label: '기한 경과',
    description: '픽업하지 않고 픽업 기한이 지난 주문이에요. 픽업 기한 최신순이에요.',
    empty: '픽업 기한이 지난 주문이 없어요.',
  },
]

/**
 * S-50·A6 /owner/orders 점주 주문 목록. 구분(전체·픽업 대기·준비 완료·픽업 완료·취소·환불·기한 경과)과 기간(주문일 기준)으로 고른다.
 * 픽업 대기(고객이 픽업 신청한 주문)는 N-02 [준비 완료](포장을 끝내면, 고객에게 알림)를 누르면 준비 완료로 옮겨 가고,
 * 준비 완료 주문은 A5 [픽업 확인] → 확인 모달 → 픽업 완료 구분으로 옮겨 간다.
 * 상품별 판매 순위 탭은 11/14 매출 메뉴로 옮겼다(경우 결정)
 */
export function OwnerOrdersPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">결제·픽업</h1>
      <OwnerOrderList />
    </section>
  )
}

function OwnerOrderList() {
  // 처음에는 점주가 바로 할 일(픽업 신청 들어온 주문)을 연다
  const [tab, setTab] = useState<OwnerOrderTab>('PICKUP_REQUESTED')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState<OrderPageSize>(DEFAULT_ORDER_PAGE_SIZE)
  const [period, setPeriod] = useState<DatePeriod>(EMPTY_PERIOD)
  const orders = useOwnerOrders({ tab, page, size, period })
  const reversed = isReversedPeriod(period)
  const info = TABS.find((t) => t.tab === tab) ?? TABS[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          {/* 바로 위 탭 이름과 같아 화면에는 숨긴다 */}
          <h2 className="sr-only">주문 목록</h2>
          <p className="text-sm text-slate-500">{info.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PickupCodeEntry />
          <button
            type="button"
            onClick={() => void orders.refetch()}
            disabled={orders.isFetching || reversed}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={cn('size-4', orders.isFetching && 'animate-spin')} />
            새로 고침
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv(`주문목록-${info.label}.csv`, ordersToCsv(orders.data?.content ?? []))
            }
            disabled={(orders.data?.content.length ?? 0) === 0}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden />
            목록 내려받기
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
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
                'rounded-md px-4 py-2 text-slate-600',
                tab === t.tab && 'bg-white font-medium text-emerald-700 shadow-sm',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <PeriodFilter
          period={period}
          hint="주문일 기준"
          onChange={(p) => {
            setPeriod(p)
            setPage(0)
          }}
        />
      </div>

      {reversed ? null : orders.isPending ? (
        <div className="flex justify-center py-16 text-slate-500">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : orders.isError ? (
        <p className="py-16 text-center text-sm text-red-600">
          주문을 불러오지 못했어요. [새로 고침]을 눌러 다시 불러와 주세요.
        </p>
      ) : orders.data.content.length === 0 && page === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          {period.from || period.to ? '고른 기간에 해당하는 주문이 없어요.' : info.empty}
        </p>
      ) : (
        <>
          {/* 구분을 바꾸면 열려 있던 확인 모달 상태도 버린다 */}
          <OrderTable key={tab} tab={tab} orders={orders.data.content} />
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
    </div>
  )
}

interface Column {
  label: string
  /** 화면에는 안 보이고 읽어 주기만 하는 머리글 */
  srOnly?: boolean
  right?: boolean
  /**
   * 칸 너비(table-fixed). 앞 다섯 칸(주문번호~결제)은 모든 구분에서 같은 너비라 구분을 바꿔도 자리가 같다.
   * 비우면 남는 자리를 가진다(구분마다 뒤쪽 칸 하나: 픽업 기한·픽업 시각·취소 사유)
   */
  width?: string
  className?: string
  cell(o: OwnerOrder): ReactNode
}

/** 모든 구분이 같이 쓰는 칸 */
const BASE_COLUMNS: Column[] = [
  { label: '주문번호', width: 'w-44', className: 'font-medium', cell: (o) => o.orderNo },
  {
    label: '상품',
    width: 'w-56',
    // 상품명이 길면 줄을 바꾼다
    className: 'min-w-24 break-keep whitespace-normal',
    cell: (o) => o.productName,
  },
  { label: '수량', width: 'w-16', right: true, cell: (o) => quantityText(o) },
  { label: '금액', width: 'w-24', right: true, cell: (o) => formatWon(o.amount) },
  {
    // 결제 수단과 결제 시각을 한 칸에 두 줄로 둔다. 픽업 대기 표(칸 9개)가 1024px 포스기 화면 안에 들어오게 하려는 것이다
    label: '결제',
    width: 'w-32',
    cell: (o) => (
      <div className="leading-tight">
        <p>{o.payment?.method ?? '-'}</p>
        <p className="text-xs text-slate-500">
          {formatDateTime(o.payment?.approvedAt ?? o.paidAt)}
        </p>
      </div>
    ),
  },
  // 영수증 칸은 두지 않는다(11/14 경우 결정): 점주가 영수증을 보려면 점주마다 결제 API 키가 필요하다.
  // 고객은 고객 주문 상세의 영수증으로 확인한다
]

const PICKUP_DEADLINE_COLUMN: Column = {
  label: '픽업 기한',
  cell: (o) => (o.pickupDeadline ? formatShortPickupDate(o.pickupDeadline) : '-'),
}

/** 전체 구분에서 주문마다 지금 어디쯤인지. 구분 이름과 같은 말을 쓴다 */
function ownerStatusText(o: OwnerOrder): string {
  if (hasRefundStarted(o.refundStatus) || o.status === 'REFUNDED')
    return refundStatusLabel(o.refundStatus)
  switch (o.status) {
    case 'PAID':
      return '고객 신청 전'
    case 'PICKUP_REQUESTED':
      return '픽업 대기'
    case 'READY_FOR_PICKUP':
      return '준비 완료'
    case 'PICKUP_EXPIRED':
      return '기한 경과'
    default:
      return orderStatusLabel(o.status, null)
  }
}

/** 구분마다 더 보여 주는 칸. [준비 완료]·[픽업 확인]·[취소] 칸은 OrderTable 이 붙인다 */
const EXTRA_COLUMNS: Record<OwnerOrderTab, Column[]> = {
  ALL: [{ label: '상태', width: 'w-36', cell: ownerStatusText }, PICKUP_DEADLINE_COLUMN],
  PICKUP_WAITING: [PICKUP_DEADLINE_COLUMN],
  PICKUP_REQUESTED: [PICKUP_DEADLINE_COLUMN],
  READY_FOR_PICKUP: [PICKUP_DEADLINE_COLUMN],
  PICKED_UP: [
    {
      label: '픽업 시각',
      right: true,
      cell: (o) => (o.pickedUpAt ? formatDateTime(o.pickedUpAt) : '-'),
    },
  ],
  CANCELED: [
    {
      label: '처리 상태',
      width: 'w-28',
      cell: (o) => (
        <span className={cn(o.refundStatus === 'FAILED' && 'font-medium text-red-600')}>
          {hasRefundStarted(o.refundStatus) || o.status === 'REFUNDED'
            ? refundStatusLabel(o.refundStatus)
            : orderStatusLabel(o.status, null)}
        </span>
      ),
    },
    {
      // 요청자와 사유를 한 칸에 두 줄로 둔다 (1024px 포스기 화면 폭)
      label: '취소 사유',
      className: 'min-w-24 break-keep whitespace-normal',
      cell: (o) =>
        o.refund ? (
          <div className="leading-tight">
            <p>
              {o.refund.reasonDetail
                ? `${o.refund.reasonLabel}: ${o.refund.reasonDetail}`
                : o.refund.reasonLabel}
            </p>
            <p className="text-xs text-slate-500">
              {o.refund.requestedBy === 'CUSTOMER' ? '고객 요청' : '점주 요청'}
            </p>
          </div>
        ) : (
          '-'
        ),
    },
    {
      label: '요청·완료 시각',
      width: 'w-32',
      cell: (o) => (
        <div className="leading-tight">
          <p>{o.refund ? formatDateTime(o.refund.requestedAt) : '-'}</p>
          {o.refund?.canceledAt && (
            <p className="text-xs text-slate-500">{formatDateTime(o.refund.canceledAt)} 완료</p>
          )}
        </div>
      ),
    },
  ],
  PICKUP_EXPIRED: [PICKUP_DEADLINE_COLUMN],
}

/** [준비 완료]·[픽업 확인]·[취소]를 두는 구분과 주문 상태 */
const PICKUP_ACTION_TABS: OwnerOrderTab[] = [
  'ALL',
  'PICKUP_WAITING',
  'PICKUP_REQUESTED',
  'READY_FOR_PICKUP',
]
const PICKUP_ACTION_STATUSES: OwnerOrder['status'][] = [
  'PAID',
  'PICKUP_REQUESTED',
  'READY_FOR_PICKUP',
]

function OrderTable({ tab, orders }: { tab: OwnerOrderTab; orders: OwnerOrder[] }) {
  // 확인 모달을 연 주문. 주문 내용은 목록(서버 상태)에서 찾는다
  const [pickupOrderId, setPickupOrderId] = useState<number | null>(null)
  const pickupOrder = orders.find((o) => o.orderId === pickupOrderId)
  // 취소 사유 모달을 연 주문 (픽업 대기 [취소], 취소·환불 [환불 재시도])
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null)
  const cancelOrder = orders.find((o) => o.orderId === cancelOrderId)

  const columns = [...BASE_COLUMNS, ...EXTRA_COLUMNS[tab]]
  if (PICKUP_ACTION_TABS.includes(tab)) {
    columns.push({
      label: '픽업',
      srOnly: true,
      width: 'w-40',
      right: true,
      // 전체 구분에는 픽업 완료·기한 경과·환불 중인 주문도 있어 그 줄은 비운다
      cell: (o) =>
        !PICKUP_ACTION_STATUSES.includes(o.status) || o.refundStatus !== 'NONE' ? null : (
          <div className="flex justify-end gap-1">
            {o.status === 'READY_FOR_PICKUP' ? (
              <button
                type="button"
                onClick={() => setPickupOrderId(o.orderId)}
                aria-label={`${o.orderNo} 픽업 확인`}
                className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                픽업 확인
              </button>
            ) : (
              <>
                {/* [준비 완료]는 고객이 픽업 신청한 주문만 (order-service Order.markReadyForPickup) */}
                {o.status === 'PICKUP_REQUESTED' ? (
                  <ReadyButton order={o} />
                ) : (
                  // 전체 구분은 상태 칸에 이미 "고객 신청 전"이 있어 두 번 쓰지 않는다
                  tab !== 'ALL' && (
                    <span className="self-center px-1 text-xs text-slate-500">고객 신청 전</span>
                  )
                )}
                {/* 결제 완료·픽업 신청 주문만 취소할 수 있다. 준비 완료는 order-service가 취소를 받지 않는다(409) */}
                <button
                  type="button"
                  onClick={() => setCancelOrderId(o.orderId)}
                  aria-label={`${o.orderNo} 주문 취소`}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
              </>
            )}
          </div>
        ),
    })
  }
  if (tab === 'CANCELED') {
    // A9 환불 실패면 사유를 새로 받아 다시 시도한다. 해결 전까지 픽업 대기에 나오지 않아 픽업할 수 없다
    columns.push({
      label: '환불 재시도',
      srOnly: true,
      width: 'w-28',
      right: true,
      cell: (o) =>
        o.refundStatus === 'FAILED' ? (
          <button
            type="button"
            onClick={() => setCancelOrderId(o.orderId)}
            aria-label={`${o.orderNo} 환불 재시도`}
            className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            환불 재시도
          </button>
        ) : null,
    })
  }

  return (
    // relative: 표 머리의 sr-only(absolute) 글자가 이 스크롤 상자 밖으로 계산돼 페이지 폭을 넓히지 않게 한다
    <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
      {pickupOrder && (
        <PickupConfirmModal order={pickupOrder} onClose={() => setPickupOrderId(null)} />
      )}
      {cancelOrder && (
        <OwnerCancelDialog order={cancelOrder} onClose={() => setCancelOrderId(null)} />
      )}
      {/* 칸 너비를 고정해 구분(탭)을 바꿔도 같은 칸이 같은 자리에 있게 한다. 좁은 화면에선 가로 스크롤 */}
      <table className="w-full min-w-280 table-fixed text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                className={cn('px-2 py-3 font-medium', c.right && 'text-right', c.width)}
              >
                {c.srOnly ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 whitespace-nowrap text-slate-900">
          {orders.map((o) => (
            <tr key={o.orderId}>
              {columns.map((c) => (
                <td key={c.label} className={cn('px-2 py-3', c.right && 'text-right', c.className)}>
                  {c.cell(o)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** N-02 [준비 완료]: 포장을 끝내면 누른다. 확인 모달 없이 바로 바꾸고 고객에게 알림이 간다 */
export function ReadyButton({ order }: { order: OwnerOrder }) {
  const ready = useMarkReadyForPickup()
  const onClick = async () => {
    try {
      await ready.mutateAsync(order.orderId)
      toast.success(`${order.orderNo} 픽업 준비 완료. 고객에게 알렸어요`)
    } catch (e) {
      toast.error(readyErrorMessage(e))
    }
  }
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={ready.isPending}
      aria-label={`${order.orderNo} 픽업 준비 완료`}
      className="rounded-lg border border-emerald-600 px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
    >
      준비 완료
    </button>
  )
}

/**
 * A8 점주 결제 후 취소·A9 환불 재시도. 사유(실제 재고 부족·상품 상태 불량·매장 사정·기타)를 고르고 한 번 더 묻는다.
 * 결과는 토스트로 알리고 목록을 다시 읽는다
 */
function OwnerCancelDialog({ order, onClose }: { order: OwnerOrder; onClose(): void }) {
  const cancel = useOwnerCancelOrder()
  const [error, setError] = useState<string | null>(null)
  const retry = order.refundStatus === 'FAILED'

  const onSubmit = async (body: CancelOrderRequest) => {
    setError(null)
    try {
      const res = await cancel.mutateAsync({ orderId: order.orderId, body })
      onClose()
      if (res.refundStatus === 'COMPLETED') toast.success(`${order.orderNo} 취소·환불을 마쳤어요`)
      else if (res.refundStatus === 'FAILED')
        toast.error(`${order.orderNo} 환불에 실패했어요. 취소·환불 구분에서 다시 시도해 주세요`)
      else toast(`${order.orderNo} 환불 결과를 확인하고 있어요`)
    } catch (e) {
      setError(cancelErrorMessage(e))
    }
  }

  return (
    <CancelReasonDialog
      requester="OWNER"
      orderNo={order.orderNo}
      itemText={`${order.productName} ${order.quantity}개`}
      refundAmount={order.amount}
      retry={retry}
      pending={cancel.isPending}
      error={error}
      onSubmit={(body) => void onSubmit(body)}
      onClose={onClose}
    />
  )
}
