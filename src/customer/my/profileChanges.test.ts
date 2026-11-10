import { describe, expect, it } from 'vitest'
import { hasChanges, needsNicknameCheck, profileChanges } from './profileChanges'

const current = { name: '김경우', nickname: 'Fresh01', region: 'SEOUL' as const }

describe('profileChanges (MB-04 바뀐 칸 고르기)', () => {
  it('아무것도 안 바뀌면 빈 객체', () => {
    const changes = profileChanges(current, { ...current })
    expect(changes).toEqual({})
    expect(hasChanges(changes)).toBe(false)
  })

  it('이름만 바꾸면 이름만', () => {
    expect(profileChanges(current, { ...current, name: '이태우' })).toEqual({ name: '이태우' })
  })

  it('앞뒤 공백만 다른 이름·닉네임은 안 바뀐 것으로 본다', () => {
    expect(
      profileChanges(current, { ...current, name: ' 김경우 ', nickname: ' Fresh01 ' }),
    ).toEqual({})
  })

  it('세 칸을 모두 바꾸면 세 칸 모두, 공백은 지운 값', () => {
    expect(
      profileChanges(current, { name: ' 이태우 ', nickname: 'Fresh02', region: 'BUSAN' }),
    ).toEqual({
      name: '이태우',
      nickname: 'Fresh02',
      region: 'BUSAN',
    })
  })
})

describe('needsNicknameCheck (MB-01 을 부를지)', () => {
  it('닉네임을 안 바꾸면 부르지 않는다', () => {
    expect(needsNicknameCheck(current, { name: '이태우' })).toBe(false)
  })

  it('대소문자만 바꾼 내 닉네임은 부르지 않는다', () => {
    expect(needsNicknameCheck(current, { nickname: 'FRESH01' })).toBe(false)
  })

  it('다른 닉네임으로 바꾸면 부른다', () => {
    expect(needsNicknameCheck(current, { nickname: 'Fresh02' })).toBe(true)
  })
})
