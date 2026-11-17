import { readAccountItem, writeAccountItem } from './accountStorage'

/** 내 픽업 점포: 고객이 [픽업 점포로 정하기]로 마지막으로 고른 점포. 서버에 "내 점포" 값이 없어 이 기기에, 계정마다 따로 남긴다(accountStorage) */
export interface PickupStore {
  storeId: number
  name: string
}

export function readPickupStore(): PickupStore | null {
  try {
    const raw = readAccountItem('freshlink.pickupStore')
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
  writeAccountItem('freshlink.pickupStore', JSON.stringify(store))
}

/** 홈 바로가기가 상품 목록에 넘기는 보기 조건(?show=) */
export type ProductShortcut = 'clearance' | 'firstCome' | 'new' | 'recommended'

export function isProductShortcut(value: string | null): value is ProductShortcut {
  return (
    value === 'clearance' || value === 'firstCome' || value === 'new' || value === 'recommended'
  )
}
