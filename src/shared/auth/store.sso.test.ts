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
  it('실제 gateway 를 쓰면 쿠키를 지운 뒤 Cognito 기록을 지우러 이동한다', async () => {
    mode.mock = false
    await useAuthStore.getState().signOut('EMAIL_SIGNUP_EXISTS')
    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    expect(leave).toHaveBeenCalledWith('EMAIL_SIGNUP_EXISTS')
    expect(useAuthStore.getState().user).toBeNull()
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
