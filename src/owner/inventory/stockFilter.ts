import type { InventoryItem, InventoryStatusFilter } from './api'

/** 검색어가 글 안에 있는지(앞뒤 빈칸·대소문자 무시). 빈 검색어는 모두 맞음 */
export function matchesText(text: string, q: string): boolean {
  const needle = q.trim().toLowerCase()
  return needle === '' || text.toLowerCase().includes(needle)
}

/** 상태 정렬 순서: 품절 → 부족 → 판매중 */
export function statusRank(item: InventoryItem): number {
  if (item.availableQuantity === 0) return 0
  if (item.lowStock) return 1
  return 2
}

/** 재고 목록의 품절·부족 칩과 같은 뜻. 고른 게 없으면 모두 맞음, 재고를 모르면(아직 못 읽음) 고른 게 있을 때 뺀다 */
export function matchesStock(
  item: InventoryItem | undefined,
  statuses: readonly InventoryStatusFilter[],
): boolean {
  if (statuses.length === 0) return true
  if (!item) return false
  const rank = statusRank(item)
  return (
    (statuses.includes('SOLD_OUT') && rank === 0) || (statuses.includes('LOW_STOCK') && rank === 1)
  )
}
