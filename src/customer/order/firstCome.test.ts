import { describe, expect, it } from 'vitest'
import { firstComeErrorMessage } from './firstCome'

describe('선착순 오류 문구', () => {
  it('order-service 선착순 오류 코드마다 이유를 알려 준다', () => {
    expect(firstComeErrorMessage('FIRST_COME_TICKET_REQUIRED')).toContain('차례가 오면')
    expect(firstComeErrorMessage('FIRST_COME_ALREADY_ORDERED')).toContain('1개만')
    expect(firstComeErrorMessage('FIRST_COME_QUANTITY_LIMIT')).toContain('1개만')
    expect(firstComeErrorMessage('FIRST_COME_UNAVAILABLE')).toContain('잠시 후')
  })

  it('선착순과 상관없는 코드는 null (화면이 원래 문구를 쓴다)', () => {
    expect(firstComeErrorMessage('IDEMPOTENCY_KEY_REUSED')).toBeNull()
    expect(firstComeErrorMessage(undefined)).toBeNull()
  })
})
