import { describe, expect, it } from 'vitest'
import {
  imageFileError,
  OWNER_STORE_IMAGE_MAX_BYTES,
  OWNER_STORE_TEXT,
  ownerStorePatch,
} from './ownerStoreForm'

describe('imageFileError', () => {
  it('JPG·PNG 이고 5MB 이하면 통과', () => {
    expect(imageFileError({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(imageFileError({ type: 'image/png', size: OWNER_STORE_IMAGE_MAX_BYTES })).toBeNull()
  })

  it('다른 형식이면 형식 오류', () => {
    expect(imageFileError({ type: 'image/gif', size: 10 })).toBe(OWNER_STORE_TEXT.imageType)
  })

  it('5MB 를 넘으면 "5MB 이하 사진만 올릴 수 있어요"', () => {
    expect(imageFileError({ type: 'image/jpeg', size: OWNER_STORE_IMAGE_MAX_BYTES + 1 })).toBe(
      '5MB 이하 사진만 올릴 수 있어요',
    )
  })
})

describe('ownerStorePatch', () => {
  it('설명이 같으면(앞뒤 공백 무시) 보내지 않는다', () => {
    expect(ownerStorePatch({ description: '강남역 앞' }, '  강남역 앞 ')).toEqual({})
    expect(ownerStorePatch({ description: null }, '  ')).toEqual({})
  })

  it('바뀐 설명은 공백을 지워 보내고, 지우면 빈 값을 보낸다', () => {
    expect(ownerStorePatch({ description: '옛 설명' }, ' 새 설명 ')).toEqual({
      description: '새 설명',
    })
    expect(ownerStorePatch({ description: '옛 설명' }, '')).toEqual({ description: '' })
  })

  it('새 사진 키가 있으면 같이 보낸다', () => {
    expect(ownerStorePatch({ description: 'a' }, 'a', 'images/stores/1/x.jpg')).toEqual({
      imageKey: 'images/stores/1/x.jpg',
    })
  })
})
