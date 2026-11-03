import { describe, expect, it } from 'vitest'
import { createApiInstance, CSRF_HEADER, isAuthPath } from './http'

describe('createApiInstance', () => {
  it('상대 경로 /api 와 CSRF 헤더를 기본으로 쓰고 Authorization 은 없다', () => {
    const http = createApiInstance()
    expect(http.defaults.baseURL).toBe('/api')
    expect(http.defaults.headers['X-Requested-With']).toBe('freshlink')
    expect(http.defaults.headers.Authorization).toBeUndefined()
    expect(CSRF_HEADER).toEqual({ 'X-Requested-With': 'freshlink' })
  })
})

describe('isAuthPath', () => {
  it('BFF 로그인 경로 여섯 개는 401 갱신 대상에서 뺀다', () => {
    for (const path of ['login', 'signup', 'confirm', 'refresh', 'logout', 'me']) {
      expect(isAuthPath(`/auth/${path}`)).toBe(true)
    }
  })

  it('/api 가 붙은 경로나 앞 슬래시 없는 경로도 알아본다', () => {
    expect(isAuthPath('/api/auth/refresh')).toBe(true)
    expect(isAuthPath('auth/login')).toBe(true)
  })

  it('보호 API 와 auth 로 시작하는 다른 이름은 갱신 대상이다', () => {
    expect(isAuthPath('/owner/inventory')).toBe(false)
    expect(isAuthPath('/members/me')).toBe(false)
    expect(isAuthPath('/authors')).toBe(false)
    expect(isAuthPath(undefined)).toBe(false)
    expect(isAuthPath('')).toBe(false)
  })
})
