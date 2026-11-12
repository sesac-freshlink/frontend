import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/shared/api/errors'
import { fetchPendingOrder, type Order, useCreateOrder } from './api'
import type { PendingOrderDialogProps } from './components/PendingOrderDialog'
import { firstComeErrorMessage } from './firstCome'
import { cancelBeforePayment } from './refund'

/** 앞 주문 결제 전 취소가 안 됐을 때 (결제 처리 중 등). 새 주문은 만들지 않는다 */
export const PENDING_CANCEL_FAILED_MESSAGE = '잠시 후 다시 시도해 주세요.'

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
  /** 선착순 상품이면 결제하지 않은 주문 안내 창에서 [새로 주문하기]를 뺀다 */
  firstCome?: boolean
}

export interface UseBuyNowReturn {
  /** 주문을 만들고 결제 대기 화면(/customer/orders/:id)으로 간다. 실패하면 이유를 토스트로 알리고 false */
  buy(request: BuyNowRequest, options?: { replace?: boolean }): Promise<boolean>
  pending: boolean
  /** 결제하지 않은 주문 안내 창에 넘길 값. 있으면 부르는 화면이 <PendingOrderDialog {...pendingDialog} /> 로 그린다 */
  pendingDialog: PendingOrderDialogProps | null
}

/** 안내 창을 띄운 동안 기억해 둘 것: 찾은 주문, 다시 누른 구매 내용, 결과를 돌려줄 곳 */
interface Guard {
  order: Order
  receivedAtMs: number
  request: BuyNowRequest
  replace: boolean
  resolve(ok: boolean): void
}

/**
 * U-10 상품 상세 [N원 구매하기]·선착순 입장 때 주문을 만든다 (OR-01). 주문·결제 화면(U-21 /customer/orders/new)을
 * 거치지 않고 바로 결제 대기 화면으로 간다 (11/11 경우 결정).
 * Idempotency-Key 는 구매 시도마다 하나: 같은 내용의 재시도는 같은 키, 수량을 바꾸면 새 키.
 * 만들기 전에 같은 점포·같은 상품의 결제 대기 주문이 있으면 안내 창으로 묻는다(11/12, 수량은 보지 않는다).
 * 결제 대기 주문을 찾지 못하면(조회 실패 포함) 지금처럼 바로 만든다
 */
export function useBuyNow(): UseBuyNowReturn {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createOrder = useCreateOrder()
  const attempt = useRef<{ key: string; body: string } | null>(null)

  const inFlight = useRef(false)
  const { mutateAsync } = createOrder
  const [guard, setGuard] = useState<Guard | null>(null)
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const create = useCallback(
    async (request: BuyNowRequest, replace: boolean): Promise<boolean> => {
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
        navigate(`/customer/orders/${order.orderId}`, { replace })
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
      }
    },
    [mutateAsync, navigate, queryClient],
  )

  const buy = useCallback<UseBuyNowReturn['buy']>(
    async (request, options) => {
      // 주문을 만드는 동안·안내 창이 떠 있는 동안 다시 눌러도 한 번만 처리한다
      if (inFlight.current) return false
      inFlight.current = true
      const replace = options?.replace ?? false
      setChecking(true)
      let found: Awaited<ReturnType<typeof fetchPendingOrder>> = null
      try {
        found = await fetchPendingOrder(request.storeId, request.storeName, request.productId)
      } catch {
        // 확인을 못 하면 막지 않고 지금처럼 만든다(겹친 주문은 10분 뒤 서버가 만료시킨다)
        found = null
      } finally {
        setChecking(false)
      }
      if (!found) {
        try {
          return await create(request, replace)
        } finally {
          inFlight.current = false
        }
      }
      const { order, receivedAtMs } = found
      // 안내 창은 모달이라 뒤의 [구매하기]를 다시 누를 수 없다. 여기서 풀어 두고 창 안 버튼으로만 이어 간다
      inFlight.current = false
      // 고객이 버튼을 고를 때까지 기다렸다가 결과(화면을 옮겼는지)를 돌려준다
      return new Promise<boolean>((resolve) => {
        setGuard({
          order,
          receivedAtMs,
          request,
          replace,
          resolve: (ok) => {
            setGuard(null)
            resolve(ok)
          },
        })
      })
    },
    [create],
  )

  const onContinue = () => {
    if (!guard) return
    navigate(`/customer/orders/${guard.order.orderId}`, { replace: guard.replace })
    guard.resolve(true)
  }

  // 앞 주문 결제 전 취소 → 성공하면 새 주문. 이벤트에서만 부른다(useCallback 이라 그리는 중에는 실행되지 않는다)
  const onNewOrder = useCallback(async () => {
    if (!guard) return
    setCancelling(true)
    try {
      await cancelBeforePayment(guard.order.orderId)
    } catch (e) {
      // 이미 만료된 주문이면 재고가 돌아갔으니 그대로 새 주문을 만든다. 그 밖(결제 처리 중 등)은 만들지 않는다
      if (apiErrorCode(e) !== 'ORDER_EXPIRED') {
        setCancelling(false)
        toast.error(PENDING_CANCEL_FAILED_MESSAGE)
        guard.resolve(false)
        return
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['customer', 'orders'] })
      void queryClient.invalidateQueries({ queryKey: ['customer', 'order', guard.order.orderId] })
    }
    const ok = await create(guard.request, guard.replace)
    setCancelling(false)
    guard.resolve(ok)
  }, [guard, create, queryClient])

  const pendingDialog: PendingOrderDialogProps | null = guard
    ? {
        order: guard.order,
        receivedAtMs: guard.receivedAtMs,
        allowNewOrder: !guard.request.firstCome,
        pending: cancelling,
        onContinue,
        onNewOrder: () => void onNewOrder(),
        onClose: () => guard.resolve(false),
      }
    : null

  return { buy, pending: createOrder.isPending || checking || cancelling, pendingDialog }
}
