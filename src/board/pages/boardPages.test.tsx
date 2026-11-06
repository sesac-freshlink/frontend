import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { BoardPage, FaqItem, NoticeDetail, NoticeSummary } from '../api'
import { AdminFaqsPage } from './AdminFaqsPage'
import { AdminNoticesPage } from './AdminNoticesPage'
import { FaqPage } from './FaqPage'
import { NoticeDetailPage } from './NoticeDetailPage'
import { NoticeListPage } from './NoticeListPage'

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

// jsdom 에는 showModal/close 가 없다. open 속성과 close 이벤트만 흉내 낸다
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const originalShowModal = dialogProto.showModal
const originalClose = dialogProto.close
beforeAll(() => {
  dialogProto.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogProto.close ??= function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
})
afterAll(() => {
  dialogProto.showModal = originalShowModal
  dialogProto.close = originalClose
})

const pinned: NoticeDetail = {
  noticeId: 1,
  title: '서비스를 시작했어요',
  content: '첫 줄\n둘째 줄',
  audience: 'ALL',
  pinned: true,
  createdAt: '2026-11-01T09:00:00+09:00',
  updatedAt: '2026-11-01T09:00:00+09:00',
}
const summary = ({
  noticeId,
  title,
  audience,
  pinned: p,
  createdAt,
}: NoticeDetail): NoticeSummary => ({
  noticeId,
  title,
  audience,
  pinned: p,
  createdAt,
})
const pageOf = (content: NoticeSummary[]): BoardPage<NoticeSummary> => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
})
const faq: FaqItem = {
  faqId: 7,
  question: '언제 받아 가요?',
  answer: '결제한 날 받아 가 주세요.',
  audience: 'CUSTOMER',
  sortOrder: 1,
}

function renderAt(path: string, routes: { path: string; element: React.ReactNode }[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('게시판 화면 (A17)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('공지 목록에서 글을 누르면 상세가 줄바꿈 그대로 보인다', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/members/notices') return { data: pageOf([summary(pinned)]) }
      if (url === '/members/notices/1') return { data: pinned }
      throw new Error(url)
    })
    renderAt('/customer/notices', [
      { path: '/customer/notices', element: <NoticeListPage basePath="/customer/notices" /> },
      {
        path: '/customer/notices/:noticeId',
        element: <NoticeDetailPage basePath="/customer/notices" />,
      },
    ])

    expect(await screen.findByLabelText('고정')).toBeInTheDocument()
    expect(screen.getByText('2026.11.01')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /서비스를 시작했어요/ }))

    expect(await screen.findByRole('heading', { name: '서비스를 시작했어요' })).toBeInTheDocument()
    expect(screen.getByText(/첫 줄/)).toHaveClass('whitespace-pre-line')
  })

  it('없는 공지는 "없는 공지예요"', async () => {
    get.mockRejectedValue(
      new AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: { code: 'NOTICE_NOT_FOUND' },
      } as AxiosResponse),
    )
    renderAt('/owner/notices/9', [
      { path: '/owner/notices/:noticeId', element: <NoticeDetailPage basePath="/owner/notices" /> },
    ])
    expect(await screen.findByRole('alert')).toHaveTextContent('없는 공지예요.')
  })

  it('FAQ 는 질문을 누르면 답이 펼쳐진다', async () => {
    get.mockResolvedValue({ data: [faq] })
    renderAt('/customer/faq', [{ path: '/customer/faq', element: <FaqPage /> }])

    const question = await screen.findByText('Q. 언제 받아 가요?')
    const details = question.closest('details')
    expect(details).not.toHaveAttribute('open')
    await userEvent.click(question)
    expect(details).toHaveAttribute('open')
  })

  it('관리자 공지 쓰기: 비우면 막고, 채우면 POST 하고 창이 닫힌다', async () => {
    get.mockResolvedValue({ data: pageOf([]) })
    post.mockResolvedValue({ data: { ...pinned, noticeId: 2 } })
    renderAt('/admin/notices', [{ path: '/admin/notices', element: <AdminNoticesPage /> }])

    await screen.findByText('공지사항이 없어요.')
    await userEvent.click(screen.getByRole('button', { name: '공지 쓰기' }))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('제목을 입력하세요')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('제목'), '새 공지')
    await userEvent.type(screen.getByLabelText('본문'), '본문입니다')
    await userEvent.selectOptions(screen.getByLabelText('볼 사람'), 'OWNER')
    await userEvent.click(screen.getByLabelText('맨 위에 고정'))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/admin/notices', {
        title: '새 공지',
        content: '본문입니다',
        audience: 'OWNER',
        pinned: true,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('관리자 공지 고치기는 본문을 받아 와 채우고 PUT, 지우기는 한 번 더 묻는다', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/admin/notices') return { data: pageOf([summary(pinned)]) }
      if (url === '/admin/notices/1') return { data: pinned }
      throw new Error(url)
    })
    put.mockResolvedValue({ data: pinned })
    del.mockResolvedValue({ data: undefined })
    renderAt('/admin/notices', [{ path: '/admin/notices', element: <AdminNoticesPage /> }])

    await userEvent.click(await screen.findByRole('button', { name: '서비스를 시작했어요 고치기' }))
    const title = await screen.findByLabelText('제목')
    expect(title).toHaveValue('서비스를 시작했어요')
    expect(screen.getByLabelText('본문')).toHaveValue('첫 줄\n둘째 줄')
    await userEvent.clear(title)
    await userEvent.type(title, '고친 제목')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/notices/1', {
        title: '고친 제목',
        content: '첫 줄\n둘째 줄',
        audience: 'ALL',
        pinned: true,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: '서비스를 시작했어요 지우기' }))
    expect(del).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '정말 지우기' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/admin/notices/1'))
  })

  it('관리자 FAQ 순서는 숫자로 보낸다', async () => {
    get.mockResolvedValue({ data: [faq] })
    put.mockResolvedValue({ data: faq })
    renderAt('/admin/faqs', [{ path: '/admin/faqs', element: <AdminFaqsPage /> }])

    await userEvent.click(await screen.findByRole('button', { name: '언제 받아 가요? 고치기' }))
    const order = screen.getByLabelText('순서')
    await userEvent.clear(order)
    await userEvent.type(order, 'abc')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('0~9999로 입력하세요')).toBeInTheDocument()

    await userEvent.clear(order)
    await userEvent.type(order, '3')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/faqs/7', {
        question: '언제 받아 가요?',
        answer: '결제한 날 받아 가 주세요.',
        audience: 'CUSTOMER',
        sortOrder: 3,
      }),
    )
  })
})
