import { describe, expect, it } from 'vitest'
import { memoAction } from './memo'

describe('memoAction', () => {
  it('내용이 있으면 저장한다', () => {
    expect(memoAction('냉장 2칸', false)).toBe('save')
    expect(memoAction('  다음 주 입고 늘리기 ', true)).toBe('save')
  })

  it('있던 메모를 다 지우고 저장하면 삭제한다', () => {
    expect(memoAction('', true)).toBe('delete')
    expect(memoAction('   \n ', true)).toBe('delete')
  })

  it('메모가 없는데 빈 채로 저장하면 아무것도 하지 않는다', () => {
    expect(memoAction('', false)).toBe('none')
  })
})
