import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { clearAccountStorePrefs } from './accountStorage'
import { markFavoriteHintShown, readFavoriteStores, toggleFavoriteStore } from './favoriteStores'
import { readPickupStore, savePickupStore } from './pickupStore'

const login = (userId: string | null) =>
  useAuthStore.setState({
    user: userId ? { userId, role: 'CUSTOMER' } : null,
    restoring: false,
  })
const gangnam = { storeId: 1, name: '프레시 강남점' }
const yeoksam = { storeId: 2, name: '프레시 역삼점', address: '서울 강남구 역삼로 2' }

describe('점포 설정 계정별 저장 (11/11)', () => {
  beforeEach(() => localStorage.clear())

  it('같은 기기에서 계정 A·B 가 서로의 픽업 점포·단골을 보지 않는다', () => {
    login('sub-a')
    savePickupStore(gangnam)
    toggleFavoriteStore(yeoksam)
    expect(localStorage.getItem('freshlink.pickupStore.sub-a')).not.toBeNull()

    login('sub-b')
    expect(readPickupStore()).toBeNull()
    expect(readFavoriteStores()).toEqual([])

    login('sub-a')
    expect(readPickupStore()).toEqual(gangnam)
    expect(readFavoriteStores()).toEqual([yeoksam])
  })

  it('계정 번호 없이 남은 옛 값은 처음 읽는 계정으로 한 번 옮기고 옛 값은 지운다', () => {
    localStorage.setItem('freshlink.pickupStore', JSON.stringify(gangnam))
    localStorage.setItem('freshlink.favoriteStores', JSON.stringify([yeoksam]))
    localStorage.setItem('freshlink.favoriteHintShown', '1')

    login('sub-a')
    expect(readPickupStore()).toEqual(gangnam)
    expect(readFavoriteStores()).toEqual([yeoksam])
    expect(markFavoriteHintShown()).toBe(false)
    expect(localStorage.getItem('freshlink.pickupStore')).toBeNull()
    expect(localStorage.getItem('freshlink.favoriteStores')).toBeNull()
    expect(localStorage.getItem('freshlink.favoriteHintShown')).toBeNull()

    // 다음 계정에는 옮겨 가지 않는다
    login('sub-b')
    expect(readPickupStore()).toBeNull()
    expect(markFavoriteHintShown()).toBe(true)
  })

  it('이 계정에 이미 값이 있으면 옛 값은 덮어쓰지 않고 지우기만 한다', () => {
    login('sub-a')
    savePickupStore(gangnam)
    localStorage.setItem('freshlink.pickupStore', JSON.stringify({ storeId: 9, name: '옛 점포' }))
    expect(readPickupStore()).toEqual(gangnam)
    expect(localStorage.getItem('freshlink.pickupStore')).toBeNull()
  })

  it('로그인 전에는 읽으면 없고, 쓰지 않는다', () => {
    login(null)
    savePickupStore(gangnam)
    expect(toggleFavoriteStore(yeoksam)).toEqual([yeoksam])
    expect(readPickupStore()).toBeNull()
    expect(readFavoriteStores()).toEqual([])
    expect(markFavoriteHintShown()).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it('탈퇴한 계정 값만 지운다', () => {
    login('sub-a')
    savePickupStore(gangnam)
    toggleFavoriteStore(yeoksam)
    markFavoriteHintShown()
    login('sub-b')
    savePickupStore(gangnam)

    clearAccountStorePrefs('sub-a')
    expect(localStorage.getItem('freshlink.pickupStore.sub-a')).toBeNull()
    expect(localStorage.getItem('freshlink.favoriteStores.sub-a')).toBeNull()
    expect(localStorage.getItem('freshlink.favoriteHintShown.sub-a')).toBeNull()
    expect(localStorage.getItem('freshlink.pickupStore.sub-b')).not.toBeNull()
  })
})
