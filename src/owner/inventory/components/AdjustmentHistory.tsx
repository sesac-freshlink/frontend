import { LoaderCircle } from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import { REASON_LABEL } from '../adjustment'
import { apiErrorMessage, useAdjustments, type AdjustmentHistoryItem } from '../api'
import { formatDateTime, formatExpiry, formatSignedQuantity } from '../format'

/** S-14 조정 이력. 원장에는 증감만 남지만 여기서는 얼마에서 얼마로, 왜 바꿨는지까지 보여 준다 */
export function AdjustmentHistory() {
  const adjustments = useAdjustments()

  if (adjustments.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (adjustments.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(adjustments.error, '조정 내역을 불러오지 못했어요.')}
      </p>
    )
  }
  if (adjustments.data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        아직 조정한 적이 없어요. 재고 화면에서 상품을 고르고 lot 옆 연필 버튼으로 조정해요.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">시각</th>
              <th className="px-3 py-3 font-medium">상품</th>
              <th className="px-3 py-3 font-medium">사유</th>
              <th className="px-3 py-3 text-right font-medium">조정 전 → 후</th>
              <th className="px-3 py-3 text-right font-medium">증감</th>
              <th className="px-4 py-3 font-medium">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {adjustments.data.map((item) => (
              <AdjustmentRow key={item.adjustmentId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">최근 100건까지 보여요.</p>
    </div>
  )
}

function AdjustmentRow({ item }: { item: AdjustmentHistoryItem }) {
  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
        {formatDateTime(item.createdAt)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <p className="font-medium">{item.productName}</p>
        <p className="text-xs text-slate-400">유통기한 {formatExpiry(item.expiryDate)}</p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
          {REASON_LABEL[item.reason]}
        </span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
        {item.quantityBefore} → {item.quantityAfter}
      </td>
      <td
        className={cn(
          'px-3 py-3 text-right font-semibold tabular-nums',
          item.delta > 0 ? 'text-emerald-700' : 'text-red-600',
        )}
      >
        {formatSignedQuantity(item.delta)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{item.memo ?? '-'}</td>
    </tr>
  )
}
