import { describe, expect, it } from 'vitest'
import { checkCount } from './adjustment'

const lot = { quantity: 10, reservedQuantity: 3 }

describe('checkCount (S-14 실제 수량 → 증감)', () => {
  it('센 수량에서 지금 수량을 뺀 값이 증감이다', () => {
    expect(checkCount('8', lot)).toEqual({ ok: true, delta: -2 })
    expect(checkCount(' 13 ', lot)).toEqual({ ok: true, delta: 3 })
    expect(checkCount('3', lot)).toEqual({ ok: true, delta: -7 })
  })

  it('정수가 아니면 안내한다', () => {
    expect(checkCount('', lot)).toEqual({ ok: false, message: '0 이상의 정수로 넣어 주세요.' })
    expect(checkCount('-1', lot).ok).toBe(false)
    expect(checkCount('2.5', lot).ok).toBe(false)
  })

  it('지금 수량과 같으면 조정할 것이 없다', () => {
    expect(checkCount('10', lot)).toEqual({ ok: false, message: '지금 수량과 같아요.' })
  })

  it('예약 수량보다 적게는 줄일 수 없다', () => {
    expect(checkCount('2', lot)).toEqual({
      ok: false,
      message: '예약된 3개보다 적게 줄일 수 없어요.',
    })
  })

  it('한 번에 999개를 넘게 바꿀 수 없다', () => {
    expect(checkCount('1009', lot)).toEqual({ ok: true, delta: 999 })
    expect(checkCount('1010', lot)).toEqual({
      ok: false,
      message: '한 번에 999개까지 바꿀 수 있어요.',
    })
  })
})
