import { describe, expect, it } from 'vitest'
import { homePathFor, userFromClaims } from './claims'

describe('userFromClaims', () => {
  it('점주는 그룹에서 역할을, custom:storeId 에서 점포를 꺼낸다', () => {
    expect(
      userFromClaims({
        sub: 'u-1',
        email: 'owner@test.com',
        'cognito:groups': ['OWNER'],
        'custom:storeId': '7',
      }),
    ).toEqual({ userId: 'u-1', role: 'OWNER', storeId: '7', email: 'owner@test.com' })
  })

  it('고객은 점포가 없다', () => {
    expect(userFromClaims({ sub: 'u-2', 'cognito:groups': ['CUSTOMER'] })).toMatchObject({
      role: 'CUSTOMER',
      storeId: undefined,
    })
  })

  it('역할 그룹이 없으면 null', () => {
    expect(userFromClaims({ sub: 'u-3' })).toBeNull()
    expect(userFromClaims({ sub: 'u-3', 'cognito:groups': ['ADMIN'] })).toBeNull()
  })
})

describe('homePathFor', () => {
  it('역할별 홈', () => {
    expect(homePathFor('OWNER')).toBe('/owner/inventory')
    expect(homePathFor('CUSTOMER')).toBe('/customer')
  })
})
