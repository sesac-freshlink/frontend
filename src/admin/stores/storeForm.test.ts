import { describe, expect, it } from 'vitest'
import {
  buildStorePatch,
  storeDetailEditSchema,
  storeEditSchema,
  storeRegisterSchema,
} from './storeForm'

const valid = {
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
  ownerEmail: 'owner@test.com',
  initialPassword: 'Abcd!234',
}

describe('점포 입력 규칙 (A-01·A-02)', () => {
  it('점포명은 앞뒤 공백을 뺀 뒤 2~30자여야 한다', () => {
    expect(storeEditSchema.safeParse({ ...valid, name: '  가 ' }).success).toBe(false)
    expect(storeEditSchema.safeParse({ ...valid, name: '가'.repeat(31) }).success).toBe(false)
    expect(storeEditSchema.safeParse({ ...valid, name: '가'.repeat(30) }).success).toBe(true)
  })

  it('점포명 앞뒤 공백을 빼서 넘긴다', () => {
    const result = storeEditSchema.parse({ ...valid, name: '  강남점  ' })
    expect(result.name).toBe('강남점')
  })

  it('공백만 있는 주소는 거부한다', () => {
    expect(storeEditSchema.safeParse({ ...valid, address: '   ' }).success).toBe(false)
  })

  it('시도를 고르지 않으면 거부한다', () => {
    expect(storeEditSchema.safeParse({ ...valid, region: '' }).success).toBe(false)
    expect(storeEditSchema.safeParse({ ...valid, region: 'MARS' }).success).toBe(false)
  })

  it('점주 이메일 형식을 확인한다', () => {
    expect(storeRegisterSchema.safeParse({ ...valid, ownerEmail: 'owner' }).success).toBe(false)
    expect(storeRegisterSchema.safeParse(valid).success).toBe(true)
  })

  it('초기 비밀번호는 8자 이상, 대문자·소문자·숫자·특수문자를 모두 넣어야 한다', () => {
    expect(storeRegisterSchema.safeParse({ ...valid, initialPassword: 'abcd1234' }).success).toBe(
      false,
    )
    expect(storeRegisterSchema.safeParse({ ...valid, initialPassword: 'Ab!1' }).success).toBe(false)
    expect(storeRegisterSchema.safeParse({ ...valid, initialPassword: 'Abcd!234' }).success).toBe(
      true,
    )
  })
})

describe('수정 요청 본문 만들기 buildStorePatch (A-02)', () => {
  const original = {
    name: '프레시 강남점',
    address: '서울 강남구 테헤란로 1',
    region: 'SEOUL' as const,
    latitude: null,
    longitude: null,
    description: null,
  }
  /** 모달 입력 칸 값 (좌표·설명은 빈 칸) */
  const form = { name: original.name, address: original.address, region: original.region as string }

  it('바뀐 칸이 없으면 빈 객체', () => {
    expect(buildStorePatch(original, form)).toEqual({})
  })

  it('이름만 바꾸면 name 만 담는다', () => {
    expect(buildStorePatch(original, { ...form, name: '프레시 신사점' })).toEqual({
      name: '프레시 신사점',
    })
  })

  it('앞뒤 공백만 다른 이름은 바뀐 것으로 보지 않는다', () => {
    expect(buildStorePatch(original, { ...form, name: '  프레시 강남점 ' })).toEqual({})
  })

  it('시도를 바꾸면 region 만 담는다', () => {
    expect(buildStorePatch(original, { ...form, region: 'BUSAN' })).toEqual({
      region: 'BUSAN',
    })
  })

  it('시도 값이 시도 코드가 아니면 넣지 않는다', () => {
    expect(buildStorePatch(original, { ...form, region: '' })).toEqual({})
  })

  it('주소는 앞뒤 공백을 빼서 담는다', () => {
    expect(buildStorePatch(original, { ...form, address: ' 서울 강남구 2 ' })).toEqual({
      address: '서울 강남구 2',
    })
  })

  it('좌표·설명은 바뀐 것만 숫자·앞뒤 공백 뺀 글자로 담고, 빈 칸은 보내지 않는다', () => {
    const input = {
      ...form,
      latitude: '37.498095',
      longitude: ' 127.02761 ',
      description: ' 강남역 1번 출구 앞 ',
    }
    expect(buildStorePatch(original, input)).toEqual({
      latitude: 37.498095,
      longitude: 127.02761,
      description: '강남역 1번 출구 앞',
    })
    expect(
      buildStorePatch(original, { ...form, latitude: '', longitude: '', description: '  ' }),
    ).toEqual({})
    const saved = { ...original, latitude: 37.498095, longitude: 127.02761, description: '강남역' }
    expect(
      buildStorePatch(saved, {
        ...form,
        latitude: '37.498095',
        longitude: '127.02761',
        description: '강남역',
      }),
    ).toEqual({})
  })

  it('새로 올린 이미지 키가 있으면 imageKey 를 담는다', () => {
    expect(buildStorePatch(original, form, 'images/stores/1/a.jpg')).toEqual({
      imageKey: 'images/stores/1/a.jpg',
    })
  })
})

describe('점포 상세 입력 규칙 storeDetailEditSchema (A-02)', () => {
  const valid = {
    name: '프레시 강남점',
    address: '서울 강남구 테헤란로 1',
    region: 'SEOUL',
    latitude: '',
    longitude: '',
    description: '',
  }

  it('좌표는 비우거나 범위 안의 소수 6자리 이하 숫자만 받는다', () => {
    expect(storeDetailEditSchema.safeParse(valid).success).toBe(true)
    expect(storeDetailEditSchema.safeParse({ ...valid, latitude: '37.498095' }).success).toBe(true)
    expect(storeDetailEditSchema.safeParse({ ...valid, latitude: '91' }).success).toBe(false)
    expect(storeDetailEditSchema.safeParse({ ...valid, longitude: '-180.5' }).success).toBe(false)
    expect(storeDetailEditSchema.safeParse({ ...valid, latitude: '37.1234567' }).success).toBe(
      false,
    )
    expect(storeDetailEditSchema.safeParse({ ...valid, latitude: '북위 37' }).success).toBe(false)
  })

  it('설명은 500자까지', () => {
    expect(
      storeDetailEditSchema.safeParse({ ...valid, description: '가'.repeat(500) }).success,
    ).toBe(true)
    expect(
      storeDetailEditSchema.safeParse({ ...valid, description: '가'.repeat(501) }).success,
    ).toBe(false)
  })
})
