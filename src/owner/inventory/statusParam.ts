import type { InventoryStatusFilter } from './api'

/** 주소에 쓰는 순서. 재고 화면 필터 칩 순서와 같다 */
const ORDER: readonly InventoryStatusFilter[] = ['LOW_STOCK', 'IMMINENT', 'EXPIRED', 'SOLD_OUT']

/**
 * 재고 화면 주소의 status 값(쉼표로 여러 개, 예: ?status=LOW_STOCK,IMMINENT)을 필터 목록으로 읽는다.
 * 모르는 값과 겹친 값은 버리고 칩 순서로 돌려준다. 다른 화면(대시보드 카드 등)이 필터를 건 채로 보낼 때 쓴다
 */
export function parseStatuses(raw: string | null): InventoryStatusFilter[] {
  if (!raw) return []
  const given = new Set(raw.split(',').map((s) => s.trim()))
  return ORDER.filter((status) => given.has(status))
}

/** 필터 목록을 주소의 status 값으로. 비어 있으면 null(주소에서 뺀다) */
export function formatStatuses(statuses: readonly InventoryStatusFilter[]): string | null {
  const sorted = ORDER.filter((status) => statuses.includes(status))
  return sorted.length > 0 ? sorted.join(',') : null
}

/** 재고 화면 주소. 필터 없이 부르면 /owner/inventory */
export function inventoryPath(statuses: readonly InventoryStatusFilter[] = []): string {
  const value = formatStatuses(statuses)
  return value === null ? '/owner/inventory' : `/owner/inventory?status=${value}`
}
