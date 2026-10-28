/** S-40 안전재고 상한. inventory-service SafetyStock.MAX_QUANTITY, DB CHECK 제약과 같다 */
export const MAX_SAFETY_STOCK = 999

/** 입력칸 글자를 안전재고로 바꾼다. 0~999 정수가 아니면 null */
export function parseSafetyStock(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value <= MAX_SAFETY_STOCK ? value : null
}
