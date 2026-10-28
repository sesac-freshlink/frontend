import { describe, expect, it } from 'vitest'
import { isUnconfirmedSignIn, signInErrorMessage, signUpErrorMessage } from './authErrors'

function named(name: string, message = name) {
  const e = new Error(message)
  e.name = name
  return e
}

describe('signUpErrorMessage', () => {
  it('이미 있는 이메일은 가입 완료·미인증을 나누지 않고 공통 안내를 띄운다', () => {
    expect(signUpErrorMessage(named('UsernameExistsException'))).toBe(
      '이미 등록되었거나 가입이 진행 중인 이메일입니다. 로그인하거나 테스트 담당자에게 문의해 주세요.',
    )
  })

  it('인증 코드 오류', () => {
    expect(signUpErrorMessage(named('CodeMismatchException'))).toBe('인증 코드가 맞지 않아요.')
    expect(signUpErrorMessage(named('ExpiredCodeException'))).toBe(
      '인증 코드가 만료됐어요. 테스트 담당자에게 문의해 주세요.',
    )
  })

  it('모르는 오류는 기본 문구', () => {
    expect(signUpErrorMessage('x')).toBe('가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.')
  })
})

describe('signInErrorMessage', () => {
  it('비밀번호가 틀리거나 계정이 없으면 같은 문구', () => {
    expect(signInErrorMessage(named('NotAuthorizedException'))).toBe(
      '이메일 또는 비밀번호를 확인해 주세요.',
    )
    expect(signInErrorMessage(named('UserNotFoundException'))).toBe(
      '이메일 또는 비밀번호를 확인해 주세요.',
    )
  })

  it('역할이 없는 계정(예: 관리자)은 받은 문구를 그대로 보여 준다', () => {
    expect(signInErrorMessage(new Error('계정에 역할(OWNER/CUSTOMER)이 지정되지 않았습니다'))).toBe(
      '계정에 역할(OWNER/CUSTOMER)이 지정되지 않았습니다',
    )
  })
})

describe('isUnconfirmedSignIn', () => {
  it('이메일 인증 전 계정을 알아본다', () => {
    expect(isUnconfirmedSignIn(named('UserNotConfirmedException'))).toBe(true)
    expect(isUnconfirmedSignIn(new Error('추가 단계가 필요합니다: CONFIRM_SIGN_UP'))).toBe(true)
    expect(isUnconfirmedSignIn(named('NotAuthorizedException'))).toBe(false)
  })
})
