import { describe, expect, it } from 'vitest'
import {
  EMAIL_SIGNUP_EXISTS_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  GOOGLE_LOGIN_FAILED_MESSAGE,
  isCodeMismatch,
  isUnconfirmedSignIn,
  loginNoticeMessage,
  signInErrorMessage,
  signUpErrorMessage,
} from './authErrors'

/** gateway 오류 응답 {code, message, traceId} 를 받은 axios 오류 */
function apiError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code, traceId: null } },
  })
}

/** 서버 응답을 못 받은 axios 오류 (네트워크) */
const networkError = Object.assign(new Error('Network Error'), { isAxiosError: true })

describe('signUpErrorMessage', () => {
  it('이미 있는 이메일은 가입 완료·미인증을 나누지 않고 공통 안내를 띄운다', () => {
    expect(signUpErrorMessage(apiError(409, 'EMAIL_ALREADY_EXISTS'))).toBe(EMAIL_TAKEN_MESSAGE)
  })

  it('비밀번호 규칙', () => {
    expect(signUpErrorMessage(apiError(400, 'INVALID_PASSWORD'))).toBe(
      '비밀번호 규칙을 확인해 주세요.',
    )
  })

  it('인증 코드 오류', () => {
    expect(signUpErrorMessage(apiError(400, 'CODE_MISMATCH'))).toBe('인증 코드가 맞지 않아요.')
    expect(signUpErrorMessage(apiError(400, 'CODE_EXPIRED'))).toBe(
      '인증 코드가 만료됐어요. 테스트 담당자에게 문의해 주세요.',
    )
  })

  it('요청이 너무 많으면', () => {
    expect(signUpErrorMessage(apiError(429, 'TOO_MANY_REQUESTS'))).toBe(
      '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
    )
  })

  it('모르는 오류는 기본 문구', () => {
    expect(signUpErrorMessage('x')).toBe('가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.')
    expect(signUpErrorMessage(apiError(400, 'INVALID_REQUEST'))).toBe(
      '가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.',
    )
  })
})

describe('signInErrorMessage', () => {
  it('비밀번호가 틀리거나 계정이 없으면 같은 문구', () => {
    expect(signInErrorMessage(apiError(401, 'INVALID_CREDENTIALS'))).toBe(
      '이메일 또는 비밀번호를 확인해 주세요.',
    )
  })

  it('역할이 없는 계정', () => {
    expect(signInErrorMessage(apiError(403, 'NO_ROLE'))).toBe(
      '계정에 역할이 지정되지 않았어요. 테스트 담당자에게 문의해 주세요.',
    )
  })

  it('추가 단계·비밀번호 재설정이 필요한 계정', () => {
    const message = '이 계정은 지금 로그인할 수 없어요. 테스트 담당자에게 문의해 주세요.'
    expect(signInErrorMessage(apiError(403, 'CHALLENGE_REQUIRED'))).toBe(message)
    expect(signInErrorMessage(apiError(403, 'PASSWORD_RESET_REQUIRED'))).toBe(message)
  })

  it('요청이 너무 많으면', () => {
    expect(signInErrorMessage(apiError(429, 'TOO_MANY_REQUESTS'))).toBe(
      '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
    )
  })

  it('인증 서버 장애·네트워크 오류는 잠시 뒤 다시', () => {
    const message = '로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
    expect(signInErrorMessage(apiError(502, 'AUTH_UNAVAILABLE'))).toBe(message)
    expect(signInErrorMessage(networkError)).toBe(message)
  })

  it('모르는 오류는 기본 문구', () => {
    expect(signInErrorMessage(apiError(400, 'INVALID_REQUEST'))).toBe('로그인에 실패했어요.')
    expect(signInErrorMessage(new Error('역할 확인 실패'))).toBe('로그인에 실패했어요.')
  })
})

describe('isUnconfirmedSignIn', () => {
  it('이메일 인증 전 계정을 알아본다', () => {
    expect(isUnconfirmedSignIn(apiError(403, 'USER_NOT_CONFIRMED'))).toBe(true)
    expect(isUnconfirmedSignIn(apiError(401, 'INVALID_CREDENTIALS'))).toBe(false)
    expect(isUnconfirmedSignIn(new Error('x'))).toBe(false)
  })
})

describe('isCodeMismatch', () => {
  it('인증 코드가 틀린 오류만 true', () => {
    expect(isCodeMismatch(apiError(400, 'CODE_MISMATCH'))).toBe(true)
    expect(isCodeMismatch(apiError(400, 'CODE_EXPIRED'))).toBe(false)
  })
})

describe('loginNoticeMessage', () => {
  it('구글 로그인 실패(?error=google)가 먼저', () => {
    expect(loginNoticeMessage('google', 'EMAIL_SIGNUP_EXISTS')).toBe(GOOGLE_LOGIN_FAILED_MESSAGE)
  })

  it('이메일 가입자 막기 안내', () => {
    expect(loginNoticeMessage(null, 'EMAIL_SIGNUP_EXISTS')).toBe(EMAIL_SIGNUP_EXISTS_MESSAGE)
  })

  it('안내가 없으면 undefined', () => {
    expect(loginNoticeMessage(null, null)).toBeUndefined()
    expect(loginNoticeMessage('other', null)).toBeUndefined()
  })
})
