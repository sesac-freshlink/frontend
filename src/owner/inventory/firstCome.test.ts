import { describe, expect, it } from 'vitest'
import { parseFirstComeLimit } from './firstCome'

describe('선착순 한도 입력', () => {
  it('1~999 정수만 받고 앞뒤 공백은 뺀다', () => {
    expect(parseFirstComeLimit('1')).toBe(1)
    expect(parseFirstComeLimit(' 100 ')).toBe(100)
    expect(parseFirstComeLimit('999')).toBe(999)
  })

  it('0, 1000, 소수, 음수, 빈 값은 받지 않는다', () => {
    for (const text of ['0', '1000', '1.5', '-1', '', '열']) {
      expect(parseFirstComeLimit(text)).toBeNull()
    }
  })
})
