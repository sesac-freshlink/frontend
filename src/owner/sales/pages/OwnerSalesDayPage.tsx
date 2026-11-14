import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { useOwnerOrders, type OwnerOrderTab } from '@/owner/orders/api'
import { cn } from '@/shared/ui/cn'
import { useDayLedger, useSales, useSalesProducts, useSalesStream, useStockByProduct } from '../api'
import { SoldProductsTable } from '../components/SoldProductsTable'
import {
  disposalSummary,
  formatDayTitle,
  kstToday,
  parseDayParam,
  shiftDay,
  sumSoldProducts,
} from '../sales'

/**
 * 점주 하루 보기 (11/14 경우 결정, 시안 "점주 · 하루 보기 (예시 안 A)"): 날짜 하나 기준으로 그날 순매출·결제 건수·
 * 팔린 수량·폐기, 팔린 상품 표, 픽업 건수, 폐기·입고를 한 화면에 둔다. 날짜는 주소 ?date= 로 정하고 없으면 오늘이다
 */
export function OwnerSalesDayPage() {
  const [params, setParams] = useSearchParams()
  const today = kstToday()
  const date = parseDayParam(params.get('date')) ?? today
  const go = (next: string) => setParams({ date: next })

  useSalesStream()
  const sales = useSales({ from: date, to: date, unit: 'day' })
  const products = useSalesProducts(date)
  const ledger = useDayLedger(date)
  const stock = useStockByProduct()

  const period = sales.data?.periods[0]
  const items = products.data?.items ?? []
  const sold = sumSoldProducts(items)
  const disposal = disposalSummary(ledger.data ?? [])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900">하루 보기</h1>
        <DayStepper date={date} today={today} onChange={go} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <dl className="grid grid-cols-2 divide-slate-200 lg:grid-cols-4 lg:divide-x">
          <DayStat
            label="순매출"
            value={period ? formatWon(period.netAmount) : '-'}
            sub={
              period
                ? `결제 ${formatWon(period.paidAmount)}, 환불 ${formatWon(period.refundAmount)}`
                : undefined
            }
            lead
          />
          <DayStat
            label="결제"
            value={period ? `${period.paidCount}건` : '-'}
            sub={
              period
                ? `환불 ${period.refundCount}건, 결제 전 취소 ${period.canceledCount}건`
                : undefined
            }
          />
          <DayStat
            label="팔린 수량"
            value={products.data ? `${sold.sold}개` : '-'}
            sub={products.data ? `그중 마감세일 ${sold.clearance}개` : undefined}
          />
          <DayStat
            label="폐기"
            value={ledger.data ? `${disposal.quantity}개` : '-'}
            sub={ledger.data ? `상품 ${disposal.products}개` : undefined}
          />
        </dl>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="day-sold"
          className="overflow-x-auto rounded-lg border border-slate-200 bg-white lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 id="day-sold" className="font-semibold text-slate-900">
              팔린 상품
            </h2>
            <span className="text-xs text-slate-500">많이 팔린 순, 재고는 지금 기준</span>
          </div>
          <QueryBody
            pending={products.isPending}
            error={products.isError}
            empty={items.length === 0}
            emptyText="이날 팔린 상품이 없어요."
            errorText="팔린 상품을 불러오지 못했어요."
          >
            <SoldProductsTable
              items={items}
              stock={stock}
              withBar
              caption={`${formatDayTitle(date)} 팔린 상품`}
            />
          </QueryBody>
        </section>

        <div className="space-y-4">
          <PickupCard date={date} />
          <section
            aria-labelledby="day-ledger"
            className="rounded-lg border border-slate-200 bg-white"
          >
            <CardHead id="day-ledger" title="폐기·입고" to="/owner/ledger" linkLabel="변동 이력" />
            <QueryBody
              pending={ledger.isPending}
              error={ledger.isError}
              empty={(ledger.data ?? []).length === 0}
              emptyText="이날 폐기·입고가 없어요."
              errorText="폐기·입고를 불러오지 못했어요."
            >
              <ul className="divide-y divide-slate-200">
                {(ledger.data ?? []).map((l) => (
                  <li key={l.ledgerId} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-slate-900">{l.productName}</span>
                    <span className="text-slate-600 tabular-nums">
                      {l.type === 'DISPOSE' ? '폐기' : '입고'} {Math.abs(l.quantity)}개
                    </span>
                  </li>
                ))}
              </ul>
            </QueryBody>
          </section>
        </div>
      </div>
    </section>
  )
}

/**
 * 숨긴 날짜 입력칸의 고르기 창을 연다. 브라우저가 막으면(사용자 누름이 아님·지원 안 함) 조용히 넘어간다.
 * 그때도 전날·다음 날·오늘 버튼으로 날짜를 옮길 수 있다
 */
function openPicker(input: HTMLInputElement | null) {
  try {
    input?.showPicker()
  } catch {
    // 고르기 창을 못 열어도 화면은 그대로 쓴다
  }
}

/** 위 오른쪽 날짜 이동: [전날] [날짜 고르기] [다음 날] [오늘]. 오늘 뒤로는 가지 않는다 */
function DayStepper({
  date,
  today,
  onChange,
}: {
  date: string
  today: string
  onChange: (date: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const btn =
    'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="전날"
        className={btn}
        onClick={() => onChange(shiftDay(date, -1))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={btn}
        aria-label={`날짜 고르기, 지금 ${formatDayTitle(date)}`}
        onClick={() => openPicker(input.current)}
      >
        <CalendarDays className="size-4" aria-hidden />
        <span className="tabular-nums">{formatDayTitle(date)}</span>
      </button>
      {/* 날짜 고르기 창만 쓰는 숨긴 입력칸. 고르면 주소의 date 가 바뀐다 */}
      <input
        ref={input}
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        aria-label="다음 날"
        className={btn}
        disabled={date >= today}
        onClick={() => onChange(shiftDay(date, 1))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={btn}
        disabled={date === today}
        onClick={() => onChange(today)}
      >
        오늘
      </button>
    </div>
  )
}

function DayStat({
  label,
  value,
  sub,
  lead = false,
}: {
  label: string
  value: string
  sub?: string
  lead?: boolean
}) {
  return (
    <div className="px-4 py-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-2xl font-bold tabular-nums',
          lead ? 'text-emerald-700' : 'text-slate-900',
        )}
      >
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-slate-500 tabular-nums">{sub}</dd>}
    </div>
  )
}

/** 픽업 건수: 그날 주문(주문일 기준)의 픽업 완료·픽업 대기·픽업 기한 지남 */
function PickupCard({ date }: { date: string }) {
  const rows: { tab: OwnerOrderTab; label: string }[] = [
    { tab: 'PICKED_UP', label: '픽업 완료' },
    { tab: 'PICKUP_WAITING', label: '픽업 대기' },
    { tab: 'PICKUP_EXPIRED', label: '픽업 기한 지남' },
  ]
  return (
    <section aria-labelledby="day-pickup" className="rounded-lg border border-slate-200 bg-white">
      <CardHead id="day-pickup" title="픽업" to="/owner/orders" linkLabel="결제·픽업" />
      <ul className="divide-y divide-slate-200">
        {rows.map((r) => (
          <PickupRow key={r.tab} tab={r.tab} label={r.label} date={date} />
        ))}
      </ul>
    </section>
  )
}

function PickupRow({ tab, label, date }: { tab: OwnerOrderTab; label: string; date: string }) {
  const orders = useOwnerOrders({ tab, page: 0, size: 10, period: { from: date, to: date } })
  return (
    <li className="flex justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-slate-900">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">
        {orders.data ? `${orders.data.totalElements}건` : '-'}
      </span>
    </li>
  )
}

function CardHead({
  id,
  title,
  to,
  linkLabel,
}: {
  id: string
  title: string
  to: string
  linkLabel: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-0.5">
      <h2 id={id} className="font-semibold text-slate-900">
        {title}
      </h2>
      {/* 누르는 곳 44px(tap-min) */}
      <Link
        to={to}
        className="inline-flex min-h-11 items-center text-sm text-emerald-700 underline"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

/** 표·목록 자리의 불러오는 중·오류·빈 상태 */
function QueryBody({
  pending,
  error,
  empty,
  emptyText,
  errorText,
  children,
}: {
  pending: boolean
  error: boolean
  empty: boolean
  emptyText: string
  errorText: string
  children: ReactNode
}) {
  if (pending) {
    return (
      <div className="flex justify-center py-10 text-slate-500">
        <LoaderCircle className="size-5 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (error) return <p className="py-10 text-center text-sm text-red-600">{errorText}</p>
  if (empty) return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>
  return <>{children}</>
}
