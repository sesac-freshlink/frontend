import { create } from 'zustand'
import { createCognitoClient } from './cognitoClient'
import { createMockClient } from './mockClient'
import type { AuthClient, AuthUser, SignUpInput } from './types'

const { VITE_COGNITO_USER_POOL_ID: poolId, VITE_COGNITO_CLIENT_ID: clientId } = import.meta.env

export const authClient: AuthClient =
  poolId && clientId ? createCognitoClient(poolId, clientId) : createMockClient()

export const isMockAuth = !(poolId && clientId)

interface AuthState {
  user: AuthUser | null
  /** 앱 시작 시 저장된 세션을 확인하는 중이면 true */
  restoring: boolean
  restore(): Promise<void>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(input: SignUpInput): Promise<void>
  signOut(): Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  restoring: true,
  async restore() {
    const user = await authClient.restore()
    set({ user, restoring: false })
  },
  async signIn(email, password) {
    const user = await authClient.signIn(email, password)
    set({ user })
    return user
  },
  signUp: (input) => authClient.signUp(input),
  async signOut() {
    await authClient.signOut()
    set({ user: null })
  },
}))
