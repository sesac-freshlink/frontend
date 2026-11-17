import { useAuthStore } from '@/shared/auth'
import { beforeEach, describe, expect, it } from 'vitest'
import { isProductShortcut, readPickupStore, savePickupStore } from './pickupStore'

describe('내 픽업 점포', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: { userId: 'sub-a', role: 'CUSTOMER' }, restoring: false })
  })

  it('저장한 점포를 다시 읽는다', () => {
    savePickupStore({ storeId: 3, name: '프레시 해운대점' })
    expect(readPickupStore()).toEqual({ storeId: 3, name: '프레시 해운대점' })
  })

  it('없거나 모양이 다르면 null', () => {
    expect(readPickupStore()).toBeNull()
    localStorage.setItem('freshlink.pickupStore', '{"storeId":"x"}')
    expect(readPickupStore()).toBeNull()
  })

  it('바로가기 값만 통과시킨다', () => {
    expect(isProductShortcut('clearance')).toBe(true)
    expect(isProductShortcut('etc')).toBe(false)
    expect(isProductShortcut(null)).toBe(false)
  })
})
