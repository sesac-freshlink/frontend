import type { AuthClient, AuthUser } from './types'

const KEY = 'freshlink.mockUser'

/**
 * Cognito 가 아직 없을 때 쓰는 개발용 가짜 로그인.
 * 이메일이 admin 으로 시작하면 관리자, owner 로 시작하면 점주(storeId 1), 아니면 고객. 비밀번호는 보지 않는다.
 */
export function createMockClient(): AuthClient {
  const load = (): AuthUser | null => {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  }

  return {
    async signIn(email) {
      const user: AuthUser = email.startsWith('admin')
        ? { userId: 'mock-admin', role: 'ADMIN', email }
        : email.startsWith('owner')
          ? { userId: 'mock-owner', role: 'OWNER', storeId: '1', email }
          : { userId: 'mock-customer', role: 'CUSTOMER', email }
      localStorage.setItem(KEY, JSON.stringify(user))
      return user
    },
    async signUp() {},
    async confirmSignUp() {},
    async signOut() {
      localStorage.removeItem(KEY)
    },
    async restore() {
      return load()
    },
    async getToken() {
      return load() ? 'mock-token' : null
    },
  }
}
