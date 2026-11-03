/** 선착순 한도 범위. inventory-service FirstComeRequest, DB CHECK(1~999)와 같다 */
export const MIN_FIRST_COME_LIMIT = 1
export const MAX_FIRST_COME_LIMIT = 999

/** 입력칸 글자를 선착순 한도로 바꾼다. 1~999 정수가 아니면 null */
export function parseFirstComeLimit(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= MIN_FIRST_COME_LIMIT && value <= MAX_FIRST_COME_LIMIT ? value : null
}
