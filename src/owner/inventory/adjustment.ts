import type { AdjustmentReason } from './api'

/** S-14 한 번에 조정할 수 있는 증감 크기. inventory-service AdjustmentRequest 와 같다 */
export const MAX_ADJUST_DELTA = 999

export const REASON_LABEL: Record<AdjustmentReason, string> = {
  COUNT: '실사',
  DAMAGE: '파손',
  LOSS: '분실',
  OTHER: '기타',
}

/** 조정할 lot 의 지금 수량. 화면이 마지막으로 읽은 값이다 */
export interface LotQuantity {
  quantity: number
  reservedQuantity: number
}

export type CountCheck = { ok: true; delta: number } | { ok: false; message: string }

/**
 * 직접 센 수량(실제 수량)을 증감으로 바꾸고 서버와 같은 규칙으로 미리 검사한다.
 * 예약이 잡은 수량 아래로는 줄일 수 없다(서버 409 BELOW_RESERVED)
 */
export function checkCount(text: string, lot: LotQuantity): CountCheck {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: '0 이상의 정수로 넣어 주세요.' }
  const counted = Number(trimmed)
  const delta = counted - lot.quantity
  if (delta === 0) return { ok: false, message: '지금 수량과 같아요.' }
  if (counted < lot.reservedQuantity) {
    return { ok: false, message: `예약된 ${lot.reservedQuantity}개보다 적게 줄일 수 없어요.` }
  }
  if (Math.abs(delta) > MAX_ADJUST_DELTA) {
    return { ok: false, message: `한 번에 ${MAX_ADJUST_DELTA}개까지 바꿀 수 있어요.` }
  }
  return { ok: true, delta }
}
