import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ mock: false }))
const leave = vi.hoisted(() => vi.fn())

vi.mock('@/shared/api/mockMode', () => ({
  get isMockApi() {
    return mode.mock
  },
}))
vi.mock('./ssoLogout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ssoLogout')>()),
  leaveForSsoLogout: leave,
}))

const { authClient, useAuthStore } = await import('./store')

beforeEach(() => {
  useAuthStore.setState({
    user: { userId: 'sub-c', role: 'CUSTOMER' },
    restoring: false,
    loginNotice: null,
  })
  vi.spyOn(authClient, 'signOut').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  leave.mockClear()
})

describe('useAuthStore 로그아웃 뒤 Cognito 기록 지우기 (C-01)', () => {
  it('실제 gateway 에서 구글 고객은 쿠키를 지운 뒤 Cognito 기록을 지우러 이동한다', async () => {
    mode.mock = false
    useAuthStore.setState({ user: { userId: 'sub-g', role: 'CUSTOMER', passwordLogin: false } })
    await useAuthStore.getState().signOut('EMAIL_SIGNUP_EXISTS')
    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    expect(leave).toHaveBeenCalledWith('EMAIL_SIGNUP_EXISTS')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('이메일 로그인(점주·관리자·이메일 고객, passwordLogin 모름 포함)은 쿠키만 지우고 이동하지 않는다 (11/16)', async () => {
    mode.mock = false
    for (const user of [
      { userId: 'sub-o', role: 'OWNER' as const, storeId: '1', passwordLogin: true },
      { userId: 'sub-a', role: 'ADMIN' as const, passwordLogin: true },
      { userId: 'sub-c', role: 'CUSTOMER' as const, passwordLogin: true },
      { userId: 'sub-old', role: 'OWNER' as const, storeId: '1' },
    ]) {
      useAuthStore.setState({ user })
      await useAuthStore.getState().signOut()
      expect(useAuthStore.getState().user).toBeNull()
    }
    expect(authClient.signOut).toHaveBeenCalledTimes(4)
    expect(leave).not.toHaveBeenCalled()
  })

  it('가짜 API 에서는 이동하지 않는다', async () => {
    mode.mock = true
    await useAuthStore.getState().signOut()
    expect(leave).not.toHaveBeenCalled()
  })

  it('세션 만료는 이동하지 않는다', () => {
    mode.mock = false
    expect(useAuthStore.getState().expireSession()).toBe(true)
    expect(leave).not.toHaveBeenCalled()
  })
})
