import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { formatShortDate } from '@/owner/sales/sales'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useSalesRanking, type SalesRankItem } from '../api'
import { formatRate, statsPeriod } from '../format'

const PERIODS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
] as const
type Days = (typeof PERIODS)[number]['days']

/**
 * 상품별 판매 순위. 결제가 확정되어 실물이 줄어든 수량(원장 SALE)에서 환불 복원(RETURN)을 뺀 순판매를 많이 판 순으로 상위 10개 보여 준다.
 * 점주 '주문' 메뉴(OwnerOrdersPage)에 있다.
 * 예약만 된(결제 대기) 수량은 세지 않는다. 같은 수량이면 같은 순위다(1, 2, 2, 4)
 */
export function SalesRankingPanel() {
  const [days, setDays] = useState<Days>(7)
  // 기간은 고를 때 정한다. 자정을 넘겨도 다시 고르기 전까지 같은 기간을 본다
  const [period, setPeriod] = useState(() => statsPeriod(7))
  const ranking = useSalesRanking(period)

  const choose = (next: Days) => {
    setDays(next)
    setPeriod(statsPeriod(next))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="기간"
          className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
        >
          {PERIODS.map(({ days: value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === days}
              onClick={() => choose(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100',
                value === days && 'bg-emerald-700 text-white hover:bg-emerald-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500 tabular-nums">
          {period.from === period.to
            ? formatShortDate(period.to)
            : `${formatShortDate(period.from)} ~ ${formatShortDate(period.to)}`}
        </p>
      </div>
      <RankingBody ranking={ranking} />
    </div>
  )
}

function RankingBody({ ranking }: { ranking: ReturnType<typeof useSalesRanking> }) {
  if (ranking.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (ranking.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(ranking.error, '판매 순위를 불러오지 못했어요.')}
      </p>
    )
  }
  if (ranking.data.items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">이 기간에 판매된 상품이 없어요.</p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        이 기간 판매{' '}
        <span className="font-semibold text-slate-900 tabular-nums">
          {ranking.data.totalSoldQuantity}개
        </span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              <th className="w-16 px-4 py-3 text-center font-medium">순위</th>
              <th className="px-3 py-3 font-medium">상품</th>
              <th className="px-3 py-3 text-right font-medium">판매 수량</th>
              <th className="px-4 py-3 text-right font-medium">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {ranking.data.items.map((item) => (
              <RankRow key={item.productId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RankRow({ item }: { item: SalesRankItem }) {
  return (
    <tr>
      <td className="px-4 py-2 text-center">
        <span
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold text-slate-600 tabular-nums',
            item.rank <= 3 && 'bg-emerald-100 text-emerald-800',
          )}
        >
          {item.rank}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {/* 11/12 결정: 목록에는 사진·상품 코드를 넣지 않는다(사진은 상세에서) */}
        <p className="font-medium">{item.name}</p>
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{item.soldQuantity}개</td>
      <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{formatRate(item.share)}</td>
    </tr>
  )
}
