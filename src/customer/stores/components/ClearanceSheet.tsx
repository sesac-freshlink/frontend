import { BuyBar, BuyButton } from './BuyBar'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { MAX_QUANTITY, type CheckoutItem } from '@/customer/order/checkout'
import { useBuyNow } from '@/customer/order/useBuyNow'
import { formatHHmm, formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import type { StoreProductDetail } from '../api'
import {
  canDecrease,
  canIncrease,
  CLEARANCE_DISCOUNT_PERCENT,
  clearanceOf,
  initialSelection,
  selectionAmount,
  selectionTotal,
  type SheetRow,
  type SheetSelection,
} from '../clearance'

/**
 * 마감세일 구매 시트. 기본(정가)과 마감세일 두 줄에서 수량을 고르고 [N원 구매하기]로 바로 주문을 만든다(주문·결제 화면은 11/11 없앴다).
 * 두 줄 합계 1~5개, 한 줄만 사도 된다. 그 사이 마감세일이 다 팔리면 주문이 실패하고 결제 대기 화면이 어느 쪽이 모자란지 알리고 다시 고르게 한다.
 * 마감세일이 없으면(clearanceOf 가 null) 그리지 않는다
 */
export function ClearanceSheet({
  product,
  item,
}: {
  product: StoreProductDetail
  item: CheckoutItem | undefined
}) {
  const clearance = clearanceOf(product)
  const [selection, setSelection] = useState<SheetSelection>(() => initialSelection(product))
  const buyNow = useBuyNow()
  if (!clearance) return null

  const change = (row: SheetRow, delta: number) =>
    setSelection((s) => ({ ...s, [row]: s[row] + delta }))
  const total = selectionTotal(selection)

  return (
    <section
      aria-labelledby="clearance-sheet-title"
      className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4"
    >
      <div className="space-y-0.5">
        <h2 id="clearance-sheet-title" className="text-sm font-semibold text-slate-900">
          마감세일 {CLEARANCE_DISCOUNT_PERCENT}%
        </h2>
        <p className="text-xs text-slate-500">
          유통기한이 하루 안 남은 상품을 싸게 팔아요.
          {product.clearanceExpiry && ` ${formatHHmm(product.clearanceExpiry)}까지 드세요.`}
        </p>
      </div>

      <ul className="divide-y divide-rose-100">
        <SheetRowView
          label="마감세일"
          price={clearance.price}
          basePrice={product.price}
          left={clearance.quantity}
          value={selection.clearance}
          canAdd={canIncrease(product, selection, 'clearance')}
          canRemove={canDecrease(selection, 'clearance')}
          onChange={(d) => change('clearance', d)}
        />
        <SheetRowView
          label="일반"
          price={product.price}
          left={product.availableQuantity}
          value={selection.normal}
          canAdd={canIncrease(product, selection, 'normal')}
          canRemove={canDecrease(selection, 'normal')}
          onChange={(d) => change('normal', d)}
        />
      </ul>

      <p className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          합계 {total}개 <span className="text-xs">(한 번에 {MAX_QUANTITY}개까지)</span>
        </span>
        <span className="font-semibold text-slate-900 tabular-nums" aria-live="polite">
          {formatWon(selectionAmount(product, selection))}
        </span>
      </p>

      {/* [N원 구매하기]는 화면 아래 고정 띠에 둔다. 점포를 모르면(주소로 바로 들어옴) 누를 수 없다 */}
      <BuyBar>
        <BuyButton
          amount={selectionAmount(product, selection)}
          pending={buyNow.pending}
          disabled={!item}
          onClick={() =>
            item &&
            void buyNow.buy({
              storeId: item.storeId,
              storeName: item.storeName,
              productId: item.productId,
              quantity: total,
              clearanceQuantity: selection.clearance,
            })
          }
        />
      </BuyBar>
    </section>
  )
}

interface RowProps {
  label: string
  price: number
  /** 할인 전 가격. 있으면 줄을 그어 함께 보여 준다 */
  basePrice?: number
  left: number
  value: number
  canAdd: boolean
  canRemove: boolean
  onChange: (delta: number) => void
}

function SheetRowView({
  label,
  price,
  basePrice,
  left,
  value,
  canAdd,
  canRemove,
  onChange,
}: RowProps) {
  const stepClass =
    'flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40'
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
          {label}
          <span className={cn('tabular-nums', basePrice !== undefined && 'text-rose-700')}>
            {formatWon(price)}
          </span>
          {basePrice !== undefined && (
            <span className="text-xs text-slate-400 tabular-nums line-through">
              {formatWon(basePrice)}
            </span>
          )}
        </span>
        <span className="block text-xs text-slate-500 tabular-nums">{left}개 남음</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={`${label} 한 개 빼기`}
          disabled={!canRemove}
          onClick={() => onChange(-1)}
          className={stepClass}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span
          className="w-5 text-center text-sm font-semibold tabular-nums"
          aria-label={`${label} ${value}개`}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label} 한 개 더하기`}
          disabled={!canAdd}
          onClick={() => onChange(1)}
          className={stepClass}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </span>
    </li>
  )
}
