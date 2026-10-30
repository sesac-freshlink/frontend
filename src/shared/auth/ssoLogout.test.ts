import { afterEach, describe, expect, it, vi } from 'vitest'
import { leaveForSsoLogout, saveLoginNotice, SSO_LOGOUT_PATH, takeLoginNotice } from './ssoLogout'

afterEach(() => sessionStorage.clear())

describe('ssoLogout (C-01 로그아웃 뒤 Cognito 기록 지우기)', () => {
  it('안내를 남기고 gateway 주소로 이동한다', () => {
    const assign = vi.fn()
    leaveForSsoLogout('EMAIL_SIGNUP_EXISTS', assign)
    expect(assign).toHaveBeenCalledWith('/api/auth/logout/sso')
    expect(SSO_LOGOUT_PATH).toBe('/api/auth/logout/sso')
    expect(takeLoginNotice()).toBe('EMAIL_SIGNUP_EXISTS')
  })

  it('남긴 안내는 한 번만 꺼낸다', () => {
    saveLoginNotice('EMAIL_SIGNUP_EXISTS')
    expect(takeLoginNotice()).toBe('EMAIL_SIGNUP_EXISTS')
    expect(takeLoginNotice()).toBeNull()
  })

  it('안내 없이 로그아웃하면 전에 남은 안내를 지운다', () => {
    saveLoginNotice('EMAIL_SIGNUP_EXISTS')
    leaveForSsoLogout(undefined, vi.fn())
    expect(takeLoginNotice()).toBeNull()
  })

  it('모르는 값은 안내로 쓰지 않는다', () => {
    sessionStorage.setItem('fl_login_notice', 'SOMETHING_ELSE')
    expect(takeLoginNotice()).toBeNull()
  })
})
