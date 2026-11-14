import { formatWon } from '@/customer/order/format'
import type { InventoryItem } from '@/owner/inventory/api'
import { cn } from '@/shared/ui/cn'
import type { SalesProductItem } from '../api'

interface Props {
  items: SalesProductItem[]
  stock: Map<number, InventoryItem>
  /** 하루 보기 표만 팔린 수량 옆에 작은 막대를 둔다(창에는 없음, 11/14 시안) */
  withBar?: boolean
  caption: string
}

/**
 * 그날 팔린 상품 표 (11/14 하루 보기·매출 날짜 창 시안): 상품, 팔린 수량, 마감세일, 매출, 지금 재고, 품절·부족.
 * 재고는 그날 끝이 아니라 지금 기준이다(재고 API 가 지금 값만 준다)
 */
export function SoldProductsTable({ items, stock, withBar = false, caption }: Props) {
  const max = Math.max(1, ...items.map((i) => i.soldQuantity))
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
        <tr>
          <th className="px-3 py-3 font-medium">상품</th>
          <th className="px-3 py-3 text-right font-medium">팔린 수량</th>
          <th className="px-3 py-3 text-right font-medium">마감세일</th>
          <th className="px-3 py-3 text-right font-medium">매출</th>
          <th className="px-3 py-3 text-right font-medium">지금 재고</th>
          <th className="px-3 py-3">
            <span className="sr-only">재고 상태</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 whitespace-nowrap text-slate-600 tabular-nums">
        {items.map((item) => {
          const s = stock.get(item.productId)
          return (
            <tr key={item.productId}>
              <td className="px-3 py-2.5 font-medium text-slate-900">{item.productName ?? '-'}</td>
              <td className="px-3 py-2.5 text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  {item.soldQuantity}개
                  {withBar && (
                    <span
                      aria-hidden
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
                    >
                      <span
                        className="block h-full rounded-full bg-emerald-600"
                        style={{ width: `${(Math.max(0, item.soldQuantity) / max) * 100}%` }}
                      />
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right">
                {item.clearanceQuantity > 0 ? `${item.clearanceQuantity}개` : ''}
              </td>
              <td className="px-3 py-2.5 text-right">{formatWon(item.netAmount)}</td>
              <td className="px-3 py-2.5 text-right">{s ? `${s.availableQuantity}개` : '-'}</td>
              <td className="px-3 py-2.5">
                {s && <StockBadge soldOut={s.availableQuantity === 0} low={s.lowStock} />}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function StockBadge({ soldOut, low }: { soldOut: boolean; low: boolean }) {
  if (!soldOut && !low) return null
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-semibold',
        soldOut ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-600',
      )}
    >
      {soldOut ? '품절' : '부족'}
    </span>
  )
}
