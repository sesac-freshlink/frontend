import axios from 'axios'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/shared/api/errors'
import { useAuthStore } from '@/shared/auth'
import type { PasswordChangeForm } from './signupSchema'

export const PASSWORD_CHANGED_MESSAGE = '비밀번호를 바꿨어요'
export const WRONG_CURRENT_PASSWORD_MESSAGE = '지금 비밀번호가 맞지 않아요'
export const INVALID_NEW_PASSWORD_MESSAGE = '비밀번호 규칙을 확인해 주세요'
export const SESSION_EXPIRED_MESSAGE = '로그인이 만료됐어요. 다시 로그인해 주세요.'

/** 비밀번호 변경 입력 칸 하나에 붙일 오류. 화면이 react-hook-form setError 로 보여 준다 */
export class PasswordFieldError extends Error {
  readonly field: 'currentPassword' | 'newPassword'

  constructor(field: 'currentPassword' | 'newPassword', message: string) {
    super(message)
    this.field = field
  }
}

/** gateway 오류를 칸 오류(PasswordFieldError) 또는 화면 문구(Error)로 바꾼다 */
export function passwordChangeError(e: unknown): Error {
  switch (apiErrorCode(e)) {
    case 'WRONG_CURRENT_PASSWORD':
      return new PasswordFieldError('currentPassword', WRONG_CURRENT_PASSWORD_MESSAGE)
    case 'INVALID_PASSWORD':
      return new PasswordFieldError('newPassword', INVALID_NEW_PASSWORD_MESSAGE)
    case 'TOO_MANY_ATTEMPTS':
    case 'TOO_MANY_REQUESTS':
      return new Error('시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.', { cause: e })
    case 'PASSWORD_LOGIN_ONLY':
      return new Error('구글로 가입한 계정은 비밀번호를 바꿀 수 없어요.', { cause: e })
    default:
      return new Error('비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.', { cause: e })
  }
}

export interface UsePasswordChangeReturn {
  /** 구글 가입 계정이면 false. 화면은 폼 대신 안내를 보여 준다 */
  passwordLogin: boolean
  /**
   * 비밀번호를 바꾼다. 성공하면 안내를 띄우고 backTo 로 간다(로그인은 그대로).
   * 지금 비밀번호가 틀렸거나 새 비밀번호가 규칙에 안 맞으면 PasswordFieldError, 그 밖의 실패는 Error 를 던진다.
   * 로그인이 만료됐으면(401) 로그아웃 상태로 바꾸고 안내만 띄운다
   */
  submit(values: PasswordChangeForm): Promise<void>
}

/** A4 비밀번호 변경 (고객·점주·관리자 공통). backTo 는 성공 뒤 돌아갈 화면 */
export function usePasswordChange(backTo: string): UsePasswordChangeReturn {
  const navigate = useNavigate()
  const passwordLogin = useAuthStore((s) => s.user?.passwordLogin !== false)
  const changePassword = useAuthStore((s) => s.changePassword)
  const expireSession = useAuthStore((s) => s.expireSession)

  return {
    passwordLogin,
    async submit({ currentPassword, newPassword }) {
      try {
        await changePassword(currentPassword, newPassword)
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          toast.error(SESSION_EXPIRED_MESSAGE)
          expireSession()
          return
        }
        throw passwordChangeError(e)
      }
      toast.success(PASSWORD_CHANGED_MESSAGE)
      navigate(backTo)
    },
  }
}
