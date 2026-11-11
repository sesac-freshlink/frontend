import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { authHandlers, csrfGuard, resetMockSession } from './authHandlers'
import { boardHandlers, resetMockBoard } from './boardHandlers'

const handlers = [csrfGuard, ...authHandlers, ...boardHandlers]
const CSRF = { 'X-Requested-With': 'freshlink', 'Content-Type': 'application/json' }

async function call(path: string, method = 'GET', body?: unknown) {
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

const login = (email: string) => call('/api/auth/login', 'POST', { email, password: 'x' })

describe('게시판 가짜 API (A17)', () => {
  beforeEach(() => {
    resetMockSession()
    resetMockBoard()
  })

  it('고객은 모두·고객 글만, 고정 글이 먼저 보이고 점주 글 상세는 404', async () => {
    await login('me@test.com')
    const list = (await (await call('/api/members/notices')).json()) as {
      content: { noticeId: number; pinned: boolean }[]
    }
    expect(list.content.map((n) => n.noticeId)).toEqual([1, 2])
    expect(list.content[0]?.pinned).toBe(true)

    const ownerOnly = await call('/api/members/notices/3')
    expect(ownerOnly.status).toBe(404)
    expect(await ownerOnly.json()).toMatchObject({ code: 'NOTICE_NOT_FOUND' })

    const faqs = (await (await call('/api/members/faqs')).json()) as { faqId: number }[]
    expect(faqs.map((f) => f.faqId)).toEqual([1, 2, 4])
  })

  it('점주는 모두·점주 글만 본다', async () => {
    await login('owner@test.com')
    const list = (await (await call('/api/members/notices')).json()) as {
      content: { noticeId: number }[]
    }
    expect(list.content.map((n) => n.noticeId)).toEqual([1, 3])
  })

  it('관리자는 글을 쓰고 고치고 지운다. 고객 화면 API 는 403', async () => {
    await login('admin@test.com')
    expect((await call('/api/members/notices')).status).toBe(403)

    const created = await call('/api/admin/notices', 'POST', {
      title: '새 공지',
      content: '본문',
      audience: 'CUSTOMER',
      pinned: false,
    })
    expect(created.status).toBe(201)
    const { noticeId } = (await created.json()) as { noticeId: number }

    const updated = await call(`/api/admin/notices/${noticeId}`, 'PUT', {
      title: '고친 공지',
      content: '본문',
      audience: 'ALL',
      pinned: true,
    })
    expect(await updated.json()).toMatchObject({ title: '고친 공지', pinned: true })

    expect((await call(`/api/admin/notices/${noticeId}`, 'DELETE')).status).toBe(204)
    expect((await call(`/api/admin/notices/${noticeId}`)).status).toBe(404)

    const badFaq = await call('/api/admin/faqs', 'POST', {
      question: '질문',
      answer: '답',
      audience: 'ALL',
      sortOrder: 10000,
    })
    expect(badFaq.status).toBe(400)
  })

  it('고객은 관리자 API 를 못 쓴다', async () => {
    await login('me@test.com')
    expect((await call('/api/admin/faqs')).status).toBe(403)
  })
})

describe('메인배너 가짜 API (A18)', () => {
  beforeEach(() => {
    resetMockSession()
    resetMockBoard()
  })

  const req = (over: Record<string, unknown> = {}) => ({
    title: '새 배너',
    imageUrl: '/banners/guide.svg',
    noticeId: null,
    sortOrder: 9,
    visible: true,
    startsAt: null,
    endsAt: null,
    ...over,
  })

  it('홈 배너는 고객만, 관리자 API 는 관리자만', async () => {
    await login('owner@test.com')
    expect((await call('/api/members/banners')).status).toBe(403)
    expect((await call('/api/admin/banners')).status).toBe(403)
    await login('me@test.com')
    const home = (await (await call('/api/members/banners')).json()) as { bannerId: number }[]
    expect(home.map((x) => x.bannerId)).toEqual([1, 2, 3, 4])
    expect(home[0]).toEqual({
      bannerId: 1,
      title: '마감세일, 오늘 23:59까지 픽업',
      imageUrl: '/banners/clearance.svg',
      noticeId: 1,
    })
    expect((await call('/api/admin/banners', 'POST', req())).status).toBe(403)
  })

  it('입력 규칙·기간·없는 공지를 막고, 홈은 보이기 + 기간 안 5장만', async () => {
    await login('admin@test.com')
    expect((await call('/api/admin/banners', 'POST', req({ title: '가'.repeat(51) }))).status).toBe(
      400,
    )
    expect(
      (await call('/api/admin/banners', 'POST', req({ imageUrl: 'https://x/a.svg' }))).status,
    ).toBe(400)
    const period = await call(
      '/api/admin/banners',
      'POST',
      req({ startsAt: '2026-11-20T00:00:00+09:00', endsAt: '2026-11-15T00:00:00+09:00' }),
    )
    expect(await period.json()).toMatchObject({ code: 'BANNER_PERIOD_INVALID' })
    const notice = await call('/api/admin/banners', 'POST', req({ noticeId: 999 }))
    expect(notice.status).toBe(404)
    for (let i = 0; i < 3; i++) {
      expect((await call('/api/admin/banners', 'POST', req({ title: `추가 ${i}` }))).status).toBe(
        201,
      )
    }
    await call('/api/admin/banners', 'POST', req({ title: '꺼짐', visible: false, sortOrder: 0 }))
    await login('me@test.com')
    const home = (await (await call('/api/members/banners')).json()) as { title: string }[]
    expect(home).toHaveLength(5)
    expect(home.map((x) => x.title)).not.toContain('꺼짐')
  })

  it('순서 바꾸기는 전부를 한 번씩, 공지를 지우면 배너 연결만 끊긴다', async () => {
    await login('admin@test.com')
    const bad = await call('/api/admin/banners/order', 'PUT', { bannerIds: [1, 2, 3] })
    expect(await bad.json()).toMatchObject({ code: 'BANNER_ORDER_INVALID' })
    const ok = (await (
      await call('/api/admin/banners/order', 'PUT', { bannerIds: [4, 3, 2, 1] })
    ).json()) as {
      bannerId: number
    }[]
    expect(ok.map((x) => x.bannerId)).toEqual([4, 3, 2, 1])

    expect((await call('/api/admin/notices/1', 'DELETE')).status).toBe(204)
    const list = (await (await call('/api/admin/banners')).json()) as {
      bannerId: number
      noticeId: number | null
      noticeTitle: string | null
    }[]
    expect(list.find((x) => x.bannerId === 1)).toMatchObject({ noticeId: null, noticeTitle: null })
    expect((await call('/api/admin/banners/99', 'DELETE')).status).toBe(404)
  })
})
