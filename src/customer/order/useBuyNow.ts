import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/shared/api/errors'
import { useCreateOrder } from './api'
import { firstComeErrorMessage } from './firstCome'

/** 마감세일 함께 사기 주문 생성 거절 문구 */
const CLEARANCE_ERRORS: Record<string, string> = {
  CLEARANCE_NOT_ON_SALE: '마감세일은 06:00~23:00에만 살 수 있어요.',
  FIRST_COME_CLEARANCE_NOT_ALLOWED: '선착순 상품은 마감세일로 살 수 없어요.',
}

/** 바로 주문할 상품과 수량. quantity 는 전체(마감세일 포함), clearanceQuantity 는 그중 마감세일 */
export interface BuyNowRequest {
  storeId: number
  storeName: string
  productId: number
  quantity: number
  clearanceQuantity?: number
}

export interface UseBuyNowReturn {
  /** 주문을 만들고 결제 대기 화면(/customer/orders/:id)으로 간다. 실패하면 이유를 토스트로 알리고 false */
  buy(request: BuyNowRequest, options?: { replace?: boolean }): Promise<boolean>
  pending: boolean
}

/**
 * U-10 상품 상세 [N원 구매하기]·선착순 입장 때 주문을 만든다 (OR-01). 주문·결제 화면(U-21 /customer/orders/new)을
 * 거치지 않고 바로 결제 대기 화면으로 간다 (11/11 경우 결정).
 * Idempotency-Key 는 구매 시도마다 하나: 같은 내용의 재시도는 같은 키, 수량을 바꾸면 새 키
 */
export function useBuyNow(): UseBuyNowReturn {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createOrder = useCreateOrder()
  const attempt = useRef<{ key: string; body: string } | null>(null)

  const inFlight = useRef(false)
  const { mutateAsync } = createOrder

  const buy = useCallback<UseBuyNowReturn['buy']>(
    async (request, options) => {
      // 주문을 만드는 동안 다시 눌러도 한 번만 보낸다
      if (inFlight.current) return false
      inFlight.current = true
      const body = {
        storeId: request.storeId,
        storeName: request.storeName,
        productId: request.productId,
        quantity: request.quantity,
        ...(request.clearanceQuantity !== undefined &&
          request.clearanceQuantity > 0 && { clearanceQuantity: request.clearanceQuantity }),
      }
      const signature = JSON.stringify(body)
      if (attempt.current?.body !== signature) {
        attempt.current = { key: crypto.randomUUID(), body: signature }
      }
      const idempotencyKey = attempt.current.key
      try {
        const order = await mutateAsync({ idempotencyKey, body })
        attempt.current = null
        navigate(`/customer/orders/${order.orderId}`, { replace: options?.replace ?? false })
        return true
      } catch (e) {
        const code = apiErrorCode(e)
        // 같은 키로 다른 내용을 보낸 경우. 다음 시도는 새 키로 한다
        if (code === 'IDEMPOTENCY_KEY_REUSED') attempt.current = null
        // 남은 수량·마감세일 여부가 바뀌었을 수 있어 상품을 다시 읽는다
        void queryClient.invalidateQueries({
          queryKey: ['customer', 'stores', request.storeId, 'product', request.productId],
        })
        // 그 밖의 실패(네트워크 등)는 같은 키로 다시 보내도 주문이 하나만 생긴다
        toast.error(
          firstComeErrorMessage(code) ??
            CLEARANCE_ERRORS[code ?? ''] ??
            '주문하지 못했어요. 다시 시도해 주세요.',
        )
        return false
      } finally {
        inFlight.current = false
      }
    },
    [mutateAsync, navigate, queryClient],
  )

  return { buy, pending: createOrder.isPending }
}
