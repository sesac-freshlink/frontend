import { describe, expect, it } from 'vitest'
import { productLabel } from './productLabel'

const base = {
  name: '매운 컵라면 115g',
  price: 1700,
  availableQuantity: 3,
  soldOut: false,
  recommended: false,
  newArrival: false,
  firstCome: false,
  nearestExpiry: null,
}

describe('상품 줄 읽기 이름', () => {
  it('상품명, 가격, 남은 수량 순으로 읽는다', () => {
    expect(productLabel(base)).toBe('매운 컵라면 115g, 1,700원, 3개 남음')
  })

  it('품절이면 남은 수량 대신 품절, 배지는 뒤에 붙인다', () => {
    // 한국 시간 2026-10-25 22:00
    const now = new Date('2026-10-25T13:00:00Z')
    expect(
      productLabel(
        {
          ...base,
          recommended: true,
          newArrival: true,
          firstCome: true,
          nearestExpiry: '2026-10-25T23:59:59+09:00',
        },
        now,
      ),
    ).toBe('매운 컵라면 115g, 1,700원, 3개 남음, 소비기한 오늘까지, 추천, 신상품, 선착순')
    expect(productLabel({ ...base, soldOut: true, availableQuantity: 0 })).toBe(
      '매운 컵라면 115g, 1,700원, 품절',
    )
  })
})
