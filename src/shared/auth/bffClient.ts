import axios, { type AxiosInstance } from 'axios'
import { createApiInstance } from '@/shared/api/http'
import { isRole } from './claims'
import type { AuthClient, AuthUser, ConfirmRequest, LoginRequest } from './types'

/**
 * C-02 응답 본문(AuthUserResponse)을 검사해 AuthUser 로 바꾼다.
 * role 이 모르는 값이거나 userId 가 없으면 null. null 인 storeId·email 은 빼고(undefined) 돌려준다.
 */
export function toAuthUser(data: unknown): AuthUser | null {
  if (typeof data !== 'object' || data === null) return null
  if (!('userId' in data) || typeof data.userId !== 'string' || !data.userId) return null
  if (!('role' in data) || !isRole(data.role)) return null
  const storeId = 'storeId' in data ? data.storeId : undefined
  const email = 'email' in data ? data.email : undefined
  return {
    userId: data.userId,
    role: data.role,
    storeId:
      typeof storeId === 'string'
        ? storeId
        : typeof storeId === 'number'
          ? String(storeId)
          : undefined,
    email: typeof email === 'string' ? email : undefined,
  }
}

/**
 * C-01·C-02 gateway BFF(/api/auth/*) 로그인. 토큰은 gateway 가 HttpOnly 쿠키로 붙이고 지운다.
 * 401 갱신 interceptor 가 붙은 api 인스턴스는 쓰지 않는다 (/auth/* 는 갱신 대상이 아니다).
 * http 는 테스트에서 바꿔 끼우는 용도이고, 기본은 createApiInstance().
 */
export function createBffClient(http: AxiosInstance = createApiInstance()): AuthClient {
  /** 진행 중인 refresh. 동시에 여러 번 불러도 요청은 하나만 보낸다 */
  let inflight: Promise<AuthUser | null> | null = null

  async function postRefresh(): Promise<AuthUser | null> {
    try {
      return toAuthUser((await http.post<unknown>('/auth/refresh')).data)
    } catch (e) {
      // 401(SESSION_EXPIRED)만 세션 만료다. 429·502·네트워크 오류는 refresh 토큰이 아직 유효할 수 있어 그 오류를 그대로 던진다
      if (axios.isAxiosError(e) && e.response?.status === 401) return null
      throw e
    }
  }

  function refresh(): Promise<AuthUser | null> {
    inflight ??= postRefresh().finally(() => {
      inflight = null
    })
    return inflight
  }

  return {
    async signIn(email, password) {
      const body: LoginRequest = { email, password }
      const user = toAuthUser((await http.post<unknown>('/auth/login', body)).data)
      if (!user) {
        // gateway 가 이미 쿠키를 붙였으므로 지우고 실패한다. 로그아웃 실패는 무시한다
        await http.post('/auth/logout').catch(() => {})
        throw new Error('역할 확인 실패')
      }
      return user
    },
    async signUp({ email, password }) {
      const body: LoginRequest = { email, password }
      await http.post('/auth/signup', body)
    },
    async confirmSignUp(email, code) {
      const body: ConfirmRequest = { email, code }
      await http.post('/auth/confirm', body)
    },
    async signOut() {
      try {
        await http.post('/auth/logout')
      } catch {
        // 서버가 실패해도 화면은 로그아웃한다 (gateway 는 Cognito 실패여도 쿠키를 지운다)
      }
    },
    async restore() {
      try {
        return toAuthUser((await http.get<unknown>('/auth/me')).data)
      } catch (e) {
        // 복원은 refresh 가 어떤 이유로 실패해도 로그아웃 상태로 끝낸다
        if (axios.isAxiosError(e) && e.response?.status === 401) return refresh().catch(() => null)
        return null
      }
    },
    refresh,
  }
}
