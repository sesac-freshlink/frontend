import { ChartColumn, Megaphone, Package } from 'lucide-react'
import { Link } from 'react-router'
import { useNotices } from '@/board/api'
import { formatShortPickupDate, formatWon } from '@/customer/order/format'
import { useInventory, useExpiring, useSalesRanking } from '@/owner/inventory/api'
import { formatExpiry } from '@/owner/inventory/format'
import { useOwnerOrders } from '@/owner/orders/api'
import { ReadyButton } from '@/owner/orders/pages/OwnerOrdersPage'
import { useOwnerStore } from '@/owner/store/api'
import { useTodaySales } from '@/owner/sales/useTodaySales'
import { EMPTY_PERIOD } from '@/shared/api/period'
import { cn } from '@/shared/ui/cn'
import { Card, Empty, Stat } from '@/shared/ui/Dashboard'

/** 대시보드 목록마다 보여 주는 줄 수 */
const ROWS = 5

/**
 * 점주 첫 화면(11/12 결정 v4): 오늘 숫자 4칸(순매출·픽업 준비·소비기한 지남·재입고 필요),
 * 픽업 대기·오늘 판매 순위, 임박 상품, 재입고 필요·공지사항·바로가기.
 * 데이터는 이미 있는 API만 쓴다(주문·매출·재고·임박·판매 순위·공지)
 */
export function OwnerDashboardPage() {
  const store = useOwnerStore()
  const { today, totals } = useTodaySales()
  const waiting = useOwnerOrders({ tab: 'PICKUP_WAITING', page: 0, size: 20, period: EMPTY_PERIOD })
  const expiring = useExpiring()
  const soldOut = useInventory({
    q: '',
    statuses: ['SOLD_OUT'],
    memoOnly: false,
    page: 0,
    size: ROWS,
  })
  const low = useInventory({ q: '', statuses: ['LOW_STOCK'], memoOnly: false, page: 0, size: ROWS })
  const ranking = useSalesRanking({ from: today, to: today })
  const notices = useNotices(0)

  const orders = waiting.data?.content ?? []
  const todayDue = orders.filter((o) => o.pickupDeadline?.slice(0, 10) === today).length
  const lots = expiring.data ?? []
  const expiredLots = lots.filter((l) => l.expired)
  const expiredQty = expiredLots.reduce((sum, l) => sum + l.quantity, 0)
  const expiredProducts = new Set(expiredLots.map((l) => l.productId)).size
  const imminent = lots.filter((l) => !l.expired)
  const soldOutCount = soldOut.data?.totalElements ?? 0
  const restock = [...(soldOut.data?.items ?? []), ...(low.data?.items ?? [])].slice(0, ROWS)

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white">
        <h1 className="border-b border-slate-200 px-4 py-3 text-xl font-bold text-slate-900">
          안녕하세요, {store.data?.name ?? ''} 점주님
        </h1>
        <dl className="grid grid-cols-2 divide-slate-200 lg:grid-cols-4 lg:divide-x">
          <Stat
            value={totals ? formatWon(totals.netAmount) : '-'}
            label="오늘 순매출"
            sub={totals ? `결제 ${totals.paidCount}건` : undefined}
          />
          <Stat
            value={`${waiting.data?.totalElements ?? 0}건`}
            label="픽업 준비할 주문"
            sub={todayDue > 0 ? `오늘 기한 ${todayDue}건` : undefined}
            urgent={todayDue > 0}
          />
          <Stat
            value={`${expiredQty.toLocaleString('ko-KR')}개`}
            label="소비기한 지남"
            sub={expiredProducts > 0 ? `상품 ${expiredProducts}개 폐기 처리 필요` : undefined}
            urgent={expiredProducts > 0}
          />
          <Stat
            value={`${soldOutCount + (low.data?.lowStockCount ?? 0)}`}
            label="재입고 필요"
            sub={soldOutCount > 0 ? `품절 ${soldOutCount}` : undefined}
            urgent={soldOutCount > 0}
          />
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="픽업 대기"
          count={waiting.data?.totalElements}
          more="/owner/orders"
          moreLabel="전체 보기"
        >
          {orders.length === 0 ? (
            <Empty>픽업을 기다리는 주문이 없어요.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {orders.slice(0, ROWS).map((o) => (
                <li key={o.orderId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {o.productName} {o.quantity}개
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <OrderBadge requested={o.status === 'PICKUP_REQUESTED'} />
                      <span className="tabular-nums">{o.orderNo}</span>
                      {o.pickupDeadline && (
                        <span
                          className={cn(
                            o.pickupDeadline.slice(0, 10) === today && 'font-medium text-rose-700',
                          )}
                        >
                          {formatShortPickupDate(o.pickupDeadline)}까지
                        </span>
                      )}
                    </p>
                  </div>
                  {o.status === 'PICKUP_REQUESTED' ? (
                    <ReadyButton order={o} />
                  ) : (
                    <Link
                      to="/owner/orders"
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      픽업 확인
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="오늘 판매 순위" more="/owner/sales" moreLabel="매출">
          {(ranking.data?.items.length ?? 0) === 0 ? (
            <Empty>오늘 판매가 아직 없어요.</Empty>
          ) : (
            <ol className="divide-y divide-slate-200">
              {ranking.data?.items.slice(0, ROWS).map((r) => (
                <li key={r.productId} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-md text-xs font-semibold tabular-nums',
                      r.rank === 1 ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">{r.name}</span>
                  <span className="text-slate-500 tabular-nums">{r.soldQuantity}개</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card title="임박 상품" more="/owner/expiring" moreLabel="임박·폐기">
        {imminent.length === 0 ? (
          <Empty>소비기한이 임박한 상품이 없어요.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {imminent.slice(0, ROWS).map((l) => (
              <li key={l.lotId} className="rounded-lg border border-slate-200 p-3">
                <p className="truncate text-sm font-medium text-slate-900">{l.productName}</p>
                <p className="mt-1 text-xs text-slate-500">소비기한 {formatExpiry(l.expiryDate)}</p>
                <p className="text-xs text-slate-500">{l.quantity}개 남았어요</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="재입고 필요" more="/owner/inventory?status=LOW_STOCK" moreLabel="매장 재고">
          {restock.length === 0 ? (
            <Empty>재입고가 필요한 상품이 없어요.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {restock.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-2.5 text-sm">
                  {item.availableQuantity === 0 ? (
                    <span className="rounded-md bg-rose-700 px-2 py-0.5 text-xs font-semibold text-white">
                      품절
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      부족
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-slate-900">{item.name}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {item.availableQuantity}개 / 안전재고 {item.safetyStock}개
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="공지사항" more="/owner/notices" moreLabel="전체 보기">
          {(notices.data?.content.length ?? 0) === 0 ? (
            <Empty>공지사항이 없어요.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {notices.data?.content.slice(0, 3).map((n) => (
                <li key={n.noticeId}>
                  <Link
                    to={`/owner/notices/${n.noticeId}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"
                  >
                    <span className="min-w-0 truncate text-slate-900">{n.title}</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {n.createdAt.slice(5, 10).replace('-', '.')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="바로가기">
          <ul className="divide-y divide-slate-200">
            {SHORTCUTS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-3 py-2.5 text-sm text-slate-700 hover:underline"
                >
                  <Icon className="size-4 text-slate-500" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  )
}

/** 바로가기(11/12 결정): 매장 재고·매출·공지사항 */
const SHORTCUTS = [
  { to: '/owner/inventory', label: '매장 재고', icon: Package },
  { to: '/owner/sales', label: '매출', icon: ChartColumn },
  { to: '/owner/notices', label: '공지사항', icon: Megaphone },
]

function OrderBadge({ requested }: { requested: boolean }) {
  return requested ? (
    <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 font-semibold text-white">
      픽업 신청
    </span>
  ) : (
    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
      방문 대기
    </span>
  )
}
