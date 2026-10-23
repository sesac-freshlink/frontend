import { describe, expect, it } from 'vitest'
import { buildStorePatch, storeEditSchema, storeRegisterSchema } from './storeForm'

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
  }

  it('바뀐 칸이 없으면 빈 객체', () => {
    expect(buildStorePatch(original, original)).toEqual({})
  })

  it('이름만 바꾸면 name 만 담는다', () => {
    expect(buildStorePatch(original, { ...original, name: '프레시 신사점' })).toEqual({
      name: '프레시 신사점',
    })
  })

  it('앞뒤 공백만 다른 이름은 바뀐 것으로 보지 않는다', () => {
    expect(buildStorePatch(original, { ...original, name: '  프레시 강남점 ' })).toEqual({})
  })

  it('시도를 바꾸면 region 만 담는다', () => {
    expect(buildStorePatch(original, { ...original, region: 'BUSAN' })).toEqual({
      region: 'BUSAN',
    })
  })

  it('시도 값이 시도 코드가 아니면 넣지 않는다', () => {
    expect(buildStorePatch(original, { ...original, region: '' })).toEqual({})
  })

  it('주소는 앞뒤 공백을 빼서 담는다', () => {
    expect(buildStorePatch(original, { ...original, address: ' 서울 강남구 2 ' })).toEqual({
      address: '서울 강남구 2',
    })
  })
})
