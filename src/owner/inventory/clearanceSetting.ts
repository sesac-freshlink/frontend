/** 마감세일 할인율 범위(%). inventory-service ClearanceSetting, DB CHECK 제약과 같다 */
export const MIN_CLEARANCE_DISCOUNT = 1
export const MAX_CLEARANCE_DISCOUNT = 95

/** 판매 시작 시(0~23)와 끝 시(1~24, 24 = 자정) 고르기 칸 */
export const SALE_START_HOURS = Array.from({ length: 24 }, (_, i) => i)
export const SALE_END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1)

/** 입력칸 글자를 할인율로 바꾼다. 1~95 정수가 아니면 null */
export function parseDiscountPercent(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= MIN_CLEARANCE_DISCOUNT && value <= MAX_CLEARANCE_DISCOUNT ? value : null
}

/** 판매 시간이 맞는지. 시작이 끝보다 빨라야 한다(같으면 파는 시간이 없다) */
export function validSaleHours(start: number, end: number): boolean {
  return start < end
}

/** 시 표시. 24는 자정이라 "24시"로 그대로 쓴다 */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}시`
}
