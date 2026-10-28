import { describe, expect, it } from 'vitest'
import { regionName, storeErrorMessage } from './storeText'

const FALLBACK = '일반 실패'

function axiosError(status: number, data: unknown) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data },
  })
}

describe('시도 이름 regionName', () => {
  it('시도 코드를 한글 이름으로 바꾼다', () => {
    expect(regionName('SEOUL')).toBe('서울특별시')
    expect(regionName('JEJU')).toBe('제주특별자치도')
  })

  it('모르는 값이면 그대로 보여 준다', () => {
    expect(regionName('MARS')).toBe('MARS')
  })
})

describe('서버 오류 문구 storeErrorMessage', () => {
  it.each([
    [409, 'STORE_NAME_DUPLICATED', '이미 있는 점포명입니다'],
    [409, 'OWNER_EMAIL_DUPLICATED', '이미 등록된 이메일입니다'],
    [500, 'STORE_REGISTRATION_FAILED', '점포 등록에 실패했습니다. 다시 시도해 주세요'],
    [409, 'STORE_NOT_EDITABLE', '등록 중인 점포는 수정할 수 없습니다'],
    [404, 'STORE_NOT_FOUND', '점포가 없습니다'],
    [403, 'FORBIDDEN', '권한이 없습니다'],
  ])('%i %s → 고정 문구', (status, code, text) => {
    const e = axiosError(status, { code, message: '서버 문구', traceId: 't' })
    expect(storeErrorMessage(e, FALLBACK)).toBe(text)
  })

  it('입력 검증 오류는 서버 message 를 보여 준다', () => {
    const e = axiosError(400, { code: 'VALIDATION_ERROR', message: '점포명은 2~30자입니다' })
    expect(storeErrorMessage(e, FALLBACK)).toBe('점포명은 2~30자입니다')
  })

  it('입력 검증 오류에 message 가 없으면 일반 문구', () => {
    expect(storeErrorMessage(axiosError(400, { code: 'VALIDATION_ERROR' }), FALLBACK)).toBe(
      FALLBACK,
    )
    expect(
      storeErrorMessage(axiosError(400, { code: 'VALIDATION_ERROR', message: '' }), FALLBACK),
    ).toBe(FALLBACK)
  })

  it('모르는 코드·코드 없는 응답·axios 가 아닌 오류는 일반 문구', () => {
    expect(storeErrorMessage(axiosError(500, { code: 'SOMETHING' }), FALLBACK)).toBe(FALLBACK)
    expect(storeErrorMessage(axiosError(502, 'Bad Gateway'), FALLBACK)).toBe(FALLBACK)
    expect(storeErrorMessage(new Error('network'), FALLBACK)).toBe(FALLBACK)
  })
})
