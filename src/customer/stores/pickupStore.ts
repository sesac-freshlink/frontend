/** 내 픽업 점포: 고객이 홈에서 마지막으로 고른 점포. 이 기기에만 남긴다(서버에 "내 점포" 값이 없다) */
export interface PickupStore {
  storeId: number
  name: string
}

const KEY = 'freshlink.pickupStore'

export function readPickupStore(): PickupStore | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (
      typeof value === 'object' &&
      value !== null &&
      'storeId' in value &&
      'name' in value &&
      typeof value.storeId === 'number' &&
      typeof value.name === 'string'
    ) {
      return { storeId: value.storeId, name: value.name }
    }
    return null
  } catch {
    return null
  }
}

export function savePickupStore(store: PickupStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // 저장이 막힌 브라우저면 이번에만 쓴다
  }
}

/** 홈 바로가기가 상품 목록에 넘기는 보기 조건(?show=) */
export type ProductShortcut = 'clearance' | 'firstCome' | 'new' | 'recommended'

export function isProductShortcut(value: string | null): value is ProductShortcut {
  return (
    value === 'clearance' || value === 'firstCome' || value === 'new' || value === 'recommended'
  )
}
