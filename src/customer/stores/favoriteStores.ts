import { readAccountItem, writeAccountItem } from './accountStorage'

/**
 * 단골 점포: 고객이 점포 검색에서 ♥로 표시한 점포. 서버에 "단골" 값이 없어 이 기기에, 계정마다 따로 남긴다(11/11 경우 결정, accountStorage).
 * 다른 지역 점포도 목록에 보이게 이름·주소를 같이 남긴다
 */
export interface FavoriteStore {
  storeId: number
  name: string
  address: string
}

/** 한 기기에 남기는 단골 점포 수. 넘으면 오래된 것부터 지운다 */
export const FAVORITE_STORE_MAX = 30

function isFavoriteStore(value: unknown): value is FavoriteStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'storeId' in value &&
    'name' in value &&
    'address' in value &&
    typeof value.storeId === 'number' &&
    typeof value.name === 'string' &&
    typeof value.address === 'string'
  )
}

/** 남긴 단골 점포. 최근에 표시한 것이 앞. 읽지 못하면 빈 목록 */
export function readFavoriteStores(): FavoriteStore[] {
  try {
    const raw = readAccountItem('freshlink.favoriteStores')
    if (raw === null) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter(isFavoriteStore) : []
  } catch {
    return []
  }
}

function saveFavoriteStores(list: FavoriteStore[]) {
  writeAccountItem('freshlink.favoriteStores', JSON.stringify(list))
}

/** 단골이면 빼고, 아니면 맨 앞에 더한다. 바뀐 목록을 돌려준다 */
export function toggleFavoriteStore(store: FavoriteStore): FavoriteStore[] {
  const current = readFavoriteStores()
  const next = current.some((s) => s.storeId === store.storeId)
    ? current.filter((s) => s.storeId !== store.storeId)
    : [store, ...current].slice(0, FAVORITE_STORE_MAX)
  saveFavoriteStores(next)
  return next
}

/**
 * 단골 알림(토스트)을 이 기기·이 계정에서 처음 한 번만 띄우려고 표시를 남긴다.
 * 처음이면 true(이제 띄운다), 이미 띄웠으면 false. 로그인 전이거나 저장소를 못 쓰면 false 로 본다(시끄럽지 않게)
 */
export function markFavoriteHintShown(): boolean {
  if (readAccountItem('freshlink.favoriteHintShown') !== null) return false
  writeAccountItem('freshlink.favoriteHintShown', '1')
  return readAccountItem('freshlink.favoriteHintShown') !== null
}
