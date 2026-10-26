import { LoaderCircle } from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import {
  apiErrorMessage,
  useDisposals,
  type DisposalHistoryItem,
  type DisposalStatus,
} from '../api'
import { formatDateTime, formatExpiry } from '../format'

const STATUS_LABEL: Record<DisposalStatus, string> = {
  REQUESTED: '처리 중',
  DONE: '폐기 완료',
  SKIPPED: '반영 안 됨',
}

const STATUS_CLASS: Record<DisposalStatus, string> = {
  REQUESTED: 'bg-slate-100 text-slate-600',
  DONE: 'bg-emerald-100 text-emerald-800',
  SKIPPED: 'bg-red-100 text-red-700',
}

/** 화면에 보여 주는 최대 건수. API 는 최근 100건을 주지만 표가 길어지지 않게 자른다 */
export const HISTORY_LIMIT = 20

/** 폐기 요청 상태 배지 */
export function DisposalStatusBadge({ status }: { status: DisposalStatus }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * S-33 최근 폐기 요청. 폐기는 202 로 접수만 되고 재고는 DISPOSE 쪽지를 처리한 뒤에 바뀌므로,
 * 요청이 DONE 으로 끝났는지, 예약 때문에 SKIPPED 됐는지를 여기서 보여 준다 (3초 폴링)
 */
export function DisposalHistory() {
  const disposals = useDisposals()

  return (
    <section aria-labelledby="disposal-history-title" className="space-y-2">
      <div>
        <h2 id="disposal-history-title" className="font-bold text-slate-900">
          최근 폐기 요청
        </h2>
        <p className="text-xs text-slate-500">
          요청은 바로 접수되고 재고는 몇 초 뒤에 줄어요. "반영 안 됨"은 처리 시점에 예약이 잡혀 있어
          폐기하지 못한 거예요. 다시 요청할 수 있어요.
        </p>
      </div>
      <HistoryTable disposals={disposals} />
    </section>
  )
}

function HistoryTable({ disposals }: { disposals: ReturnType<typeof useDisposals> }) {
  if (disposals.isPending) {
    return (
      <div className="flex justify-center py-6 text-slate-400">
        <LoaderCircle className="size-5 animate-spin" aria-label="폐기 요청 불러오는 중" />
      </div>
    )
  }
  if (disposals.isError) {
    return (
      <p className="py-6 text-center text-sm text-red-600">
        {apiErrorMessage(disposals.error, '폐기 요청 이력을 불러오지 못했어요.')}
      </p>
    )
  }
  if (disposals.data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">아직 폐기 요청이 없어요.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">요청 시각</th>
            <th className="px-3 py-2 font-medium">상품</th>
            <th className="px-3 py-2 font-medium">유통기한</th>
            <th className="px-3 py-2 text-right font-medium">수량</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-4 py-2 font-medium">처리 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {disposals.data.slice(0, HISTORY_LIMIT).map((item) => (
            <HistoryRow key={item.disposalId} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryRow({ item }: { item: DisposalHistoryItem }) {
  return (
    <tr data-status={item.status}>
      <td className="px-4 py-2 whitespace-nowrap text-slate-600 tabular-nums">
        {formatDateTime(item.createdAt)}
      </td>
      <td className="px-3 py-2 font-medium whitespace-nowrap">{item.productName}</td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-600 tabular-nums">
        {formatExpiry(item.expiryDate)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
      <td className="px-3 py-2">
        <DisposalStatusBadge status={item.status} />
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-slate-600 tabular-nums">
        {item.processedAt ? formatDateTime(item.processedAt) : '-'}
      </td>
    </tr>
  )
}
