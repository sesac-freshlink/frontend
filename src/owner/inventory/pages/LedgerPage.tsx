import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useLedger, type LedgerItem, type LedgerType } from '../api'
import { formatDateTime, formatExpiry, formatSignedQuantity } from '../format'

const TYPE_LABEL: Record<LedgerType, string> = {
  INBOUND: '입고',
  SALE: '판매',
  DISPOSE: '폐기',
}

const TYPE_CLASS: Record<LedgerType, string> = {
  INBOUND: 'bg-emerald-100 text-emerald-800',
  SALE: 'bg-sky-100 text-sky-800',
  DISPOSE: 'bg-red-100 text-red-700',
}

const FILTERS: { label: string; type?: LedgerType }[] = [
  { label: '전체' },
  { label: '입고', type: 'INBOUND' },
  { label: '판매', type: 'SALE' },
  { label: '폐기', type: 'DISPOSE' },
]

/** S-13 재고 변동 이력. 입고 +, 판매·폐기 − 로 lot 별 수량이 어떻게 바뀌었는지 최신순으로 보여 준다 */
export function LedgerPage() {
  const [type, setType] = useState<LedgerType | undefined>(undefined)
  const ledger = useLedger({ type })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">변동 이력</h1>
          <p className="text-sm text-slate-500">
            입고·판매·폐기로 바뀐 수량을 3초마다 새로 읽어요.
          </p>
        </div>
        <div
          role="group"
          aria-label="종류"
          className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
        >
          {FILTERS.map((filter) => {
            const selected = filter.type === type
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={selected}
                onClick={() => setType(filter.type)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100',
                  selected && 'bg-emerald-600 text-white hover:bg-emerald-600',
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>
      <LedgerTable ledger={ledger} />
      <p className="text-xs text-slate-400">최근 100건까지 보여요.</p>
    </section>
  )
}

function LedgerTable({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  if (ledger.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (ledger.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(ledger.error, '이력을 불러오지 못했어요.')}
      </p>
    )
  }
  if (ledger.data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">아직 변동 이력이 없어요.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">시각</th>
            <th className="px-3 py-3 font-medium">종류</th>
            <th className="px-3 py-3 font-medium">상품</th>
            <th className="px-3 py-3 text-right font-medium">수량</th>
            <th className="px-4 py-3 font-medium">참조</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {ledger.data.map((item) => (
            <LedgerRow key={item.ledgerId} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LedgerRow({ item }: { item: LedgerItem }) {
  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
        {formatDateTime(item.createdAt)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TYPE_CLASS[item.type])}>
          {TYPE_LABEL[item.type]}
        </span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <p className="font-medium">{item.productName}</p>
        <p className="text-xs text-slate-400">유통기한 {formatExpiry(item.expiryDate)}</p>
      </td>
      <td
        className={cn(
          'px-3 py-3 text-right font-semibold tabular-nums',
          item.quantity > 0 ? 'text-emerald-700' : 'text-red-600',
        )}
      >
        {formatSignedQuantity(item.quantity)}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-400">{item.refId ?? '-'}</td>
    </tr>
  )
}
