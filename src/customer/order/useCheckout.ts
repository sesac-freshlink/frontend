import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/auth/api'
import { useCreateOrder } from './api'
import { clampQuantity, MIN_QUANTITY, parseCheckout, type CheckoutItem } from './checkout'
import {
  canCheckout,
  changeLine,
  hasClearance,
  initialLines,
  type LineQuantities,
  linesTotal,
} from './clearance'
import { firstComeErrorMessage } from './firstCome'

/** 마감세일 함께 사기 주문 생성 거절 문구 */
const CLEARANCE_ERRORS: Record<string, string> = {
  CLEARANCE_NOT_ON_SALE: '마감세일은 06:00~23:00에만 살 수 있어요.',
  FIRST_COME_CLEARANCE_NOT_ALLOWED: '선착순 상품은 마감세일로 살 수 없어요.',
}

export interface UseCheckoutReturn {
  /** 주소에서 읽은 상품. 값이 없거나 틀리면 null */
  item: CheckoutItem | null
  quantity: number
  setQuantity(quantity: number): void
  /** 마감세일 줄이 있으면 두 줄 수량, 없으면 null (지금처럼 수량 한 줄) */
  lines: LineQuantities | null
  setLine(line: keyof LineQuantities, quantity: number): void
  /** 결제할 수 있는 수량인지 (두 줄 합계 1~5) */
  canSubmit: boolean
  /** 표시용 금액 (단가 × 수량, 마감세일이면 두 줄 합). 실제 금액은 서버가 정한다 */
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
  const [lines, setLines] = useState<LineQuantities | null>(() =>
    item && hasClearance(item) ? initialLines(item) : null,
  )
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const orderQuantity = lines ? lines.clearance + lines.regular : quantity

  return {
    item,
    quantity: orderQuantity,
    lines,
    setLine(line, next) {
      if (!item || !lines) return
      const changed = changeLine(item, lines, line, next)
      if (changed.clearance === lines.clearance && changed.regular === lines.regular) return
      setLines(changed)
      setIdempotencyKey(crypto.randomUUID())
    },
    canSubmit: lines ? canCheckout(lines) : true,
    setQuantity(next) {
      const clamped = clampQuantity(next, item?.available)
      if (clamped === quantity) return
      setQuantityState(clamped)
      setIdempotencyKey(crypto.randomUUID())
    },
    total: item && lines ? linesTotal(item, lines) : (item?.price ?? 0) * quantity,
    submitting: createOrder.isPending,

    async submit() {
      if (!item || createOrder.isPending || (lines && !canCheckout(lines))) return
      try {
        const order = await createOrder.mutateAsync({
          idempotencyKey,
          body: {
            storeId: item.storeId,
            storeName: item.storeName,
            productId: item.productId,
            quantity: orderQuantity,
            ...(lines && lines.clearance > 0 && { clearanceQuantity: lines.clearance }),
          },
        })
        navigate(`/customer/orders/${order.orderId}`, { replace: true })
      } catch (e) {
        if (apiErrorCode(e) === 'IDEMPOTENCY_KEY_REUSED') {
          // 같은 키로 다른 내용을 보낸 경우. 새 시도로 다시 하게 한다
          setIdempotencyKey(crypto.randomUUID())
        }
        // 선착순 상품: 입장권 없음·이미 주문함·수량 1개 초과는 이유를 알려 준다
        const firstCome = firstComeErrorMessage(apiErrorCode(e))
        const clearance = CLEARANCE_ERRORS[apiErrorCode(e) ?? '']
        // 그 밖의 실패(네트워크 등)는 같은 키로 다시 보내도 주문이 하나만 생긴다
        toast.error(firstCome ?? clearance ?? '주문하지 못했어요. 다시 시도해 주세요.')
      }
    },
  }
}
