import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiInstance } from '@/shared/api/http'
import { createBffClient, toAuthUser } from './bffClient'

/** 가짜 서버 응답. status 가 0 이면 응답 없음(네트워크 오류) */
interface Reply {
  status: number
  data?: unknown
  delayMs?: number
}

type Route = (config: InternalAxiosRequestConfig) => Reply

let routes: Record<string, Route>
let calls: InternalAxiosRequestConfig[]

/** 실제 네트워크 대신 routes 로 답하는 axios 인스턴스 */
function fakeHttp() {
  const http = createApiInstance()
  http.defaults.adapter = async (config) => {
    calls.push(config)
    const key = `${config.method?.toUpperCase()} ${config.url}`
    const route = routes[key]
    const reply = route ? route(config) : { status: 404 }
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs))
    if (reply.status === 0) throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
    }
    if (reply.status >= 400) {
      throw new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, response)
    }
    return response
  }
  return http
}

const owner = { userId: 'sub-o', role: 'OWNER', storeId: '7', email: 'owner@test.com' }
const customer = { userId: 'sub-c', role: 'CUSTOMER', storeId: null, email: null }

function count(key: string) {
  return calls.filter((c) => `${c.method?.toUpperCase()} ${c.url}` === key).length
}

beforeEach(() => {
  routes = {}
  calls = []
})

afterEach(() => vi.restoreAllMocks())

describe('toAuthUser', () => {
  it('null 인 storeId·email 은 undefined 로 바꾼다', () => {
    expect(toAuthUser(customer)).toEqual({
      userId: 'sub-c',
      role: 'CUSTOMER',
      storeId: undefined,
      email: undefined,
    })
  })

  it('점주는 storeId·email 을 그대로 둔다', () => {
    expect(toAuthUser(owner)).toEqual(owner)
  })

  it('role 이 모르는 값이거나 userId 가 없으면 null', () => {
    expect(toAuthUser({ ...owner, role: 'SOMETHING' })).toBeNull()
    expect(toAuthUser({ ...owner, userId: '' })).toBeNull()
    expect(toAuthUser({ role: 'OWNER' })).toBeNull()
    expect(toAuthUser(null)).toBeNull()
    expect(toAuthUser('x')).toBeNull()
  })
})

describe('createBffClient', () => {
  it('signIn 은 POST /auth/login 에 이메일·비밀번호를 보내고 사용자를 돌려준다', async () => {
    routes['POST /auth/login'] = () => ({ status: 200, data: owner })
    const user = await createBffClient(fakeHttp()).signIn('owner@test.com', 'pw')
    expect(user).toEqual(owner)
    expect(JSON.parse(String(calls[0].data))).toEqual({ email: 'owner@test.com', password: 'pw' })
  })

  it('모든 요청에 CSRF 헤더가 있고 Authorization 은 없다', async () => {
    routes['POST /auth/login'] = () => ({ status: 200, data: owner })
    routes['GET /auth/me'] = () => ({ status: 200, data: owner })
    const client = createBffClient(fakeHttp())
    await client.signIn('owner@test.com', 'pw')
    await client.restore()
    for (const c of calls) {
      expect(c.headers.get('X-Requested-With')).toBe('freshlink')
      expect(c.headers.get('Authorization')).toBeFalsy()
    }
  })

  it('signIn 응답의 역할을 모르면 로그아웃으로 쿠키를 지운 뒤 실패한다', async () => {
    routes['POST /auth/login'] = () => ({ status: 200, data: { ...owner, role: 'X' } })
    routes['POST /auth/logout'] = () => ({ status: 204 })
    await expect(createBffClient(fakeHttp()).signIn('a@test.com', 'pw')).rejects.toThrow(
      '역할 확인 실패',
    )
    expect(count('POST /auth/logout')).toBe(1)
  })

  it('역할 모름 뒤 로그아웃이 실패(500·네트워크)해도 역할 확인 실패로 끝난다', async () => {
    routes['POST /auth/login'] = () => ({ status: 200, data: { ...owner, role: 'X' } })
    const client = createBffClient(fakeHttp())
    routes['POST /auth/logout'] = () => ({ status: 500 })
    await expect(client.signIn('a@test.com', 'pw')).rejects.toThrow('역할 확인 실패')
    routes['POST /auth/logout'] = () => ({ status: 0 })
    await expect(client.signIn('a@test.com', 'pw')).rejects.toThrow('역할 확인 실패')
    expect(count('POST /auth/logout')).toBe(2)
  })

  it('signIn 이 성공하면 로그아웃 요청을 보내지 않는다', async () => {
    routes['POST /auth/login'] = () => ({ status: 200, data: owner })
    await createBffClient(fakeHttp()).signIn('owner@test.com', 'pw')
    expect(count('POST /auth/logout')).toBe(0)
  })

  it('signIn 오류는 axios 오류 그대로 넘긴다 (화면이 code 로 구분)', async () => {
    routes['POST /auth/login'] = () => ({ status: 401, data: { code: 'INVALID_CREDENTIALS' } })
    await expect(createBffClient(fakeHttp()).signIn('a@test.com', 'pw')).rejects.toMatchObject({
      response: { status: 401, data: { code: 'INVALID_CREDENTIALS' } },
    })
  })

  it('signUp·confirmSignUp 은 역할 없이 보낸다', async () => {
    routes['POST /auth/signup'] = () => ({ status: 201 })
    routes['POST /auth/confirm'] = () => ({ status: 204 })
    const client = createBffClient(fakeHttp())
    await client.signUp({ email: 'kim@test.com', password: 'pw' })
    await client.confirmSignUp('kim@test.com', '123456')
    expect(JSON.parse(String(calls[0].data))).toEqual({ email: 'kim@test.com', password: 'pw' })
    expect(JSON.parse(String(calls[1].data))).toEqual({ email: 'kim@test.com', code: '123456' })
  })

  it('signOut 은 POST /auth/logout 이 실패(500·네트워크)해도 resolve 한다', async () => {
    const client = createBffClient(fakeHttp())
    routes['POST /auth/logout'] = () => ({ status: 500 })
    await expect(client.signOut()).resolves.toBeUndefined()
    routes['POST /auth/logout'] = () => ({ status: 0 })
    await expect(client.signOut()).resolves.toBeUndefined()
    expect(count('POST /auth/logout')).toBe(2)
  })

  it('로그인·복원·갱신·로그아웃 어디에서도 브라우저 저장소를 쓰지 않는다 (토큰은 쿠키에만)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    routes['POST /auth/login'] = () => ({ status: 200, data: owner })
    routes['GET /auth/me'] = () => ({ status: 401 })
    routes['POST /auth/refresh'] = () => ({ status: 200, data: owner })
    routes['POST /auth/logout'] = () => ({ status: 204 })
    const client = createBffClient(fakeHttp())
    await client.signIn('owner@test.com', 'pw')
    await client.restore()
    await client.signOut()
    expect(setItem).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()
  })

  it('refresh·logout 은 본문 없이 보낸다', async () => {
    routes['POST /auth/refresh'] = () => ({ status: 200, data: owner })
    routes['POST /auth/logout'] = () => ({ status: 204 })
    const client = createBffClient(fakeHttp())
    await client.refresh()
    await client.signOut()
    expect(calls.map((c) => c.data ?? undefined)).toEqual([undefined, undefined])
  })

  describe('restore', () => {
    it('/auth/me 200 이면 그 사용자', async () => {
      routes['GET /auth/me'] = () => ({ status: 200, data: owner })
      expect(await createBffClient(fakeHttp()).restore()).toEqual(owner)
      expect(count('POST /auth/refresh')).toBe(0)
    })

    it('/auth/me 401 이면 refresh 한 번, 그 본문 사용자 (me 를 다시 부르지 않는다)', async () => {
      routes['GET /auth/me'] = () => ({ status: 401, data: { code: 'UNAUTHORIZED' } })
      routes['POST /auth/refresh'] = () => ({ status: 200, data: owner })
      expect(await createBffClient(fakeHttp()).restore()).toEqual(owner)
      expect(count('POST /auth/refresh')).toBe(1)
      expect(count('GET /auth/me')).toBe(1)
    })

    it('/auth/me 401 → refresh 401 이면 null', async () => {
      routes['GET /auth/me'] = () => ({ status: 401 })
      routes['POST /auth/refresh'] = () => ({ status: 401, data: { code: 'SESSION_EXPIRED' } })
      expect(await createBffClient(fakeHttp()).restore()).toBeNull()
    })

    it('/auth/me 500·네트워크 오류면 refresh 없이 null', async () => {
      routes['GET /auth/me'] = () => ({ status: 500 })
      const client = createBffClient(fakeHttp())
      expect(await client.restore()).toBeNull()
      routes['GET /auth/me'] = () => ({ status: 0 })
      expect(await client.restore()).toBeNull()
      expect(count('POST /auth/refresh')).toBe(0)
    })

    it('/auth/me 401 → refresh 502·네트워크 오류여도 null (복원은 던지지 않는다)', async () => {
      routes['GET /auth/me'] = () => ({ status: 401 })
      const client = createBffClient(fakeHttp())
      routes['POST /auth/refresh'] = () => ({ status: 502 })
      expect(await client.restore()).toBeNull()
      routes['POST /auth/refresh'] = () => ({ status: 0 })
      expect(await client.restore()).toBeNull()
      expect(count('POST /auth/refresh')).toBe(2)
    })
  })

  describe('refresh', () => {
    it('동시에 세 번 불러도 POST 는 한 번이고 같은 결과를 받는다', async () => {
      routes['POST /auth/refresh'] = () => ({ status: 200, data: owner, delayMs: 10 })
      const client = createBffClient(fakeHttp())
      const results = await Promise.all([client.refresh(), client.refresh(), client.refresh()])
      expect(count('POST /auth/refresh')).toBe(1)
      expect(results).toEqual([owner, owner, owner])
    })

    it('끝난 뒤 다시 부르면 새로 요청한다', async () => {
      routes['POST /auth/refresh'] = () => ({ status: 200, data: owner })
      const client = createBffClient(fakeHttp())
      await client.refresh()
      await client.refresh()
      expect(count('POST /auth/refresh')).toBe(2)
    })

    it('401 이면 null (세션 만료)', async () => {
      routes['POST /auth/refresh'] = () => ({ status: 401, data: { code: 'SESSION_EXPIRED' } })
      expect(await createBffClient(fakeHttp()).refresh()).toBeNull()
    })

    it('429·502 는 null 이 아니라 그 오류로 reject 한다', async () => {
      const client = createBffClient(fakeHttp())
      for (const status of [429, 502]) {
        routes['POST /auth/refresh'] = () => ({ status })
        await expect(client.refresh()).rejects.toMatchObject({ response: { status } })
      }
    })

    it('네트워크 오류도 그 오류로 reject 한다', async () => {
      routes['POST /auth/refresh'] = () => ({ status: 0 })
      await expect(createBffClient(fakeHttp()).refresh()).rejects.toMatchObject({
        code: 'ERR_NETWORK',
      })
    })

    it('동시에 세 번 불러 502 면 POST 는 한 번이고 셋 다 같은 오류로 reject 한다', async () => {
      routes['POST /auth/refresh'] = () => ({ status: 502, delayMs: 10 })
      const client = createBffClient(fakeHttp())
      const results = await Promise.allSettled([
        client.refresh(),
        client.refresh(),
        client.refresh(),
      ])
      expect(count('POST /auth/refresh')).toBe(1)
      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
    })

    it('502 로 실패한 뒤 다시 부르면 새로 요청한다', async () => {
      const client = createBffClient(fakeHttp())
      routes['POST /auth/refresh'] = () => ({ status: 502 })
      await expect(client.refresh()).rejects.toBeTruthy()
      routes['POST /auth/refresh'] = () => ({ status: 200, data: owner })
      expect(await client.refresh()).toEqual(owner)
      expect(count('POST /auth/refresh')).toBe(2)
    })
  })
})
