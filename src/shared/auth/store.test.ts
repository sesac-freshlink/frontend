import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authClient, useAuthStore } from './store'
import type { AuthUser } from './types'

const owner: AuthUser = { userId: 'sub-o', role: 'OWNER', storeId: '7' }
const moved: AuthUser = { userId: 'sub-o', role: 'OWNER', storeId: '9' }

beforeEach(() => {
  useAuthStore.setState({ user: null, restoring: false, loginNotice: null })
  vi.spyOn(authClient, 'signOut').mockResolvedValue(undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('useAuthStore (C-02)', () => {
  it('로그인에 성공하면 사용자를 넣고 로그인 화면 안내를 지운다', async () => {
    vi.spyOn(authClient, 'signIn').mockResolvedValue(owner)
    useAuthStore.setState({ loginNotice: 'EMAIL_SIGNUP_EXISTS' })
    await useAuthStore.getState().signIn('owner@test.com', 'pw')
    expect(useAuthStore.getState()).toMatchObject({ user: owner, loginNotice: null })
  })

  it('안내를 주고 로그아웃하면 사용자를 비우고 안내를 남긴다', async () => {
    useAuthStore.setState({ user: owner })
    await useAuthStore.getState().signOut('EMAIL_SIGNUP_EXISTS')
    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      loginNotice: 'EMAIL_SIGNUP_EXISTS',
    })
  })

  it('안내 없이 로그아웃하면 안내도 없다', async () => {
    useAuthStore.setState({ user: owner, loginNotice: 'EMAIL_SIGNUP_EXISTS' })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().loginNotice).toBeNull()
  })

  it('세션 만료는 사용자가 있을 때 한 번만 true 이고 로그아웃 요청을 보낸다', () => {
    useAuthStore.setState({ user: owner })
    expect(useAuthStore.getState().expireSession()).toBe(true)
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().expireSession()).toBe(false)
    expect(authClient.signOut).toHaveBeenCalledTimes(1)
  })

  it('갱신에 성공하면 사용자를 응답으로 바꾸고 true', async () => {
    vi.spyOn(authClient, 'refresh').mockResolvedValue(moved)
    useAuthStore.setState({ user: owner })
    expect(await useAuthStore.getState().refreshSession()).toBe(true)
    expect(useAuthStore.getState().user).toEqual(moved)
  })

  it('갱신에 실패하면 false 이고 사용자는 그대로', async () => {
    vi.spyOn(authClient, 'refresh').mockResolvedValue(null)
    useAuthStore.setState({ user: owner })
    expect(await useAuthStore.getState().refreshSession()).toBe(false)
    expect(useAuthStore.getState().user).toEqual(owner)
  })

  it('갱신이 401 이 아닌 이유로 실패하면 그 오류로 reject 하고 사용자는 그대로', async () => {
    const err = new Error('502')
    vi.spyOn(authClient, 'refresh').mockRejectedValue(err)
    useAuthStore.setState({ user: owner })
    await expect(useAuthStore.getState().refreshSession()).rejects.toBe(err)
    expect(useAuthStore.getState().user).toEqual(owner)
    expect(authClient.signOut).not.toHaveBeenCalled()
  })

  it('복원 결과로 사용자를 넣고 복원 중을 끝낸다', async () => {
    vi.spyOn(authClient, 'restore').mockResolvedValue(owner)
    useAuthStore.setState({ restoring: true })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState()).toMatchObject({ user: owner, restoring: false })
  })
})
