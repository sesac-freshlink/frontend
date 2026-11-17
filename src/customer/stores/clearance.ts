import { MAX_QUANTITY } from '@/customer/order/checkout'
import type { StoreProduct } from './api'

type ClearanceFields = Pick<
  StoreProduct,
  'availableQuantity' | 'firstCome' | 'clearanceQuantity' | 'clearancePrice'
>

/** 마감세일 할인율(%). inventory ClearancePolicy 와 같다. 화면 문구에만 쓰고 금액은 서버가 준 clearancePrice 를 쓴다 */
export const CLEARANCE_DISCOUNT_PERCENT = 30

/** 마감세일 수량·단가. 선착순이거나 수량이 0이거나 서버가 아직 주지 않으면 null */
export function clearanceOf(product: ClearanceFields): { quantity: number; price: number } | null {
  const quantity = product.clearanceQuantity ?? 0
  const price = product.clearancePrice ?? null
  if (product.firstCome || quantity <= 0 || price === null) return null
  return { quantity, price }
}

/** 구매 시트에서 고른 수량. normal = 기본(정가), clearance = 마감세일 */
export interface SheetSelection {
  normal: number
  clearance: number
}

export type SheetRow = keyof SheetSelection

/** 처음 고른 수량: 마감세일 1개(남아 있으면), 아니면 기본 1개 */
export function initialSelection(product: ClearanceFields): SheetSelection {
  if (clearanceOf(product)) return { normal: 0, clearance: 1 }
  return { normal: product.availableQuantity > 0 ? 1 : 0, clearance: 0 }
}

export function selectionTotal(selection: SheetSelection): number {
  return selection.normal + selection.clearance
}

/** 그 줄의 남은 수량 */
function rowLimit(product: ClearanceFields, row: SheetRow): number {
  return row === 'normal' ? product.availableQuantity : (clearanceOf(product)?.quantity ?? 0)
}

/** 한 개 더 고를 수 있는지. 두 줄 합계는 1~MAX_QUANTITY, 줄마다 남은 수량까지 */
export function canIncrease(
  product: ClearanceFields,
  selection: SheetSelection,
  row: SheetRow,
): boolean {
  return selectionTotal(selection) < MAX_QUANTITY && selection[row] < rowLimit(product, row)
}

/** 한 개 뺄 수 있는지. 한 줄만 사도 되지만 합계가 0이 되면 안 된다 */
export function canDecrease(selection: SheetSelection, row: SheetRow): boolean {
  return selection[row] > 0 && selectionTotal(selection) > 1
}

/** 표시용 합계 금액. 실제 금액은 주문 때 서버가 정한다 */
export function selectionAmount(
  product: ClearanceFields & Pick<StoreProduct, 'price'>,
  selection: SheetSelection,
): number {
  const clearancePrice = clearanceOf(product)?.price ?? 0
  return product.price * selection.normal + clearancePrice * selection.clearance
}
