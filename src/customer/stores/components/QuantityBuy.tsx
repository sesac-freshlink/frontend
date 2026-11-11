import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  clampQuantity,
  MAX_QUANTITY,
  MIN_QUANTITY,
  type CheckoutItem,
} from '@/customer/order/checkout'
import { useBuyNow } from '@/customer/order/useBuyNow'
import { BuyBar, BuyButton } from './BuyBar'

/**
 * 일반 상품 수량 고르기 (U-10). 1개부터 한 번에 5개까지, 남은 수량이 더 적으면 그만큼.
 * [N원 구매하기]를 누르면 주문을 만들고 바로 결제 대기 화면으로 간다 (주문·결제 화면은 11/11 없앴다)
 */
export function QuantityBuy({ item }: { item: CheckoutItem }) {
  const [quantity, setQuantity] = useState(MIN_QUANTITY)
  const buyNow = useBuyNow()
  const max = clampQuantity(MAX_QUANTITY, item.available)
  const stepClass =
    'flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40'

  return (
    <section aria-label="수량 고르기" className="space-y-1 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-900">수량</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            aria-label="수량 한 개 빼기"
            disabled={quantity <= MIN_QUANTITY}
            onClick={() => setQuantity((q) => clampQuantity(q - 1, item.available))}
            className={stepClass}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span
            className="w-6 text-center text-sm font-semibold tabular-nums"
            aria-live="polite"
            aria-label={`수량 ${quantity}개`}
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label="수량 한 개 더하기"
            disabled={quantity >= max}
            onClick={() => setQuantity((q) => clampQuantity(q + 1, item.available))}
            className={stepClass}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </span>
      </div>
      <p className="text-right text-xs text-slate-500">한 번에 {MAX_QUANTITY}개까지 살 수 있어요</p>

      <BuyBar>
        <BuyButton
          amount={item.price * quantity}
          pending={buyNow.pending}
          onClick={() =>
            void buyNow.buy({
              storeId: item.storeId,
              storeName: item.storeName,
              productId: item.productId,
              quantity,
            })
          }
        />
      </BuyBar>
    </section>
  )
}
