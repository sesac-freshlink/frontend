import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { authHandlers, csrfGuard, resetMockSession } from './authHandlers'
import { memberHandlers } from './memberHandlers'

const handlers = [csrfGuard, ...authHandlers, ...memberHandlers]
const CSRF = { 'X-Requested-With': 'freshlink', 'Content-Type': 'application/json' }

async function call(path: string, method: string, body?: unknown) {
  const res = await getResponse(
    handlers,
    new Request(new URL(path, location.origin), {
      method,
      headers: CSRF,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  if (!res) throw new Error(`핸들러 없음: ${method} ${path}`)
  return res
}

describe('MB-04 가짜 API (PATCH /api/members/me)', () => {
  beforeEach(async () => {
    resetMockSession()
    await call('/api/auth/login', 'POST', { email: 'patch@test.com', password: 'x' })
    await call('/api/members/me', 'POST', {
      name: '김경우',
      nickname: 'Mine01',
      region: 'SEOUL',
      termsAgreed: true,
      privacyAgreed: true,
    })
  })

  it('보낸 칸만 바꾸고, 빈 요청은 400, 다른 사람 닉네임은 409, 내 닉네임 대소문자는 200', async () => {
    const before = (await (await call('/api/members/me', 'GET')).json()) as { nickname: string }

    const region = await call('/api/members/me', 'PATCH', { region: 'JEJU' })
    expect(region.status).toBe(200)
    expect(await region.json()).toMatchObject({ region: 'JEJU', nickname: before.nickname })

    const empty = await call('/api/members/me', 'PATCH', {})
    expect(empty.status).toBe(400)
    expect(await empty.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

    const taken = await call('/api/members/me', 'PATCH', { nickname: 'Fresh01' })
    expect(taken.status).toBe(409)
    expect(await taken.json()).toMatchObject({ code: 'NICKNAME_DUPLICATED' })

    const mine = await call('/api/members/me', 'PATCH', { nickname: before.nickname.toUpperCase() })
    expect(mine.status).toBe(200)
  })
})

describe('MB-02 가짜 API 약관 동의 (A16)', () => {
  beforeEach(async () => {
    resetMockSession()
    await call('/api/auth/login', 'POST', { email: 'terms@test.com', password: 'x' })
  })

  it('필수 약관 두 개에 모두 동의하지 않으면 400, 동의하면 201', async () => {
    const profile = { name: '김경우', nickname: 'Terms01', region: 'SEOUL' }
    const none = await call('/api/members/me', 'POST', profile)
    expect(none.status).toBe(400)
    expect(await none.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
    const one = await call('/api/members/me', 'POST', { ...profile, termsAgreed: true })
    expect(one.status).toBe(400)
    const ok = await call('/api/members/me', 'POST', {
      ...profile,
      termsAgreed: true,
      privacyAgreed: true,
    })
    // 가짜 고객은 같은 sub 를 쓰므로 앞 테스트가 만든 프로필이 있으면 200 (서버와 같은 멱등)
    expect([200, 201]).toContain(ok.status)
  })
})
