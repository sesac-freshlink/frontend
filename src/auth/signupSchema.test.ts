import { describe, expect, it } from 'vitest'
import { profileSchema, signupSchema } from './signupSchema'

const valid = {
  email: 'kim@test.com',
  password: 'Abcd123!',
  passwordConfirm: 'Abcd123!',
  name: '김경우',
  nickname: 'Fresh01',
  region: 'SEOUL',
}

function errorPaths(input: unknown) {
  const result = signupSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('signupSchema', () => {
  it('규칙을 지키면 통과하고 이름 앞뒤 공백을 지운다', () => {
    const result = signupSchema.parse({ ...valid, name: '  김경우 ' })
    expect(result.name).toBe('김경우')
  })

  it('비밀번호는 8자 이상, 대문자·소문자·숫자·특수문자를 모두 넣어야 한다', () => {
    for (const password of [
      'Abc12!',
      'abcd123!',
      'ABCD123!',
      'Abcdefg!',
      'Abcd1234',
      'Abcd123가',
    ]) {
      expect(errorPaths({ ...valid, password, passwordConfirm: password })).toContain('password')
    }
  })

  it('비밀번호 확인이 다르면 막는다', () => {
    expect(errorPaths({ ...valid, passwordConfirm: 'Abcd123@' })).toEqual(['passwordConfirm'])
  })

  it('닉네임은 2~10자 한글·영문·숫자만', () => {
    expect(errorPaths({ ...valid, nickname: 'a' })).toEqual(['nickname'])
    expect(errorPaths({ ...valid, nickname: 'abcdefghijk' })).toEqual(['nickname'])
    expect(errorPaths({ ...valid, nickname: 'fresh 01' })).toEqual(['nickname'])
    expect(errorPaths({ ...valid, nickname: 'fresh_01' })).toEqual(['nickname'])
    expect(errorPaths({ ...valid, nickname: '신선해요' })).toEqual([])
  })

  it('이름은 앞뒤 공백을 빼고 2~30자 한글·영문·공백만', () => {
    expect(errorPaths({ ...valid, name: ' 김 ' })).toEqual(['name'])
    expect(errorPaths({ ...valid, name: 'Kim1' })).toEqual(['name'])
    expect(errorPaths({ ...valid, name: 'Kim Kyung' })).toEqual([])
  })

  it('지역은 시·도 코드 중 하나', () => {
    expect(errorPaths({ ...valid, region: 'TOKYO' })).toEqual(['region'])
  })
})

describe('profileSchema', () => {
  it('이메일·비밀번호 없이 이름·닉네임·지역만 본다', () => {
    expect(
      profileSchema.safeParse({ name: '김경우', nickname: 'Fresh01', region: 'BUSAN' }).success,
    ).toBe(true)
  })
})
