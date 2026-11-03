import {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/shared/auth'
import { api, SESSION_EXPIRED_MESSAGE } from './client'

/** 가짜 gateway. api 인스턴스와 bffClient 인스턴스가 함께 쓴다 */
const server = vi.hoisted(() => ({
  /** 지금 쿠키가 유효한지 (보호 API 가 200 을 줄지) */
  sessionValid: false,
  /** refresh 가 성공할지 */
  refreshOk: true,
  /** refresh 가 401 이 아닌 이유로 실패할 상태. 0 은 실패 안 함, -1 은 네트워크 오류 */
  refreshFailStatus: 0,
  /** 보호 API 가 세션과 상관없이 줄 상태 (403·500 확인용) */
  forcedStatus: 0,
  calls: [] as {
    method: string
    url: string
    headers: Record<string, unknown>
    data: unknown
  }[],
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/http')>()
  return {
    ...actual,
    createApiInstance: (): AxiosInstance => {
      const http = actual.createApiInstance()
      http.defaults.adapter = (config) => fakeGateway(config)
      return http
    },
  }
})

const refreshed: AuthUser = { userId: 'sub-o', role: 'OWNER', storeId: '9', email: 'o@test.com' }
const before: AuthUser = { userId: 'sub-o', role: 'OWNER', storeId: '7', email: 'o@test.com' }

async function fakeGateway(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const method = config.method?.toUpperCase() ?? 'GET'
  const url = config.url ?? ''
  server.calls.push({ method, url, headers: config.headers.toJSON(), data: config.data })
  const reply = (status: number, data?: unknown): AxiosResponse => {
    const response: AxiosResponse = {
      data,
      status,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    }
    if (status >= 400) throw new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, response)
    return response
  }
  if (url === '/auth/refresh') {
    // 동시 401 이 같은 갱신을 기다리는지 보려고 조금 늦게 답한다
    await new Promise((r) => setTimeout(r, 10))
    if (server.refreshFailStatus === -1)
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    if (server.refreshFailStatus) return reply(server.refreshFailStatus, { code: 'X' })
    if (!server.refreshOk) return reply(401, { code: 'SESSION_EXPIRED' })
    server.sessionValid = true
    return reply(200, {
      userId: refreshed.userId,
      role: refreshed.role,
      storeId: refreshed.storeId,
      email: refreshed.email,
    })
  }
  if (url === '/auth/logout') return reply(204)
  if (url === '/auth/login') return reply(401, { code: 'INVALID_CREDENTIALS' })
  await Promise.resolve()
  if (server.forcedStatus) return reply(server.forcedStatus, { code: 'X' })
  return server.sessionValid ? reply(200, { ok: url }) : reply(401, { code: 'UNAUTHORIZED' })
}

function count(url: string) {
  return server.calls.filter((c) => c.url === url).length
}

const toastError = vi.mocked(toast.error)

beforeEach(() => {
  server.sessionValid = false
  server.refreshOk = true
  server.refreshFailStatus = 0
  server.forcedStatus = 0
  server.calls = []
  toastError.mockClear()
  useAuthStore.setState({ user: before, restoring: false, loginNotice: null })
})

describe('api 인스턴스 (C-02 BFF)', () => {
  it('GET 에도 CSRF 헤더를 붙이고 Authorization 은 넣지 않는다', async () => {
    server.sessionValid = true
    await api.get('/owner/inventory')
    expect(server.calls[0].headers['X-Requested-With']).toBe('freshlink')
    expect(server.calls[0].headers.Authorization).toBeUndefined()
  })

  it('401 이면 refresh 한 번 뒤 원래 요청을 다시 보내 결과를 돌려주고, 사용자를 갱신한다', async () => {
    const res = await api.get('/owner/inventory')
    expect(res.data).toEqual({ ok: '/owner/inventory' })
    expect(count('/auth/refresh')).toBe(1)
    expect(count('/owner/inventory')).toBe(2)
    expect(useAuthStore.getState().user).toEqual(refreshed)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('동시 401 세 개는 refresh 를 한 번만 부르고 셋 다 다시 보내 성공한다', async () => {
    const results = await Promise.all([
      api.get('/owner/inventory'),
      api.get('/owner/orders'),
      api.get('/members/me'),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(count('/auth/refresh')).toBe(1)
    expect(server.calls.filter((c) => !c.url.startsWith('/auth/'))).toHaveLength(6)
  })

  it('refresh 가 401 이면 "다시 로그인해 주세요" 를 한 번 띄우고 사용자를 비운다 (동시 세 개여도 한 번)', async () => {
    server.refreshOk = false
    const results = await Promise.allSettled([
      api.get('/owner/inventory'),
      api.get('/owner/orders'),
      api.get('/members/me'),
    ])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(count('/auth/refresh')).toBe(1)
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE, { id: 'session-expired' })
    expect(useAuthStore.getState().user).toBeNull()
    expect(count('/auth/logout')).toBe(1)
  })

  it.each([
    ['502', 502],
    ['429', 429],
    ['네트워크 오류', -1],
  ])(
    'refresh 가 %s 이면 만료가 아니다: 원래 401 로 실패하고 토스트·로그아웃 없이 사용자를 둔다',
    async (_label, status) => {
      server.refreshFailStatus = status
      await expect(api.get('/owner/inventory')).rejects.toMatchObject({
        config: { url: '/owner/inventory' },
        response: { status: 401, data: { code: 'UNAUTHORIZED' } },
      })
      expect(count('/auth/refresh')).toBe(1)
      expect(count('/owner/inventory')).toBe(1)
      expect(count('/auth/logout')).toBe(0)
      expect(toastError).not.toHaveBeenCalled()
      expect(useAuthStore.getState().user).toEqual(before)
    },
  )

  it('동시 401 세 개에서 refresh 502 면 refresh 한 번, 셋 다 원래 401 로 실패하고 로그아웃 없다', async () => {
    server.refreshFailStatus = 502
    const results = await Promise.allSettled([
      api.get('/owner/inventory'),
      api.get('/owner/orders'),
      api.get('/members/me'),
    ])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ response: { status: 401 } })
    }
    expect(count('/auth/refresh')).toBe(1)
    expect(count('/auth/logout')).toBe(0)
    expect(toastError).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toEqual(before)
  })

  it('refresh 502 뒤 다음 401 은 다시 갱신해 성공한다 (일시 오류 회복)', async () => {
    server.refreshFailStatus = 502
    await expect(api.get('/owner/inventory')).rejects.toBeTruthy()
    server.refreshFailStatus = 0
    const res = await api.get('/owner/inventory')
    expect(res.data).toEqual({ ok: '/owner/inventory' })
    expect(count('/auth/refresh')).toBe(2)
    expect(useAuthStore.getState().user).toEqual(refreshed)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('다시 보낸 요청도 401 이면 더 갱신하지 않고 만료 처리한다', async () => {
    // refresh 는 성공하지만 보호 API 는 계속 401
    server.forcedStatus = 401
    await expect(api.get('/owner/inventory')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(count('/auth/refresh')).toBe(1)
    expect(count('/owner/inventory')).toBe(2)
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toBeNull()
    expect(count('/auth/logout')).toBe(1)
  })

  it('이미 로그아웃된 뒤의 401 은 refresh·토스트 없이 그대로 실패한다', async () => {
    useAuthStore.setState({ user: null })
    await expect(api.get('/owner/inventory')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(count('/auth/refresh')).toBe(0)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('/auth/login 401 은 refresh·토스트 없이 그대로 실패한다', async () => {
    await expect(api.post('/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({
      response: { status: 401, data: { code: 'INVALID_CREDENTIALS' } },
    })
    expect(count('/auth/refresh')).toBe(0)
    expect(toastError).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toEqual(before)
  })

  it('POST 401 도 refresh 뒤 같은 본문·CSRF 헤더로 한 번만 다시 보낸다', async () => {
    const body = { reason: 'EXPIRED', quantity: 2 }
    const res = await api.post('/owner/inventory/lots/1/discard', body)
    expect(res.status).toBe(200)
    const sent = server.calls.filter((c) => c.url === '/owner/inventory/lots/1/discard')
    expect(sent).toHaveLength(2)
    for (const c of sent) {
      expect(c.method).toBe('POST')
      expect(JSON.parse(String(c.data))).toEqual(body)
      expect(c.headers['X-Requested-With']).toBe('freshlink')
    }
    expect(count('/auth/refresh')).toBe(1)
  })

  it('만료 처리 뒤 이어지는 폴링·재시도 401 은 refresh·토스트를 되풀이하지 않는다', async () => {
    server.refreshOk = false
    await expect(api.get('/owner/inventory')).rejects.toBeTruthy()
    expect(count('/auth/refresh')).toBe(1)
    expect(toastError).toHaveBeenCalledTimes(1)
    // 3초 폴링이 몇 번 더 돌았다고 본다
    for (let i = 0; i < 3; i += 1) {
      await expect(api.get('/owner/inventory')).rejects.toMatchObject({
        response: { status: 401 },
      })
    }
    expect(count('/auth/refresh')).toBe(1)
    expect(count('/auth/logout')).toBe(1)
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('앱 시작 복원은 me 401 → refresh 실패여도 토스트 없이 로그아웃 상태로 끝난다', async () => {
    server.refreshOk = false
    useAuthStore.setState({ user: null, restoring: true })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState()).toMatchObject({ user: null, restoring: false })
    expect(count('/auth/me')).toBe(1)
    expect(count('/auth/refresh')).toBe(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('앱 시작 복원은 me 401 → refresh 200 이면 그 사용자로 들어간다 (me 를 다시 부르지 않는다)', async () => {
    useAuthStore.setState({ user: null, restoring: true })
    await useAuthStore.getState().restore()
    expect(useAuthStore.getState()).toMatchObject({ user: refreshed, restoring: false })
    expect(count('/auth/me')).toBe(1)
    expect(count('/auth/refresh')).toBe(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('401 이 아닌 오류(403·500)는 그대로 실패한다', async () => {
    server.forcedStatus = 403
    await expect(api.post('/owner/orders/1/accept')).rejects.toMatchObject({
      response: { status: 403 },
    })
    server.forcedStatus = 500
    await expect(api.get('/owner/inventory')).rejects.toMatchObject({
      response: { status: 500 },
    })
    expect(count('/auth/refresh')).toBe(0)
    expect(toastError).not.toHaveBeenCalled()
  })
})
