import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useInventoryStats, type InventoryStats, type ProductStats } from '../api'
import { formatRate, formatSignedQuantity, statsPeriod } from '../format'

const PERIODS = [7, 30, 90] as const
type Days = (typeof PERIODS)[number]

/**
 * S-42 판매·폐기 통계. 오늘까지 7·30·90일 동안 상품별 입고·판매·폐기 수량과 폐기율을 보여 준다.
 * 폐기율 = 폐기 ÷ (판매 + 폐기): 나간 물건 중 버려진 비율. 조정(S-14)은 늘고 준 것을 합친 값으로 따로 보인다. 금액은 다루지 않는다
 */
export function InventoryStatsPanel() {
  const [days, setDays] = useState<Days>(7)
  // 기간은 고를 때 정한다. 자정을 넘겨도 다시 고르기 전까지 같은 기간을 본다
  const [period, setPeriod] = useState(() => statsPeriod(7))
  const stats = useInventoryStats(period)

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
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === days}
              onClick={() => choose(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100',
                value === days && 'bg-emerald-600 text-white hover:bg-emerald-600',
              )}
            >
              최근 {value}일
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500 tabular-nums">
          {period.from} ~ {period.to}
        </p>
      </div>
      <StatsBody stats={stats} />
    </div>
  )
}

function StatsBody({ stats }: { stats: ReturnType<typeof useInventoryStats> }) {
  if (stats.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (stats.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(stats.error, '통계를 불러오지 못했어요.')}
      </p>
    )
  }
  return (
    <>
      <Totals stats={stats.data} />
      {stats.data.products.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          이 기간에 입고·판매·폐기가 없어요.
        </p>
      ) : (
        <ProductTable products={stats.data.products} />
      )}
    </>
  )
}

function Totals({ stats }: { stats: InventoryStats }) {
  const tiles = [
    { label: '입고', value: `${stats.inboundQuantity}개` },
    { label: '판매', value: `${stats.soldQuantity}개` },
    { label: '폐기', value: `${stats.disposedQuantity}개` },
    { label: '조정', value: `${formatSignedQuantity(stats.adjustedQuantity)}개` },
    { label: '폐기율', value: formatRate(stats.disposalRate) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <dt className="text-xs text-slate-500">{tile.label}</dt>
          <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProductTable({ products }: { products: ProductStats[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">상품</th>
            <th className="px-3 py-3 font-medium">카테고리</th>
            <th className="px-3 py-3 text-right font-medium">입고</th>
            <th className="px-3 py-3 text-right font-medium">판매</th>
            <th className="px-3 py-3 text-right font-medium">폐기</th>
            <th className="px-3 py-3 text-right font-medium">조정</th>
            <th className="px-4 py-3 text-right font-medium">폐기율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {products.map((item) => (
            <tr key={item.productId}>
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-slate-400">{item.productCode}</p>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-slate-600">{item.category}</td>
              <td className="px-3 py-3 text-right tabular-nums">{item.inboundQuantity}</td>
              <td className="px-3 py-3 text-right tabular-nums">{item.soldQuantity}</td>
              <td
                className={cn(
                  'px-3 py-3 text-right tabular-nums',
                  item.disposedQuantity > 0 && 'font-semibold text-red-600',
                )}
              >
                {item.disposedQuantity}
              </td>
              <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                {formatSignedQuantity(item.adjustedQuantity)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatRate(item.disposalRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
