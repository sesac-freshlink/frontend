import { describe, expect, it } from 'vitest'
import { parseSafetyStock } from './safetyStock'

describe('parseSafetyStock (S-40 입력 검사)', () => {
  it('0~999 정수를 숫자로 바꾼다', () => {
    expect(parseSafetyStock('0')).toBe(0)
    expect(parseSafetyStock('5')).toBe(5)
    expect(parseSafetyStock(' 12 ')).toBe(12)
    expect(parseSafetyStock('999')).toBe(999)
  })

  it('빈 값·음수·소수·범위 밖·글자는 null', () => {
    expect(parseSafetyStock('')).toBeNull()
    expect(parseSafetyStock('-1')).toBeNull()
    expect(parseSafetyStock('1.5')).toBeNull()
    expect(parseSafetyStock('1000')).toBeNull()
    expect(parseSafetyStock('abc')).toBeNull()
  })
})
