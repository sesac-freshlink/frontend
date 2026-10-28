import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/auth/api'
import { useCreateOrder } from './api'
import { clampQuantity, MIN_QUANTITY, parseCheckout, type CheckoutItem } from './checkout'

export interface UseCheckoutReturn {
  /** 주소에서 읽은 상품. 값이 없거나 틀리면 null */
  item: CheckoutItem | null
  quantity: number
  setQuantity(quantity: number): void
  /** 표시용 금액 (단가 × 수량). 실제 금액은 서버가 정한다 */
  total: number
  submitting: boolean
  submit(): Promise<void>
}

/**
 * U-21 주문·결제 화면 로직. [결제하기]를 누르면 그때 주문을 만든다 (OR-01).
 * Idempotency-Key 는 구매 시도마다 하나: 같은 시도의 재시도는 같은 키, 수량을 바꾸면 새 키.
 */
export function useCheckout(): UseCheckoutReturn {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const item = parseCheckout(params)
  const createOrder = useCreateOrder()
  const [quantity, setQuantityState] = useState(MIN_QUANTITY)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  return {
    item,
    quantity,
    setQuantity(next) {
      const clamped = clampQuantity(next, item?.available)
      if (clamped === quantity) return
      setQuantityState(clamped)
      setIdempotencyKey(crypto.randomUUID())
    },
    total: (item?.price ?? 0) * quantity,
    submitting: createOrder.isPending,

    async submit() {
      if (!item || createOrder.isPending) return
      try {
        const order = await createOrder.mutateAsync({
          idempotencyKey,
          body: {
            storeId: item.storeId,
            storeName: item.storeName,
            productId: item.productId,
            quantity,
          },
        })
        navigate(`/customer/orders/${order.orderId}`, { replace: true })
      } catch (e) {
        if (apiErrorCode(e) === 'IDEMPOTENCY_KEY_REUSED') {
          // 같은 키로 다른 내용을 보낸 경우. 새 시도로 다시 하게 한다
          setIdempotencyKey(crypto.randomUUID())
        }
        // 그 밖의 실패(네트워크 등)는 같은 키로 다시 보내도 주문이 하나만 생긴다
        toast.error('주문하지 못했어요. 다시 시도해 주세요.')
      }
    },
  }
}
