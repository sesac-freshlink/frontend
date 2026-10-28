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
    expect(userFromClaims({ sub: 'u-3', 'cognito:groups': [] })).toBeNull()
    expect(userFromClaims({ sub: 'u-3', 'cognito:groups': ['SOMETHING'] })).toBeNull()
  })

  it('관리자는 ADMIN 그룹에서 역할을 꺼내고 점포가 없다', () => {
    expect(
      userFromClaims({ sub: 'u-4', email: 'admin@test.com', 'cognito:groups': ['ADMIN'] }),
    ).toEqual({ userId: 'u-4', role: 'ADMIN', storeId: undefined, email: 'admin@test.com' })
  })

  it('그룹이 여러 개면 ADMIN > OWNER > CUSTOMER 순으로 고른다', () => {
    expect(userFromClaims({ sub: 'u-5', 'cognito:groups': ['CUSTOMER', 'OWNER'] })?.role).toBe(
      'OWNER',
    )
    expect(userFromClaims({ sub: 'u-5', 'cognito:groups': ['OWNER', 'ADMIN'] })?.role).toBe('ADMIN')
  })
})

describe('homePathFor', () => {
  it('역할별 홈', () => {
    expect(homePathFor('OWNER')).toBe('/owner/inventory')
    expect(homePathFor('CUSTOMER')).toBe('/customer')
    expect(homePathFor('ADMIN')).toBe('/admin/stores')
  })
})
