import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import {
  apiErrorMessage,
  useSafetyStocks,
  useUpdateSafetyStock,
  type SafetyStockItem,
} from '../api'
import { MAX_SAFETY_STOCK, parseSafetyStock } from '../safetyStock'

/**
 * S-40 상품별 안전재고 설정. 입고 전 상품까지 전부 보여 주고, 행마다 따로 저장한다.
 * 구매 가능 수량이 이 값보다 적으면 재고 목록에 "부족" 배지가 붙는다
 */
export function SafetyStockSettings() {
  const safetyStocks = useSafetyStocks()

  if (safetyStocks.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (safetyStocks.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(safetyStocks.error, '안전재고를 불러오지 못했어요.')}
      </p>
    )
  }
  if (safetyStocks.data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">등록된 상품이 없어요.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        정하지 않은 상품은 5개로 봐요. 0으로 두면 그 상품은 부족으로 표시하지 않아요.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">상품</th>
              <th className="px-3 py-3 font-medium">카테고리</th>
              <th className="px-3 py-3 font-medium">구분</th>
              <th className="px-4 py-3 text-right font-medium">안전재고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {safetyStocks.data.map((item) => (
              // 저장 뒤 서버 값이 바뀌면 행을 새로 그려 입력칸을 서버 값으로 되돌린다
              <SafetyStockRow key={`${item.productId}:${item.safetyStock}`} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SafetyStockRow({ item }: { item: SafetyStockItem }) {
  const update = useUpdateSafetyStock()
  const [draft, setDraft] = useState(String(item.safetyStock))
  const value = parseSafetyStock(draft)
  const invalid = value === null
  const changed = value !== null && value !== item.safetyStock

  const save = () => {
    if (value === null || !changed) return
    update.mutate(
      { productId: item.productId, safetyStock: value },
      {
        onSuccess: () => toast.success(`${item.name} 안전재고를 ${value}개로 정했어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '안전재고를 저장하지 못했어요.')),
      },
    )
  }

  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-slate-400">{item.productCode}</p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{item.category}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            item.customized ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {item.customized ? '직접 정함' : '기본값'}
        </span>
      </td>
      <td className="px-4 py-3">
        <form
          className="flex items-center justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_SAFETY_STOCK}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${item.name} 안전재고`}
            aria-invalid={invalid || undefined}
            className={cn(
              'w-20 rounded-md border border-slate-200 px-2 py-1 text-right tabular-nums focus:border-emerald-600 focus:outline-none',
              invalid && 'border-red-600 focus:border-red-600',
            )}
          />
          <button
            type="submit"
            disabled={!changed || update.isPending}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            저장
          </button>
        </form>
        {invalid && (
          <p className="mt-1 text-right text-xs text-red-600">
            0~{MAX_SAFETY_STOCK} 사이 정수로 넣어 주세요.
          </p>
        )}
      </td>
    </tr>
  )
}
