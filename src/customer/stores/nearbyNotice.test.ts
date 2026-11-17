import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StoreSummary } from './api'
import { distanceKm } from './nearby'
import {
  closerStore,
  dismissNearbyNotice,
  FAR_PICKUP_KM,
  isNearbyNoticeDismissed,
  regionOf,
  withSubject,
  withTo,
  withTopic,
} from './nearbyNotice'

const store = (storeId: number, name: string, latitude: number | null, longitude: number | null) =>
  ({
    storeId,
    storeCode: `S${storeId}`,
    name,
    address: '',
    region: 'SEOUL',
    latitude,
    longitude,
  }) as StoreSummary

const gangnam = store(1, '프레시 강남점', 37.498095, 127.02761)
const haeundae = store(10, '프레시 해운대점', 35.1631, 129.1636)
const seomyeon = store(11, '프레시 서면점', 35.1578, 129.0592)
const busanUser = { latitude: 35.1588, longitude: 129.1603 }

describe('더 가까운 점포 안내 계산 (11/14)', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('지금 위치의 시·도를 대표 좌표로 고른다', () => {
    expect(regionOf(busanUser)).toBe('BUSAN')
    expect(regionOf({ latitude: 37.4979, longitude: 127.0276 })).toBe('SEOUL')
    expect(regionOf({ latitude: 33.45, longitude: 126.57 })).toBe('JEJU')
  })

  it('픽업 점포가 10km 넘게 멀고 더 가까운 점포가 있으면 그 점포와 거리를 준다', () => {
    const result = closerStore(busanUser, gangnam, [haeundae, seomyeon])
    expect(result?.nearest.name).toBe('프레시 해운대점')
    expect(result?.farKm).toBeGreaterThan(300)
    expect(result?.nearestKm).toBeLessThan(1)
  })

  it('10km 이하면 안내하지 않는다(경계 포함)', () => {
    // 강남점에서 정확히 북쪽으로 10km 안팎인 두 지점
    const near = { latitude: gangnam.latitude! + 0.0899, longitude: gangnam.longitude! }
    const far = { latitude: gangnam.latitude! + 0.0905, longitude: gangnam.longitude! }
    expect(distanceKm(near, gangnam as never)).toBeLessThanOrEqual(FAR_PICKUP_KM)
    expect(
      closerStore(near, gangnam, [store(2, '가까운점', near.latitude, near.longitude)]),
    ).toBeNull()
    expect(distanceKm(far, gangnam as never)).toBeGreaterThan(FAR_PICKUP_KM)
    expect(
      closerStore(far, gangnam, [store(2, '가까운점', far.latitude, far.longitude)]),
    ).not.toBeNull()
  })

  it('위치·좌표를 모르거나 더 가까운 점포가 없으면 안내하지 않는다', () => {
    expect(closerStore(null, gangnam, [haeundae])).toBeNull()
    expect(closerStore(busanUser, store(1, '좌표없음', null, null), [haeundae])).toBeNull()
    expect(closerStore(busanUser, gangnam, [])).toBeNull()
    expect(closerStore(busanUser, gangnam, [gangnam])).toBeNull()
  })

  it('[그대로 두기]는 이번 접속 동안만 기억하고, 저장소를 못 쓰면 오류 없이 넘어간다', () => {
    expect(isNearbyNoticeDismissed()).toBe(false)
    dismissNearbyNotice()
    expect(isNearbyNoticeDismissed()).toBe(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(isNearbyNoticeDismissed()).toBe(false)
    expect(() => dismissNearbyNotice()).not.toThrow()
  })

  it('점포 이름 끝 글자에 맞게 조사를 붙인다', () => {
    expect(withTopic('프레시 노원점')).toBe('프레시 노원점은')
    expect(withTopic('프레시 서초')).toBe('프레시 서초는')
    expect(withSubject('프레시 해운대점', '(800m)')).toBe('프레시 해운대점(800m)이')
    expect(withTo('프레시 해운대점')).toBe('프레시 해운대점으로')
    expect(withTo('프레시 서울')).toBe('프레시 서울로')
    expect(withTo('프레시 마포')).toBe('프레시 마포로')
  })
})
