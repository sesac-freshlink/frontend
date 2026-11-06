import { describe, expect, it } from 'vitest'
import type { StoreDetail, StoreStock } from './api'
import { distanceKm, formatDistance, nearbyStores } from './nearby'

function store(
  storeId: number,
  region: StoreDetail['region'],
  lat: number | null,
  lng: number | null,
): StoreDetail {
  return {
    storeId,
    storeCode: `S${storeId}`,
    name: `점포 ${storeId}`,
    address: '주소',
    region,
    latitude: lat,
    longitude: lng,
    description: null,
    imageUrl: null,
  }
}

const stocks: StoreStock[] = [
  { storeId: 1, availableQuantity: 9, nearestExpiry: '2026-11-10T23:59:59+09:00' },
  { storeId: 2, availableQuantity: 2, nearestExpiry: '2026-11-10T23:59:59+09:00' },
  { storeId: 3, availableQuantity: 7, nearestExpiry: '2026-11-10T23:59:59+09:00' },
  { storeId: 4, availableQuantity: 5, nearestExpiry: '2026-11-10T23:59:59+09:00' },
  { storeId: 5, availableQuantity: 1, nearestExpiry: '2026-11-10T23:59:59+09:00' },
]

// 1 = 지금 점포(서울 시청 근처). 2는 가깝고 3은 멀고 4는 부산, 5는 좌표 없음
const details = new Map<number, StoreDetail>([
  [1, store(1, 'SEOUL', 37.5665, 126.978)],
  [2, store(2, 'SEOUL', 37.57, 126.98)],
  [3, store(3, 'SEOUL', 37.65, 127.05)],
  [4, store(4, 'BUSAN', 35.1796, 129.0756)],
  [5, store(5, 'SEOUL', null, null)],
])

describe('주변 점포 재고', () => {
  it('거리는 하버사인으로 km', () => {
    // 서울 시청 → 부산 시청 약 325km
    expect(
      distanceKm(
        { latitude: 37.5665, longitude: 126.978 },
        { latitude: 35.1796, longitude: 129.0756 },
      ),
    ).toBeCloseTo(325, -1)
  })

  it('내 위치를 알면 지금 점포를 빼고 가까운 순, 좌표 없는 점포는 뒤로', () => {
    const rows = nearbyStores(stocks, details, 1, { latitude: 37.5665, longitude: 126.978 })
    expect(rows.map((r) => r.storeId)).toEqual([2, 3, 4, 5])
    expect(rows[0].distanceKm).toBeLessThan(1)
    expect(rows[3].distanceKm).toBeNull()
  })

  it('위치를 모르면 지금 점포와 같은 지역만 많이 남은 순', () => {
    const rows = nearbyStores(stocks, details, 1, null)
    expect(rows.map((r) => r.storeId)).toEqual([3, 2, 5])
    expect(rows.every((r) => r.distanceKm === null)).toBe(true)
  })

  it('점포 정보를 못 읽은 점포는 빼고, 목록 모양이 아니면 빈 목록', () => {
    const partial = new Map([
      [1, details.get(1)!],
      [3, details.get(3)!],
    ])
    expect(nearbyStores(stocks, partial, 1, null).map((r) => r.storeId)).toEqual([3])
    expect(nearbyStores(undefined, details, 1, null)).toEqual([])
  })

  it('거리 표시는 1km 안이면 m, 그 밖에는 km 소수 첫째 자리', () => {
    expect(formatDistance(0.42)).toBe('400m')
    expect(formatDistance(0.01)).toBe('100m')
    expect(formatDistance(3.456)).toBe('3.5km')
  })
})
