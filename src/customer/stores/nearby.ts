import type { StorePlace, StoreStock } from './api'

/** 근처 점포 재고에서 보여 줄 점포 수 */
export const NEARBY_STORE_COUNT = 5

export interface LatLng {
  latitude: number
  longitude: number
}

export interface NearbyStore {
  storeId: number
  name: string
  availableQuantity: number
  /** 내 위치에서 km. 위치를 모르거나 점포 좌표가 없으면 null */
  distanceKm: number | null
}

/** 두 지점의 거리(km, 하버사인). 점포 사이 거리 정도라 지구를 구로 본다 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * 주변 점포 재고 목록을 만든다. 지금 보는 점포는 뺀다.
 * - 내 위치를 알면 거리순(좌표가 없는 점포는 뒤로).
 * - 위치를 모르면(권한 거부 등) 지금 점포와 같은 지역 점포만, 많이 남은 순.
 * 점포 정보(이름·지역·좌표)를 아직 못 읽은 점포는 뺀다
 */
export function nearbyStores(
  stocks: StoreStock[] | undefined,
  details: ReadonlyMap<number, StorePlace>,
  currentStoreId: number,
  origin: LatLng | null,
  count: number = NEARBY_STORE_COUNT,
): NearbyStore[] {
  if (!Array.isArray(stocks)) return []
  const current = details.get(currentStoreId)
  const rows = stocks
    .filter((s) => s.storeId !== currentStoreId && details.has(s.storeId))
    .map((s) => {
      const d = details.get(s.storeId)!
      const hasCoords = d.latitude !== null && d.longitude !== null
      return {
        store: d,
        row: {
          storeId: s.storeId,
          name: d.name,
          availableQuantity: s.availableQuantity,
          distanceKm:
            origin && hasCoords
              ? distanceKm(origin, { latitude: d.latitude!, longitude: d.longitude! })
              : null,
        },
      }
    })
  if (origin) {
    return rows
      .map((r) => r.row)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, count)
  }
  return rows
    .filter((r) => current === undefined || r.store.region === current.region)
    .map((r) => r.row)
    .sort((a, b) => b.availableQuantity - a.availableQuantity)
    .slice(0, count)
}

/** 거리 표시: 1km 안이면 m(100m 단위), 그 밖에는 km 소수 첫째 자리 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)}m`
  return `${km.toFixed(1)}km`
}
