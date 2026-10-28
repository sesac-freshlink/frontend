import { useEffect, useRef, useState } from 'react'
import type { InventoryItem } from './api'

/** 바뀐 행을 강조해 두는 시간 */
export const HIGHLIGHT_MS = 2_000

/**
 * 직전 응답과 비교해 수량이 바뀐 상품 ID.
 * 새로 나타난 상품은 비교할 이전 값이 없으므로 넣지 않는다
 */
export function changedProductIds(prev: InventoryItem[], next: InventoryItem[]): number[] {
  const before = new Map(prev.map((item) => [item.productId, item]))
  return next
    .filter((item) => {
      const old = before.get(item.productId)
      if (!old) return false
      return (
        old.totalQuantity !== item.totalQuantity ||
        old.reservedQuantity !== item.reservedQuantity ||
        old.availableQuantity !== item.availableQuantity
      )
    })
    .map((item) => item.productId)
}

export interface InventoryChangesReturn {
  /** 지금 강조 중인 상품 ID */
  changedIds: ReadonlySet<number>
}

/** S-15 폴링으로 숫자가 바뀐 행을 잠깐 강조한다. 서버 데이터는 복사하지 않고 비교용 이전 값만 둔다 */
export function useInventoryChanges(items: InventoryItem[] | undefined): InventoryChangesReturn {
  const prevRef = useRef<InventoryItem[] | undefined>(undefined)
  const [changedIds, setChangedIds] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    if (!items) return
    const prev = prevRef.current
    prevRef.current = items
    if (!prev) return

    const ids = changedProductIds(prev, items)
    if (ids.length === 0) return

    setChangedIds((current) => new Set([...current, ...ids]))
    const timer = setTimeout(() => {
      setChangedIds((current) => {
        const rest = new Set(current)
        for (const id of ids) rest.delete(id)
        return rest
      })
    }, HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [items])

  return { changedIds }
}
