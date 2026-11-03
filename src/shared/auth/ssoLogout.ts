import type { LoginNotice } from './types'

/**
 * 로그아웃 뒤 Cognito 로그인 도메인의 로그인 기록까지 지우는 gateway 주소.
 * gateway 가 Cognito /logout 으로 보내고 Cognito 는 화면 /login 으로 돌려보낸다.
 * 이 기록이 남아 있으면 다음 구글 로그인이 계정 선택 없이 직전 계정으로 바로 된다 (BFF 인수인계 6장 7)
 */
export const SSO_LOGOUT_PATH = '/api/auth/logout/sso'

const NOTICE_KEY = 'fl_login_notice'
const NOTICES: readonly LoginNotice[] = ['EMAIL_SIGNUP_EXISTS']

function isLoginNotice(value: unknown): value is LoginNotice {
  return NOTICES.some((n) => n === value)
}

/** Cognito 를 다녀오면 화면 상태가 사라지므로 로그인 화면 안내를 sessionStorage 에 잠깐 둔다 */
export function saveLoginNotice(notice: LoginNotice | undefined): void {
  try {
    if (notice) sessionStorage.setItem(NOTICE_KEY, notice)
    else sessionStorage.removeItem(NOTICE_KEY)
  } catch {
    // 저장소를 못 쓰면 안내만 빠진다
  }
}

/** 저장해 둔 안내를 한 번만 꺼낸다 (꺼내면 지운다) */
export function takeLoginNotice(): LoginNotice | null {
  try {
    const value = sessionStorage.getItem(NOTICE_KEY)
    sessionStorage.removeItem(NOTICE_KEY)
    return isLoginNotice(value) ? value : null
  } catch {
    return null
  }
}

/** 안내를 남기고 Cognito 로그인 기록을 지우러 이동한다. assign 은 테스트에서 바꿔 끼운다 */
export function leaveForSsoLogout(
  notice: LoginNotice | undefined,
  assign: (url: string) => void = (url) => window.location.assign(url),
): void {
  saveLoginNotice(notice)
  assign(SSO_LOGOUT_PATH)
}
