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
