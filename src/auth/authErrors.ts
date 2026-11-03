import axios from 'axios'
import { apiErrorCode } from '@/shared/api/errors'
import type { LoginNotice } from '@/shared/auth'

/**
 * C-01·C-02 gateway BFF 오류 본문 {code, message, traceId} 의 code 를 화면 문구로 바꾼다.
 * 문구는 member-service 기능명세 M1·M2 를 따른다.
 */
export const EMAIL_TAKEN_MESSAGE =
  '이미 등록되었거나 가입이 진행 중인 이메일입니다. 로그인하거나 테스트 담당자에게 문의해 주세요.'

export const GOOGLE_LOGIN_FAILED_MESSAGE = '구글 로그인에 실패했어요. 다시 시도해 주세요.'

export const EMAIL_SIGNUP_EXISTS_MESSAGE =
  '이미 이메일로 가입한 계정이 있어요. 이메일로 로그인해 주세요.'

const TOO_MANY_REQUESTS_MESSAGE = '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'

/** 서버 응답을 못 받았는지 (네트워크 오류) */
function isNoResponse(e: unknown): boolean {
  return axios.isAxiosError(e) && !e.response
}

export function signUpErrorMessage(e: unknown): string {
  switch (apiErrorCode(e)) {
    case 'EMAIL_ALREADY_EXISTS':
      return EMAIL_TAKEN_MESSAGE
    case 'INVALID_PASSWORD':
      return '비밀번호 규칙을 확인해 주세요.'
    case 'CODE_MISMATCH':
      return '인증 코드가 맞지 않아요.'
    case 'CODE_EXPIRED':
      return '인증 코드가 만료됐어요. 테스트 담당자에게 문의해 주세요.'
    case 'TOO_MANY_REQUESTS':
      return TOO_MANY_REQUESTS_MESSAGE
    default:
      return '가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
  }
}

export function signInErrorMessage(e: unknown): string {
  switch (apiErrorCode(e)) {
    case 'INVALID_CREDENTIALS':
      return '이메일 또는 비밀번호를 확인해 주세요.'
    case 'NO_ROLE':
      return '계정에 역할이 지정되지 않았어요. 테스트 담당자에게 문의해 주세요.'
    case 'CHALLENGE_REQUIRED':
    case 'PASSWORD_RESET_REQUIRED':
      return '이 계정은 지금 로그인할 수 없어요. 테스트 담당자에게 문의해 주세요.'
    case 'TOO_MANY_REQUESTS':
      return TOO_MANY_REQUESTS_MESSAGE
    case 'AUTH_UNAVAILABLE':
      return '로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
    default:
      return isNoResponse(e)
        ? '로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
        : '로그인에 실패했어요.'
  }
}

/** 가입은 했지만 이메일 인증을 안 한 계정으로 로그인했는지 */
export function isUnconfirmedSignIn(e: unknown): boolean {
  return apiErrorCode(e) === 'USER_NOT_CONFIRMED'
}

/** 인증 코드가 틀렸는지 (코드 칸에 알린다) */
export function isCodeMismatch(e: unknown): boolean {
  return apiErrorCode(e) === 'CODE_MISMATCH'
}

/** 로그인 화면 고정 안내. 구글 로그인 실패(?error=google)가 먼저, 없으면 store 안내 */
export function loginNoticeMessage(
  errorParam: string | null,
  notice: LoginNotice | null,
): string | undefined {
  if (errorParam === 'google') return GOOGLE_LOGIN_FAILED_MESSAGE
  if (notice === 'EMAIL_SIGNUP_EXISTS') return EMAIL_SIGNUP_EXISTS_MESSAGE
  return undefined
}
