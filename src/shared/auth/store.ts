import { create } from 'zustand'
import { createBffClient } from './bffClient'
import type { AuthClient, AuthUser, LoginNotice, SignUpInput } from './types'

/** 로그인은 항상 gateway BFF 로 한다. 개발 서버의 가짜 로그인은 MSW 가 /api/auth/* 를 흉내 낸다 */
export const authClient: AuthClient = createBffClient()

interface AuthState {
  user: AuthUser | null
  /** 앱 시작 시 저장된 세션을 확인하는 중이면 true */
  restoring: boolean
  /** 로그인 화면에 고정으로 띄울 안내. 로그인에 성공하면 지운다 */
  loginNotice: LoginNotice | null
  restore(): Promise<void>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(input: SignUpInput): Promise<void>
  confirmSignUp(email: string, code: string): Promise<void>
  /** notice 를 주면 로그인 화면이 그 안내를 띄운다 */
  signOut(notice?: LoginNotice): Promise<void>
  /**
   * 401 갱신 (api interceptor 전용). 성공이면 user 를 응답으로 바꾸고(역할·점포 반영) true.
   * 세션 만료(refresh 401)면 false, 그 밖의 갱신 실패는 reject (user 는 그대로)
   */
  refreshSession(): Promise<boolean>
  /** 세션 만료. user 가 있었을 때만 비우고 로그아웃 요청을 보낸 뒤 true. 이미 없으면 false */
  expireSession(): boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  restoring: true,
  loginNotice: null,
  async restore() {
    const user = await authClient.restore()
    set({ user, restoring: false })
  },
  async signIn(email, password) {
    const user = await authClient.signIn(email, password)
    set({ user, loginNotice: null })
    return user
  },
  signUp: (input) => authClient.signUp(input),
  confirmSignUp: (email, code) => authClient.confirmSignUp(email, code),
  async signOut(notice) {
    await authClient.signOut()
    set({ user: null, loginNotice: notice ?? null })
  },
  async refreshSession() {
    const user = await authClient.refresh()
    if (!user) return false
    set({ user })
    return true
  },
  expireSession() {
    if (!get().user) return false
    set({ user: null })
    // 남은 쿠키를 지운다. 결과는 기다리지 않는다 (signOut 은 실패해도 resolve)
    void authClient.signOut()
    return true
  },
}))
