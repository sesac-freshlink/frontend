import { describe, expect, it } from 'vitest'
import type { StoreSummary } from './api'
import { favoriteRows, groupOverlapping, nearRows, pinLabel, recentRows } from './storeSearchTabs'

const store = (
  storeId: number,
  name: string,
  latitude: number | null,
  longitude: number | null,
): StoreSummary => ({
  storeId,
  storeCode: `S${storeId}`,
  name,
  address: `서울 ${storeId}`,
  region: 'SEOUL',
  latitude,
  longitude,
})

const gangnam = store(1, '프레시 강남점', 37.498095, 127.02761)
const yeoksam = store(2, '프레시 역삼점', 37.500622, 127.036456)
const samsung = store(5, '프레시 삼성점', 37.508844, 127.06316)
const noCoord = store(9, '프레시 가나점', null, null)
const here = { latitude: 37.5007, longitude: 127.0365 } // 역삼역 근처

describe('점포 검색 탭 목록 (U-01 지도형)', () => {
  it('가까운순: 내 위치를 알면 거리순, 좌표가 없는 점포는 뒤로', () => {
    const rows = nearRows([gangnam, noCoord, samsung, yeoksam], here)
    expect(rows.map((r) => r.name)).toEqual([
      '프레시 역삼점',
      '프레시 강남점',
      '프레시 삼성점',
      '프레시 가나점',
    ])
    expect(rows[0].distanceKm).toBeLessThan(0.1)
    expect(rows[3].distanceKm).toBeNull()
  })

  it('가까운순: 위치를 모르면 서버 순서(점포명순) 그대로, 거리는 없다', () => {
    const rows = nearRows([gangnam, yeoksam], null)
    expect(rows.map((r) => r.storeId)).toEqual([1, 2])
    expect(rows.every((r) => r.distanceKm === null)).toBe(true)
  })

  it('최근 주문: 주문 내역 순서대로 점포를 한 번씩, 지금 지역 목록에 없는 점포는 뺀다', () => {
    const rows = recentRows(
      ['프레시 역삼점', '프레시 해운대점', '프레시 역삼점', '프레시 강남점'],
      [gangnam, yeoksam],
      null,
    )
    expect(rows.map((r) => r.name)).toEqual(['프레시 역삼점', '프레시 강남점'])
  })

  it('단골: 표시한 순서대로, 다른 지역 점포는 남겨 둔 이름·주소만(핀·거리 없음)', () => {
    const rows = favoriteRows(
      [
        { storeId: 3, name: '프레시 해운대점', address: '부산 해운대구' },
        { storeId: 2, name: '프레시 역삼점', address: '옛 주소' },
      ],
      [gangnam, yeoksam],
      here,
    )
    expect(rows[0]).toEqual({
      storeId: 3,
      name: '프레시 해운대점',
      address: '부산 해운대구',
      latitude: null,
      longitude: null,
      distanceKm: null,
    })
    // 지금 목록에 있으면 서버 값(주소·좌표)을 쓴다
    expect(rows[1].address).toBe('서울 2')
    expect(rows[1].distanceKm).not.toBeNull()
  })

  it('핀 이름은 앞의 "프레시 "를 뺀다', () => {
    expect(pinLabel('프레시 역삼점')).toBe('역삼점')
    expect(pinLabel('역삼 프레시점')).toBe('역삼 프레시점')
  })
})

describe('겹치는 핀 묶기', () => {
  const pin = (storeId: number) => ({ storeId })
  it('화면에서 가로 72px·세로 36px 안이면 묶고, 고른 점포는 묶지 않는다', () => {
    const items = [
      { item: pin(1), x: 0, y: 0 },
      { item: pin(2), x: 50, y: 10 },
      { item: pin(3), x: 200, y: 0 },
      { item: pin(4), x: 10, y: 5 },
    ]
    expect(groupOverlapping(items, null).map((g) => g.map((p) => p.storeId))).toEqual([
      [1, 2, 4],
      [3],
    ])
    expect(groupOverlapping(items, 2).map((g) => g.map((p) => p.storeId))).toEqual([
      [1, 4],
      [2],
      [3],
    ])
  })
})
