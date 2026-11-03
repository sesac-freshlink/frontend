import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useLedger, type LedgerItem, type LedgerType } from '../api'
import { AdjustmentHistory } from '../components/AdjustmentHistory'
import { InventoryStatsPanel } from '../components/InventoryStatsPanel'
import { TabButton } from '../components/TabButton'
import { formatDateTime, formatExpiry, formatSignedQuantity } from '../format'

const TYPE_LABEL: Record<LedgerType, string> = {
  INBOUND: '입고',
  SALE: '판매',
  DISPOSE: '폐기',
  ADJUST: '조정',
  RETURN: '환불 복원',
}

const TYPE_CLASS: Record<LedgerType, string> = {
  INBOUND: 'bg-emerald-100 text-emerald-800',
  SALE: 'bg-sky-100 text-sky-800',
  DISPOSE: 'bg-red-100 text-red-700',
  ADJUST: 'bg-violet-100 text-violet-800',
  RETURN: 'bg-amber-100 text-amber-800',
}

const FILTERS: { label: string; type?: LedgerType }[] = [
  { label: '전체' },
  { label: '입고', type: 'INBOUND' },
  { label: '판매', type: 'SALE' },
  { label: '폐기', type: 'DISPOSE' },
  { label: '조정', type: 'ADJUST' },
  { label: '환불 복원', type: 'RETURN' },
]

type Tab = 'history' | 'stats' | 'adjustments'

const DESCRIPTION: Record<Tab, string> = {
  history: '입고·판매·폐기·조정·환불 복원으로 바뀐 수량을 3초마다 새로 읽어요.',
  stats: '고른 기간의 입고·판매·폐기 수량을 상품별로 더했어요.',
  adjustments: '점주가 직접 고친 수량이에요. 얼마에서 얼마로, 왜 바꿨는지 남아요.',
}

/**
 * S-13 재고 변동 이력. 입고 +, 판매·폐기 − 로 lot 별 수량이 어떻게 바뀌었는지 최신순으로 보여 준다.
 * 통계 탭(S-42)은 같은 원장을 기간·상품별로 더한 수량과 폐기율, 조정 내역 탭(S-14)은 수동 조정 기록이다.
 * 상품별 판매 순위는 점주 '주문' 메뉴로 옮겼다(10/30)
 */
export function LedgerPage() {
  const [tab, setTab] = useState<Tab>('history')

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">변동 이력</h1>
        <p className="text-sm text-slate-500">{DESCRIPTION[tab]}</p>
      </div>
      <div
        role="tablist"
        aria-label="이력·통계·조정 내역"
        className="flex gap-1 border-b border-slate-200"
      >
        <TabButton label="이력" selected={tab === 'history'} onSelect={() => setTab('history')} />
        <TabButton label="통계" selected={tab === 'stats'} onSelect={() => setTab('stats')} />
        <TabButton
          label="조정 내역"
          selected={tab === 'adjustments'}
          onSelect={() => setTab('adjustments')}
        />
      </div>
      {tab === 'history' && <LedgerHistory />}
      {tab === 'stats' && <InventoryStatsPanel />}
      {tab === 'adjustments' && <AdjustmentHistory />}
    </section>
  )
}

/** 이력 탭. 탭을 떠나면 폴링도 멈춘다 */
function LedgerHistory() {
  const [type, setType] = useState<LedgerType | undefined>(undefined)
  const ledger = useLedger({ type })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
    </div>
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
