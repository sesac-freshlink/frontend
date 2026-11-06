import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/auth/api'
import { useStoreProduct } from '@/customer/stores/api'
import { useCreateOrder } from './api'
import { clampQuantity, MIN_QUANTITY, parseCheckout, type CheckoutItem } from './checkout'
import {
  canCheckout,
  changeLine,
  clearanceEndedSinceSheet,
  clearanceReducedTo,
  hasClearance,
  initialLines,
  type LineQuantities,
  linesTotal,
  withLatestProduct,
} from './clearance'
import { firstComeErrorMessage } from './firstCome'

/** 마감세일 함께 사기 주문 생성 거절 문구 */
const CLEARANCE_ERRORS: Record<string, string> = {
  CLEARANCE_NOT_ON_SALE: '마감세일은 06:00~23:00에만 살 수 있어요.',
  FIRST_COME_CLEARANCE_NOT_ALLOWED: '선착순 상품은 마감세일로 살 수 없어요.',
}

export interface UseCheckoutReturn {
  /** 주소에서 읽은 상품(시트에서 왔으면 가격·남은 수는 상품 API의 최신 값). 값이 없거나 틀리면 null */
  item: CheckoutItem | null
  /** 시트에서 와서 최신 가격·남은 수를 읽는 중 */
  loadingProduct: boolean
  /** 시트에서 마감세일을 골라 왔는데 지금은 마감세일이 없다 */
  clearanceEnded: boolean
  /** 고른 마감세일 수가 남은 수보다 많아 줄였으면 그 수 */
  clearanceReducedTo: number | null
  /** 상품(마감세일 정보)을 읽지 못했다. 기본 줄만 보이고 기본 결제는 된다 */
  clearanceUnavailable: boolean
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
  const urlItem = parseCheckout(params)
  // 마감세일 시트(이태우)에서 왔으면(clearanceQuantity 가 있으면) 가격·남은 수는 상품 API(이태우 useStoreProduct)에서
  // 직접 읽는다. 시트가 주소로 넘긴 값보다 최신이다 (11/6 경우 결정)
  const fromSheet = urlItem?.clearanceQuantity !== undefined
  const product = useStoreProduct(urlItem?.storeId ?? 0, urlItem?.productId ?? 0)
  const item = urlItem && fromSheet ? withLatestProduct(urlItem, product.data) : urlItem
  const loadingProduct = fromSheet && product.isPending
  const clearanceUnavailable = fromSheet && product.isError
  const createOrder = useCreateOrder()
  const [quantityState, setQuantityState] = useState<number | null>(null)
  const [lineState, setLines] = useState<LineQuantities | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  // 상품을 읽은 뒤에 처음 수량을 정한다. 고르면 그 값을 쓴다
  const lines =
    item && !loadingProduct && hasClearance(item) ? (lineState ?? initialLines(item)) : null
  const quantity =
    quantityState ??
    (item ? clampQuantity(sheetRegularQuantity(item), item.available) : MIN_QUANTITY)
  const orderQuantity = lines ? lines.clearance + lines.regular : quantity

  return {
    item,
    loadingProduct,
    clearanceEnded:
      item !== null && !loadingProduct && !clearanceUnavailable && clearanceEndedSinceSheet(item),
    clearanceReducedTo:
      item && !loadingProduct && lineState === null ? clearanceReducedTo(item) : null,
    clearanceUnavailable,
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
      if (!item || loadingProduct || createOrder.isPending || (lines && !canCheckout(lines))) return
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

/** 한 줄 수량의 처음 값: 시트에서 고른 기본 수량(마감세일이 끝났으면 기본만), 없으면 1개 */
function sheetRegularQuantity(item: CheckoutItem): number {
  if (item.quantity === undefined) return MIN_QUANTITY
  return Math.max(MIN_QUANTITY, item.quantity - (item.clearanceQuantity ?? 0))
}
