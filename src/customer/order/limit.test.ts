import { describe, expect, it } from 'vitest'
import { limitCodePoints } from './api'

describe('limitCodePoints', () => {
  it('이모지를 한 글자로 세어 자른다', () => {
    expect(limitCodePoints('🍌'.repeat(26), 50)).toBe('🍌'.repeat(26))
    expect(limitCodePoints('🍌'.repeat(51), 50)).toBe('🍌'.repeat(50))
    expect(limitCodePoints('가나다', 2)).toBe('가나')
  })
})
