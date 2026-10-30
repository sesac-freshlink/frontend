import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { useSales, type SalesResponse, type SalesUnit } from '../api'
import { SalesChart } from '../components/SalesChart'
import {
  formatShortDate,
  isAllZero,
  kstToday,
  periodLabel,
  QUICK_RANGES,
  quickRange,
  rangeError,
  sumPeriods,
  thisWeekRange,
  todayAndWeek,
  UNITS,
  type QuickRange,
  type SalesRange,
} from '../sales'

const CHART_TITLE: Record<SalesUnit, string> = {
  day: '일별 순매출',
  week: '주별 순매출',
  month: '월별 순매출',
}

/**
 * 점주 매출 대시보드 (기능 ID 미정, order-service GET /owner/orders/sales).
 * 위에 오늘·이번 주 순매출과 고른 기간의 결제·환불 건수 카드, 아래에 기간·단위 선택과 순매출 그래프·표를 둔다.
 * 오늘 매출 카드의 실시간 갱신(매출 SSE)은 아직 없다. 화면에 들어올 때와 기간·단위를 바꿀 때 읽는다
 */
export function OwnerSalesPage() {
  // 오늘·이번 주는 화면에 들어올 때 정한다. 자정을 넘기면 빠른 기간 버튼을 다시 누르면 된다
  const [now] = useState(() => new Date())
  const today = kstToday(now)
  const week = thisWeekRange(now)
  const [preset, setPreset] = useState<QuickRange | null>('last7')
  const [range, setRange] = useState<SalesRange>(() => quickRange('last7', now))
  const [unit, setUnit] = useState<SalesUnit>('day')

  const error = rangeError(range)
  const sales = useSales(error ? null : { ...range, unit })
  // 오늘·이번 주 카드는 고른 기간과 상관없이 이번 주(월요일 ~ 오늘) 일별 응답 하나로 채운다
  const weekSales = useSales({ ...week, unit: 'day' })

  const choosePreset = (next: QuickRange) => {
    setPreset(next)
    setRange(quickRange(next))
  }
  const changeDate = (field: keyof SalesRange, value: string) => {
    setPreset(null)
    setRange((prev) => ({ ...prev, [field]: value }))
  }

  const weekTotals = weekSales.data ? todayAndWeek(weekSales.data.periods, today) : null
  // 앞 기간 결과를 보여 주는 동안(placeholder)에는 건수 카드를 비워 다른 기간 숫자가 보이지 않게 한다
  const totals =
    !error && sales.data && !sales.isPlaceholderData ? sumPeriods(sales.data.periods) : null

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">매출</h1>
        <p className="text-sm text-slate-500">
          결제 승인 시각(한국 시간) 기준이에요. 순매출은 결제 금액에서 환불 금액을 뺀 값이에요.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="오늘 매출"
          sub={`${formatShortDate(today)} 순매출`}
          value={weekTotals && formatWon(weekTotals.today)}
          failed={weekSales.isError}
        />
        <SummaryCard
          label="이번 주 매출"
          sub={`${formatShortDate(week.from)} ~ 오늘 순매출`}
          value={weekTotals && formatWon(weekTotals.week)}
          failed={weekSales.isError}
        />
        <SummaryCard
          label="결제 건수"
          sub="고른 기간"
          value={totals && `${totals.paidCount.toLocaleString('ko-KR')}건`}
          failed={!error && sales.isError}
        />
        <SummaryCard
          label="환불 건수"
          sub="고른 기간"
          value={totals && `${totals.refundCount.toLocaleString('ko-KR')}건`}
          failed={!error && sales.isError}
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <ToggleGroup
          label="기간"
          options={QUICK_RANGES}
          selected={preset}
          onSelect={choosePreset}
        />
        <div className="flex items-end gap-2">
          <DateInput label="시작일" value={range.from} onChange={(v) => changeDate('from', v)} />
          <span className="pb-1.5 text-slate-400">~</span>
          <DateInput label="종료일" value={range.to} onChange={(v) => changeDate('to', v)} />
        </div>
        <ToggleGroup label="단위" options={UNITS} selected={unit} onSelect={setUnit} />
      </div>

      {error ? (
        <p role="alert" className="py-16 text-center text-sm text-red-600">
          {error}
        </p>
      ) : (
        <SalesBody sales={sales} />
      )}
    </section>
  )
}

function SummaryCard({
  label,
  sub,
  value,
  failed,
}: {
  label: string
  sub: string
  /** null 이면 아직 없음(불러오는 중·기간 오류) */
  value: string | null
  failed: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      {failed ? (
        <p className="mt-2 text-sm text-red-600">불러오지 못했어요</p>
      ) : (
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value ?? '-'}</p>
      )}
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function ToggleGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T | null
  onSelect: (value: T) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-slate-600 hover:bg-slate-100',
              option.value === selected && 'bg-emerald-600 text-white hover:bg-emerald-600',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900 tabular-nums focus:border-emerald-500 focus:outline-none"
      />
    </label>
  )
}

function SalesBody({ sales }: { sales: ReturnType<typeof useSales> }) {
  if (sales.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (sales.isError) {
    return <p className="py-16 text-center text-sm text-red-600">매출을 불러오지 못했어요.</p>
  }
  const data = sales.data
  const range = `${formatShortDate(data.from)} ~ ${formatShortDate(data.to)}`
  if (isAllZero(data.periods)) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
        {range} 동안 결제된 매출이 없어요.
      </p>
    )
  }
  // 기간·단위를 바꿔 새로 읽는 동안에는 앞 결과를 흐리게 보여 준다
  return (
    <div className={cn('space-y-6', sales.isPlaceholderData && 'opacity-60')}>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{CHART_TITLE[data.unit]}</h2>
          <p className="flex items-center gap-2 text-sm text-slate-500 tabular-nums">
            {sales.isFetching && (
              <LoaderCircle className="size-4 animate-spin" aria-label="새로 불러오는 중" />
            )}
            {range}
          </p>
        </div>
        <SalesChart periods={data.periods} unit={data.unit} title={CHART_TITLE[data.unit]} />
      </div>
      <SalesTable data={data} />
    </div>
  )
}

function SalesTable({ data }: { data: SalesResponse }) {
  const totals = sumPeriods(data.periods)
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-3 py-3 font-medium">기간</th>
            <th className="px-3 py-3 text-right font-medium">결제 금액</th>
            <th className="px-3 py-3 text-right font-medium">환불 금액</th>
            <th className="px-3 py-3 text-right font-medium">순매출</th>
            <th className="px-3 py-3 text-right font-medium">결제 건수</th>
            <th className="px-3 py-3 text-right font-medium">환불 건수</th>
            <th className="px-3 py-3 text-right font-medium">취소 건수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 whitespace-nowrap text-slate-900 tabular-nums">
          {data.periods.map((p) => (
            <tr key={p.period}>
              <td className="px-3 py-2.5">{periodLabel(p.period, data.unit, data)}</td>
              <td className="px-3 py-2.5 text-right">{formatWon(p.paidAmount)}</td>
              <td className="px-3 py-2.5 text-right">{formatWon(p.refundAmount)}</td>
              <td className="px-3 py-2.5 text-right font-medium">{formatWon(p.netAmount)}</td>
              <td className="px-3 py-2.5 text-right">{p.paidCount}건</td>
              <td className="px-3 py-2.5 text-right">{p.refundCount}건</td>
              <td className="px-3 py-2.5 text-right">{p.canceledCount}건</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold whitespace-nowrap text-slate-900 tabular-nums">
          <tr>
            <th scope="row" className="px-3 py-3 text-left">
              합계
            </th>
            <td className="px-3 py-3 text-right">{formatWon(totals.paidAmount)}</td>
            <td className="px-3 py-3 text-right">{formatWon(totals.refundAmount)}</td>
            <td className="px-3 py-3 text-right">{formatWon(totals.netAmount)}</td>
            <td className="px-3 py-3 text-right">{totals.paidCount.toLocaleString('ko-KR')}건</td>
            <td className="px-3 py-3 text-right">{totals.refundCount.toLocaleString('ko-KR')}건</td>
            <td className="px-3 py-3 text-right">
              {totals.canceledCount.toLocaleString('ko-KR')}건
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
