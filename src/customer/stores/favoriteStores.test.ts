import { useAuthStore } from '@/shared/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FAVORITE_STORE_MAX,
  markFavoriteHintShown,
  readFavoriteStores,
  toggleFavoriteStore,
} from './favoriteStores'

const yeoksam = { storeId: 2, name: '프레시 역삼점', address: '서울 강남구 역삼로 2' }
const gangnam = { storeId: 1, name: '프레시 강남점', address: '서울 강남구 테헤란로 1' }

describe('단골 점포 (이 기기 저장)', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: { userId: 'sub-a', role: 'CUSTOMER' }, restoring: false })
  })

  it('누르면 맨 앞에 더하고, 다시 누르면 뺀다', () => {
    toggleFavoriteStore(gangnam)
    expect(toggleFavoriteStore(yeoksam)).toEqual([yeoksam, gangnam])
    expect(readFavoriteStores()).toEqual([yeoksam, gangnam])
    expect(toggleFavoriteStore(gangnam)).toEqual([yeoksam])
  })

  it(`${FAVORITE_STORE_MAX}곳을 넘으면 오래된 것부터 지운다`, () => {
    for (let i = 1; i <= FAVORITE_STORE_MAX + 1; i++) {
      toggleFavoriteStore({ storeId: i, name: `점포 ${i}`, address: '주소' })
    }
    const list = readFavoriteStores()
    expect(list).toHaveLength(FAVORITE_STORE_MAX)
    expect(list[0].storeId).toBe(FAVORITE_STORE_MAX + 1)
    expect(list.some((s) => s.storeId === 1)).toBe(false)
  })

  it('저장된 값이 깨졌거나 저장소를 못 쓰면 빈 목록으로 본다', () => {
    localStorage.setItem('freshlink.favoriteStores.sub-a', '{깨짐')
    expect(readFavoriteStores()).toEqual([])
    localStorage.setItem(
      'freshlink.favoriteStores.sub-a',
      JSON.stringify([{ storeId: '1' }, gangnam]),
    )
    expect(readFavoriteStores()).toEqual([gangnam])

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('막힘')
    })
    expect(toggleFavoriteStore(yeoksam)).toEqual([yeoksam, gangnam])
    spy.mockRestore()
  })

  it('단골 알림 표시는 처음 한 번만 true', () => {
    expect(markFavoriteHintShown()).toBe(true)
    expect(markFavoriteHintShown()).toBe(false)
  })
})
