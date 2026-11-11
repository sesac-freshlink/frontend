import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { BoardPage, NoticeSummary } from '../api'
import type { AdminBanner } from '../banners'
import { AdminBannersPage } from './AdminBannersPage'

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

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

const banner = (id: number, over: Partial<AdminBanner> = {}): AdminBanner => ({
  bannerId: id,
  title: `배너 ${id}`,
  imageUrl: '/banners/clearance.svg',
  noticeId: null,
  noticeTitle: null,
  sortOrder: id - 1,
  visible: true,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-11-11T09:00:00+09:00',
  updatedAt: '2026-11-11T09:00:00+09:00',
  ...over,
})

const notices: BoardPage<NoticeSummary> = {
  content: [
    {
      noticeId: 4,
      title: '11월 마감세일 주간 안내',
      audience: 'CUSTOMER',
      pinned: false,
      createdAt: '2026-11-10T09:00:00+09:00',
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
}

function serve(list: AdminBanner[] | Error) {
  get.mockImplementation(async (url: string) => {
    if (url === '/admin/notices') return { data: notices }
    if (list instanceof Error) throw list
    return { data: list }
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AdminBannersPage />
    </QueryClientProvider>,
  )
}

function errorWith(code: string, status: number) {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', String(status), { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data: { code, message: '', traceId: 't' },
  })
}

describe('관리자 메인배너 (A18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('목록은 순서대로 작은 그림·제목·공지·기간·홈 상태를 보이고, 6번째부터 홈에 안 보인다고 알린다', async () => {
    serve([
      banner(1, { noticeId: 4, noticeTitle: '11월 마감세일 주간 안내' }),
      banner(2, { visible: false }),
      banner(3, { startsAt: '2099-01-01T00:00:00+09:00' }),
      banner(4, { endsAt: '2000-01-01T00:00:00+09:00' }),
      banner(5),
      banner(6),
      banner(7),
      banner(8),
      banner(9),
    ])
    renderPage()
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows).toHaveLength(9)
    expect(within(rows[0]!).getByText('11월 마감세일 주간 안내')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('홈에 보여요')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('늘')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('꺼 둠')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('노출 전')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('노출 끝')).toBeInTheDocument()
    // 보이는 배너(1·5·6·7·8) 다음인 9번째 줄이 6번째 → 홈에 안 보임
    expect(within(rows[7]!).getByText('홈에 보여요')).toBeInTheDocument()
    expect(within(rows[8]!).getByText('6번째부터 홈에 안 보여요')).toBeInTheDocument()
    expect(screen.getByText(/6번째부터는 홈에 안 보여요/)).toBeInTheDocument()
  })

  it('비었거나 못 불러오면 그렇게 알린다', async () => {
    serve([])
    renderPage()
    expect(await screen.findByText(/올린 배너가 없어요/)).toBeInTheDocument()
  })

  it('목록을 못 불러오면 오류를 보인다', async () => {
    serve(new Error('500'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('배너를 불러오지 못했어요.')
  })

  it('위·아래 버튼은 지금 배너 전부를 새 순서로 보낸다. 맨 위는 위로, 맨 아래는 아래로 못 간다', async () => {
    serve([banner(1), banner(2), banner(3)])
    put.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByRole('button', { name: '배너 1 위로' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '배너 3 아래로' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '배너 3 위로' }))
    expect(put).toHaveBeenCalledWith('/admin/banners/order', { bannerIds: [1, 3, 2] })
  })

  it('배너 올리기: 제목을 비우면 막고, 그림·공지·기간을 골라 맨 뒤 순서로 보낸다', async () => {
    serve([banner(1), banner(2, { sortOrder: 7 })])
    post.mockResolvedValue({ data: banner(3) })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배너 올리기' }))
    const dialog = screen.getByRole('dialog', { name: '배너 올리기' })
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByText('제목을 입력하세요')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText('제목'), '  픽업 신청 잊지 마세요 ')
    await userEvent.click(within(dialog).getByRole('radio', { name: '픽업 신청' }))
    expect(
      within(dialog).getByRole('img', { name: '미리보기: 픽업 신청 잊지 마세요' }),
    ).toHaveAttribute('src', '/banners/pickup-request.svg')
    await userEvent.selectOptions(
      await within(dialog).findByLabelText('누르면 열 공지 (선택)'),
      '11월 마감세일 주간 안내',
    )
    await userEvent.type(within(dialog).getByLabelText('노출 시작 (선택)'), '2026-11-15T00:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/admin/banners', {
        title: '픽업 신청 잊지 마세요',
        imageUrl: '/banners/pickup-request.svg',
        noticeId: 4,
        sortOrder: 8,
        visible: true,
        startsAt: '2026-11-15T00:00:00+09:00',
        endsAt: null,
      }),
    )
  })

  it('노출 시작이 끝보다 늦으면 저장하지 않는다', async () => {
    serve([])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배너 올리기' }))
    const dialog = screen.getByRole('dialog', { name: '배너 올리기' })
    await userEvent.type(within(dialog).getByLabelText('제목'), '제목')
    await userEvent.type(within(dialog).getByLabelText('노출 시작 (선택)'), '2026-11-20T00:00')
    await userEvent.type(within(dialog).getByLabelText('노출 끝 (선택)'), '2026-11-15T00:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
    expect(await within(dialog).findByText('노출 시작은 끝보다 빨라야 해요')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('고치기는 지금 값을 채우고 순서는 그대로 PUT, 서버가 공지가 없다고 하면 알린다', async () => {
    serve([banner(1, { sortOrder: 3, visible: false, noticeId: 99, noticeTitle: '지난 공지' })])
    put.mockRejectedValueOnce(errorWith('NOTICE_NOT_FOUND', 404))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배너 1 고치기' }))
    const dialog = screen.getByRole('dialog', { name: '배너 고치기' })
    expect(within(dialog).getByLabelText('제목')).toHaveValue('배너 1')
    expect(within(dialog).getByRole('checkbox', { name: '홈에 보이기' })).not.toBeChecked()
    // 최근 공지 목록 밖의 지금 연결 공지도 고를 수 있게 남긴다
    expect(await within(dialog).findByRole('option', { name: '지난 공지' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        '/admin/banners/1',
        expect.objectContaining({ sortOrder: 3, visible: false, noticeId: 99 }),
      ),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('연결할 공지가 없어요')
  })

  it('지우기는 한 번 더 묻고 DELETE 한다', async () => {
    serve([banner(1)])
    del.mockResolvedValue({ data: null })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배너 1 지우기' }))
    expect(del).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '정말 지우기' }))
    expect(del).toHaveBeenCalledWith('/admin/banners/1')
  })
})
