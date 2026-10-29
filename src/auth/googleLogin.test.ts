import { afterEach, describe, expect, it, vi } from 'vitest'
import { GOOGLE_LOGIN_PATH, goToGoogleLogin } from './googleLogin'

afterEach(() => vi.unstubAllGlobals())

describe('goToGoogleLogin (C-02 구글)', () => {
  it('axios 가 아니라 전체 페이지 이동으로 /api/auth/google 에 간다', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    goToGoogleLogin()
    expect(assign).toHaveBeenCalledWith('/api/auth/google')
    expect(GOOGLE_LOGIN_PATH).toBe('/api/auth/google')
  })
})
