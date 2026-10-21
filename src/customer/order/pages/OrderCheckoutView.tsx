import { LoaderCircle, Minus, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { OrderSummary } from '../components/OrderSummary'
import { MAX_QUANTITY, MIN_QUANTITY } from '../checkout'
import { formatWon } from '../format'
import { useCheckout } from '../useCheckout'

/** U-21 주문·결제 화면 (/customer/orders/new). 아직 주문은 없고, [결제하기]를 누를 때 만든다 */
export function OrderCheckoutView() {
  const { item, quantity, setQuantity, total, submitting, submit } = useCheckout()

  if (!item) {
    return (
      <section className="space-y-3 py-10 text-center">
        <p className="text-sm text-slate-500">
          상품 정보를 찾을 수 없어요. 상품을 다시 골라 주세요.
        </p>
        <Link to="/customer" className="text-sm text-emerald-600 underline">
          점포 찾기로
        </Link>
      </section>
    )
  }

  const max = item.available === undefined ? MAX_QUANTITY : Math.min(MAX_QUANTITY, item.available)

  if (submitting) {
    return (
      <section className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <LoaderCircle className="size-8 animate-spin text-emerald-600" />
        <p className="font-medium text-slate-900">주문을 확인하고 있어요</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">주문·결제</h1>
      <OrderSummary
        rows={[
          { label: '점포', value: item.storeName },
          { label: '상품', value: item.productName },
          { label: '가격', value: formatWon(item.price) },
        ]}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">수량</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="수량 빼기"
            onClick={() => setQuantity(quantity - 1)}
            disabled={quantity <= MIN_QUANTITY}
            className="rounded-full border border-slate-300 p-1.5 text-slate-600 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-6 text-center font-medium text-slate-900" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="수량 더하기"
            onClick={() => setQuantity(quantity + 1)}
            disabled={quantity >= max}
            className="rounded-full border border-slate-300 p-1.5 text-slate-600 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <p className="text-right text-xs text-slate-500">한 번에 {MAX_QUANTITY}개까지 살 수 있어요</p>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm text-slate-500">결제 금액</span>
        <span className="text-lg font-bold text-slate-900">{formatWon(total)}</span>
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white"
      >
        결제하기
      </button>
      <p className="text-center text-xs text-slate-500">
        10분 안에 결제하지 않으면 주문이 취소돼요
      </p>
    </section>
  )
}
