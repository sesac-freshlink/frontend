import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthUserResponse } from '@/shared/auth'
import { authHandlers, csrfGuard, resetMockSession } from './authHandlers'
import { memberHandlers } from './memberHandlers'

const handlers = [csrfGuard, ...authHandlers, ...memberHandlers]
const CSRF = { 'X-Requested-With': 'freshlink' }

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(handlers, new Request(new URL(path, location.origin), init))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}

function post(path: string, body?: unknown, headers: Record<string, string> = CSRF) {
  return call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function login(email: string) {
  const res = await post('/api/auth/login', { email, password: 'x' })
  return (await res.json()) as AuthUserResponse
}

describe('BFF 가짜 API (C-01·C-02)', () => {
  beforeEach(() => resetMockSession())

  it('CSRF 헤더 없는 POST 는 403 CSRF_HEADER_REQUIRED', async () => {
    const res = await post('/api/auth/login', { email: 'a@test.com', password: 'x' }, {})
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'CSRF_HEADER_REQUIRED' })
  })

  it('CSRF 헤더 없는 PUT·PATCH·DELETE 도 403 CSRF_HEADER_REQUIRED', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const res = await call('/api/owner/inventory/lots/1', { method })
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ code: 'CSRF_HEADER_REQUIRED' })
    }
  })

  it('새로 고침 뒤에도 저장된 가짜 세션으로 me 가 200 (MSW 한정 localStorage)', async () => {
    localStorage.setItem(
      'freshlink.mockSession',
      JSON.stringify({ userId: 'mock-owner', role: 'OWNER', storeId: '1', email: 'owner@x' }),
    )
    const res = await call('/api/auth/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'mock-owner', storeId: '1' })
  })

  it('CSRF 헤더 없는 GET 은 통과한다', async () => {
    const res = await call('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('이메일로 역할을 정한다', async () => {
    expect(await login('admin@freshlink.test')).toMatchObject({
      userId: 'mock-admin',
      role: 'ADMIN',
      storeId: null,
    })
    expect(await login('owner@freshlink.test')).toMatchObject({
      userId: 'mock-owner',
      role: 'OWNER',
      storeId: '1',
    })
    expect(await login('google@freshlink.test')).toMatchObject({
      userId: 'mock-google',
      role: 'CUSTOMER',
    })
    expect(await login('dup@freshlink.test')).toMatchObject({
      userId: 'mock-dup',
      role: 'CUSTOMER',
    })
    expect(await login('kim@freshlink.test')).toMatchObject({
      userId: 'mock-customer',
      role: 'CUSTOMER',
      storeId: null,
      email: 'kim@freshlink.test',
    })
  })

  it('이메일이 비면 400 INVALID_REQUEST', async () => {
    const res = await post('/api/auth/login', { email: '', password: 'x' })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('me 는 로그인 전 401, 뒤 200', async () => {
    expect((await call('/api/auth/me')).status).toBe(401)
    await login('owner@freshlink.test')
    const res = await call('/api/auth/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'mock-owner' })
  })

  it('refresh 는 세션이 없으면 401 SESSION_EXPIRED, 있으면 200', async () => {
    const expired = await post('/api/auth/refresh')
    expect(expired.status).toBe(401)
    expect(await expired.json()).toMatchObject({ code: 'SESSION_EXPIRED' })
    await login('kim@freshlink.test')
    expect((await post('/api/auth/refresh')).status).toBe(200)
  })

  it('logout 뒤 me 는 401', async () => {
    await login('kim@freshlink.test')
    expect((await post('/api/auth/logout')).status).toBe(204)
    expect((await call('/api/auth/me')).status).toBe(401)
  })

  it('signup 201, confirm 은 000000 이면 400 CODE_MISMATCH 아니면 204', async () => {
    expect((await post('/api/auth/signup', { email: 'k@test.com', password: 'x' })).status).toBe(
      201,
    )
    const wrong = await post('/api/auth/confirm', { email: 'k@test.com', code: '000000' })
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toMatchObject({ code: 'CODE_MISMATCH' })
    expect((await post('/api/auth/confirm', { email: 'k@test.com', code: '123456' })).status).toBe(
      204,
    )
  })

  it('dup 세션으로 프로필을 저장하면 409 EMAIL_SIGNUP_EXISTS', async () => {
    await login('dup@freshlink.test')
    const res = await post('/api/members/me', { name: '김', nickname: 'dupnick', region: 'SEOUL' })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'EMAIL_SIGNUP_EXISTS' })
  })

  it('가짜 구글 고객은 프로필이 없다 (MB-03 404)', async () => {
    await login('google@freshlink.test')
    expect((await call('/api/members/me')).status).toBe(404)
  })

  it('프로필은 가짜 사용자마다 따로 둔다', async () => {
    await login('kim@freshlink.test')
    const saved = await post('/api/members/me', {
      name: '김',
      nickname: 'kimnick',
      region: 'SEOUL',
    })
    expect(saved.status).toBe(201)
    expect(await saved.json()).toMatchObject({ memberId: 'mock-customer' })
    await login('google@freshlink.test')
    expect((await call('/api/members/me')).status).toBe(404)
  })
})
