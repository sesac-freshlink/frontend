import { describe, expect, it } from 'vitest'
import type { StoreProduct, StoreSummary } from './api'
import {
  categoryPhotos,
  clearanceRow,
  HOME_ROW_LIMIT,
  homeRow,
  isClearanceProduct,
  nearestStores,
  remainingText,
  storeDistance,
} from './homeRows'

function product(over: Partial<StoreProduct> & { productId: number }): StoreProduct {
  return {
    name: `상품${over.productId}`,
    category: '김밥',
    price: 1000,
    imageUrl: null,
    availableQuantity: 5,
    soldOut: false,
    recommended: false,
    newArrival: false,
    firstCome: false,
    nearestExpiry: null,
    ...over,
  }
}

const sale = (id: number, expiry: string, name?: string) =>
  product({
    productId: id,
    name: name ?? `상품${id}`,
    clearanceQuantity: 2,
    clearancePrice: 700,
    clearanceExpiry: expiry,
  })

describe('isClearanceProduct', () => {
  it('마감세일 수량과 단가가 있으면 참', () => {
    expect(isClearanceProduct(sale(1, '2026-11-11T23:59:59+09:00'))).toBe(true)
  })
  it('선착순·수량 0·값 없음은 거짓', () => {
    expect(isClearanceProduct({ ...sale(1, '2026-11-11T23:59:59+09:00'), firstCome: true })).toBe(
      false,
    )
    expect(
      isClearanceProduct({ ...sale(1, '2026-11-11T23:59:59+09:00'), clearanceQuantity: 0 }),
    ).toBe(false)
    expect(isClearanceProduct(product({ productId: 2 }))).toBe(false)
  })
})

describe('clearanceRow', () => {
  it('마감세일만, 마감 빠른 순, 같으면 이름순', () => {
    const rows = clearanceRow([
      product({ productId: 9 }),
      sale(1, '2026-11-11T23:00:00+09:00', '나'),
      sale(2, '2026-11-11T20:00:00+09:00'),
      sale(3, '2026-11-11T23:00:00+09:00', '가'),
    ])
    expect(rows.map((p) => p.productId)).toEqual([2, 3, 1])
  })
  it(`최대 ${HOME_ROW_LIMIT}개`, () => {
    const many = Array.from({ length: 14 }, (_, i) => sale(i + 1, '2026-11-11T23:00:00+09:00'))
    expect(clearanceRow(many)).toHaveLength(HOME_ROW_LIMIT)
  })
})

describe('homeRow', () => {
  it('품절은 뒤로, 최대 개수까지', () => {
    const rows = homeRow([
      product({ productId: 1, soldOut: true }),
      product({ productId: 2 }),
      ...Array.from({ length: 12 }, (_, i) => product({ productId: 10 + i })),
    ])
    expect(rows).toHaveLength(HOME_ROW_LIMIT)
    expect(rows[0].productId).toBe(2)
    expect(rows.some((p) => p.productId === 1)).toBe(false)
  })
})

describe('categoryPhotos', () => {
  it('분류마다 사진이 있는 첫 상품, 없으면 null', () => {
    const photos = categoryPhotos([
      product({ productId: 1, category: '김밥', imageUrl: null }),
      product({ productId: 2, category: '김밥', imageUrl: '/a.png' }),
      product({ productId: 3, category: '김밥', imageUrl: '/b.png' }),
      product({ productId: 4, category: '음료', imageUrl: '/c.png' }),
    ])
    expect(photos['김밥']).toBe('/a.png')
    expect(photos['도시락']).toBeNull()
    expect(Object.keys(photos)).not.toContain('음료')
  })
})

const store = (id: number, lat: number | null, lng: number | null): StoreSummary => ({
  storeId: id,
  storeCode: `S${id}`,
  name: `점포${id}`,
  address: '서울',
  region: 'SEOUL',
  latitude: lat,
  longitude: lng,
})

describe('nearestStores', () => {
  const origin = { latitude: 37.498, longitude: 127.027 }
  it('좌표 있는 점포만 가까운 순으로 3곳', () => {
    const rows = nearestStores(
      [
        store(1, 37.6, 127.1),
        store(2, 37.498, 127.028),
        store(3, null, null),
        store(4, 37.51, 127.03),
        store(5, 37.55, 127.05),
      ],
      origin,
    )
    expect(rows.map((r) => r.store.storeId)).toEqual([2, 4, 5])
  })
  it('좌표 칸이 없는 옛 응답도 뺀다', () => {
    const old: StoreSummary = {
      storeId: 9,
      storeCode: 'S9',
      name: '옛',
      address: '',
      region: 'SEOUL',
    }
    expect(nearestStores([old], origin)).toEqual([])
    expect(storeDistance(old, origin)).toBeNull()
  })
})

describe('remainingText', () => {
  const now = new Date('2026-11-11T10:00:00+09:00').getTime()
  it('시간·분', () => {
    expect(remainingText('2026-11-11T13:12:30+09:00', now)).toBe('3시간 12분 남음')
    expect(remainingText('2026-11-11T12:00:00+09:00', now)).toBe('2시간 남음')
    expect(remainingText('2026-11-11T10:45:00+09:00', now)).toBe('45분 남음')
  })
  it('지났거나 1분 안이면 곧 마감, 값이 없으면 null', () => {
    expect(remainingText('2026-11-11T10:00:30+09:00', now)).toBe('곧 마감')
    expect(remainingText('2026-11-11T09:00:00+09:00', now)).toBe('곧 마감')
    expect(remainingText(null, now)).toBeNull()
  })
})
