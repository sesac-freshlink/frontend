import { describe, expect, it } from 'vitest'
import { homePathFor, isRole } from './claims'

describe('isRole', () => {
  it('ADMIN·OWNER·CUSTOMER 만 역할로 본다', () => {
    expect(isRole('ADMIN')).toBe(true)
    expect(isRole('OWNER')).toBe(true)
    expect(isRole('CUSTOMER')).toBe(true)
    expect(isRole('SOMETHING')).toBe(false)
    expect(isRole('owner')).toBe(false)
    expect(isRole(undefined)).toBe(false)
    expect(isRole(1)).toBe(false)
  })
})

describe('homePathFor', () => {
  it('역할별 홈', () => {
    expect(homePathFor('OWNER')).toBe('/owner/inventory')
    expect(homePathFor('CUSTOMER')).toBe('/customer')
    expect(homePathFor('ADMIN')).toBe('/admin/stores')
  })
})
