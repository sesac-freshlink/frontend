import { LoaderCircle, RefreshCw } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { DEFAULT_ORDER_PAGE_SIZE, ORDER_PAGE_SIZES, type OrderPageSize } from '@/customer/order/api'
import { ReceiptLink } from '@/customer/order/components/ReceiptLink'
import { formatDateTime, formatShortPickupDate, formatWon } from '@/customer/order/format'
import { orderStatusLabel } from '@/customer/order/orderStatus'
import { type DatePeriod, EMPTY_PERIOD, isReversedPeriod } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { PageNav } from '@/shared/ui/PageNav'
import { PeriodFilter } from '@/shared/ui/PeriodFilter'
import { SalesRankingPanel } from '@/owner/inventory/components/SalesRankingPanel'
import { TabButton } from '@/owner/inventory/components/TabButton'
import { type OwnerOrder, type OwnerOrderTab, useOwnerOrders } from '../api'
import { PickupConfirmModal } from '../components/PickupConfirmModal'

interface TabInfo {
  tab: OwnerOrderTab
  label: string
  description: string
  empty: string
}

/** A6 구분 (추가 명세 A6 표 순서) */
const TABS: TabInfo[] = [
  {
    tab: 'PICKUP_WAITING',
    label: '픽업 대기',
    description: '결제가 끝나 픽업을 기다리는 주문이에요. 결제 시각 최신순이에요.',
    empty: '픽업을 기다리는 주문이 없어요.',
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
    description: '취소·환불 요청이 들어온 주문이에요.',
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
 * S-50·A6 /owner/orders 점주 주문 목록. 구분(픽업 대기·픽업 완료·취소·환불·기한 경과)과 기간(주문일 기준)으로 고른다.
 * 진입·구분·기간 변경·[새로 고침] 때만 조회한다 (폴링 없음).
 * 픽업 대기에서만 A5 [픽업 확인] → 확인 모달 → 픽업 완료하면 픽업 완료 구분으로 옮겨 간다
 */
type View = 'orders' | 'ranking'

/**
 * 점주 '주문' 메뉴. 주문 목록과 상품별 판매 순위(이태우, 10/30에 변동 이력에서 옮김)를 위 탭으로 나눈다.
 * 탭을 떠나면 그쪽 조회도 멈춘다
 */
export function OwnerOrdersPage() {
  const [view, setView] = useState<View>('orders')

  return (
    <section className="space-y-4">
      <div
        role="tablist"
        aria-label="주문·판매 순위"
        className="flex gap-1 border-b border-slate-200"
      >
        <TabButton
          label="주문 목록"
          selected={view === 'orders'}
          onSelect={() => setView('orders')}
        />
        <TabButton
          label="상품별 판매 순위"
          selected={view === 'ranking'}
          onSelect={() => setView('ranking')}
        />
      </div>
      {view === 'orders' ? <OwnerOrderList /> : <SalesRanking />}
    </section>
  )
}

function SalesRanking() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">상품별 판매 순위</h1>
        <p className="text-sm text-slate-500">
          결제가 끝나 실제로 팔린 수량(환불로 되돌린 수량은 뺌)을 많이 판 순서로 보여 줘요.
        </p>
      </div>
      <SalesRankingPanel />
    </div>
  )
}

function OwnerOrderList() {
  const [tab, setTab] = useState<OwnerOrderTab>('PICKUP_WAITING')
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
          <h1 className="text-xl font-bold text-slate-900">주문 목록</h1>
          <p className="text-sm text-slate-500">{info.description}</p>
        </div>
        <button
          type="button"
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching || reversed}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={cn('size-4', orders.isFetching && 'animate-spin')} />
          새로 고침
        </button>
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
                'rounded-md px-4 py-2 text-slate-500',
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
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : orders.isError ? (
        <p className="py-16 text-center text-sm text-red-600">주문을 불러오지 못했어요.</p>
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
  className?: string
  cell(o: OwnerOrder): ReactNode
}

/** 모든 구분이 같이 쓰는 칸 */
const BASE_COLUMNS: Column[] = [
  { label: '주문번호', className: 'font-medium', cell: (o) => o.orderNo },
  {
    label: '상품',
    // 상품명은 줄바꿈을 허용해 1024px 포스기에서도 표가 화면 안에 들어오게 한다
    className: 'min-w-24 break-keep whitespace-normal',
    cell: (o) => o.productName,
  },
  { label: '수량', right: true, cell: (o) => `${o.quantity}개` },
  { label: '금액', right: true, cell: (o) => formatWon(o.amount) },
  {
    // 결제 수단과 결제 시각을 한 칸에 두 줄로 둔다. 픽업 대기 표(칸 9개)가 1024px 포스기 화면 안에 들어오게 하려는 것이다
    label: '결제',
    cell: (o) => (
      <div className="leading-tight">
        <p>{o.payment?.method ?? '-'}</p>
        <p className="text-xs text-slate-500">
          {formatDateTime(o.payment?.approvedAt ?? o.paidAt)}
        </p>
      </div>
    ),
  },
  {
    label: '영수증',
    right: true,
    cell: (o) => <ReceiptLink url={o.payment?.receiptUrl ?? null} />,
  },
]

const PICKUP_DEADLINE_COLUMN: Column = {
  label: '픽업 기한',
  cell: (o) => (o.pickupDeadline ? formatShortPickupDate(o.pickupDeadline) : '-'),
}

/** 구분마다 더 보여 주는 칸. 픽업 대기의 [픽업 확인] 칸은 OrderTable 이 붙인다 */
const EXTRA_COLUMNS: Record<OwnerOrderTab, Column[]> = {
  PICKUP_WAITING: [PICKUP_DEADLINE_COLUMN],
  PICKED_UP: [
    {
      label: '픽업 시각',
      right: true,
      cell: (o) => (o.pickedUpAt ? formatDateTime(o.pickedUpAt) : '-'),
    },
  ],
  CANCELED: [{ label: '상태', cell: (o) => orderStatusLabel(o.status, null) }],
  PICKUP_EXPIRED: [PICKUP_DEADLINE_COLUMN],
}

function OrderTable({ tab, orders }: { tab: OwnerOrderTab; orders: OwnerOrder[] }) {
  // 확인 모달을 연 주문. 주문 내용은 목록(서버 상태)에서 찾는다
  const [pickupOrderId, setPickupOrderId] = useState<number | null>(null)
  const pickupOrder = orders.find((o) => o.orderId === pickupOrderId)

  const columns = [...BASE_COLUMNS, ...EXTRA_COLUMNS[tab]]
  if (tab === 'PICKUP_WAITING') {
    columns.push({
      label: '픽업',
      srOnly: true,
      right: true,
      cell: (o) => (
        <button
          type="button"
          onClick={() => setPickupOrderId(o.orderId)}
          aria-label={`${o.orderNo} 픽업 확인`}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          픽업 확인
        </button>
      ),
    })
  }

  return (
    // relative: 표 머리의 sr-only(absolute) 글자가 이 스크롤 상자 밖으로 계산돼 페이지 폭을 넓히지 않게 한다
    <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
      {pickupOrder && (
        <PickupConfirmModal order={pickupOrder} onClose={() => setPickupOrderId(null)} />
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={cn('px-2 py-3 font-medium', c.right && 'text-right')}>
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
