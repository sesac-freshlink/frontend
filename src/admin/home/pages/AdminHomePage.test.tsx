import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminStore, PageResponse } from '@/admin/stores/api'
import type { BoardPage, FaqItem, NoticeSummary } from '@/board/api'
import type { AdminBanner } from '@/board/banners'
import { api } from '@/shared/api/client'
import { AdminHomePage } from './AdminHomePage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const store = (id: number, status: AdminStore['status']): AdminStore => ({
  storeId: id,
  storeCode: `S${id}`,
  name: `프레시 ${id}호점`,
  address: `테스트시 ${id}번길`,
  region: 'SEOUL',
  status,
  ownerEmail: status === 'PENDING' ? null : `owner${id}@test.com`,
  createdAt: `2026-10-${String(id).padStart(2, '0')}T09:00:00+09:00`,
  latitude: null,
  longitude: null,
  description: null,
  imageUrl: null,
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

interface Data {
  stores: PageResponse<AdminStore>
  banners: AdminBanner[]
  notices: BoardPage<NoticeSummary>
  faqs: FaqItem[]
}

function mockApi(d: Data) {
  get.mockImplementation((url: string) => {
    const body: Record<string, unknown> = {
      '/admin/stores': d.stores,
      '/admin/banners': d.banners,
      '/admin/notices': d.notices,
      '/admin/faqs': d.faqs,
    }
    return Promise.resolve({ data: body[url] })
  })
}

const full: Data = {
  stores: {
    content: [store(21, 'ACTIVE'), store(20, 'PENDING'), store(19, 'INACTIVE')],
    page: 0,
    size: 20,
    totalElements: 21,
    totalPages: 2,
  },
  banners: [
    banner(1),
    banner(2, { visible: false }),
    banner(3, { endsAt: '2026-01-01T00:00:00+09:00' }),
  ],
  notices: {
    content: [
      {
        noticeId: 1,
        title: '서비스 시작',
        audience: 'ALL',
        pinned: true,
        createdAt: '2026-11-01T09:00:00+09:00',
      },
    ],
    page: 0,
    size: 20,
    totalElements: 7,
    totalPages: 1,
  },
  faqs: [
    { faqId: 1, question: '픽업은?', answer: '23시까지', audience: 'ALL', sortOrder: 0 },
    { faqId: 2, question: '환불은?', answer: '자동', audience: 'ALL', sortOrder: 1 },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/admin', element: <AdminHomePage /> }], {
    initialEntries: ['/admin'],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** 숫자 칸(dt 라벨) 하나의 글자 */
const stat = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).parentElement?.textContent

describe('관리자 홈', () => {
  beforeEach(() => get.mockReset())

  it('숫자 4칸: 전체 점포·등록 중(최근 20개 기준)·고객 홈 배너·공지사항', async () => {
    mockApi(full)
    renderPage()
    await screen.findByText('프레시 21호점')
    expect(stat('전체 점포')).toBe('전체 점포21운영 중단 1')
    expect(stat('등록 중 점포')).toBe('등록 중 점포1최근 등록 20개 기준')
    expect(stat('고객 홈 배너')).toBe('고객 홈 배너1 / 5노출 끝 1')
    expect(stat('공지사항')).toBe('공지사항7자주 묻는 질문 2')
  })

  it('최근 등록 점포는 상태 배지·점포명·시도·등록일, 배너는 순서·제목·홈 노출 상태', async () => {
    mockApi(full)
    renderPage()
    await screen.findByText('프레시 21호점')
    await screen.findByText('배너 1')
    const stores = (await screen.findByRole('heading', { name: /최근 등록 점포/ })).closest(
      'section',
    )!
    expect(
      within(stores)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '운영 중프레시 21호점서울특별시10.21',
      '등록 중프레시 20호점서울특별시10.20',
      '운영 중단프레시 19호점서울특별시10.19',
    ])
    const banners = screen.getByRole('heading', { name: /메인배너 지금 상태/ }).closest('section')!
    expect(
      within(banners)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1배너 1홈에 보여요', '2배너 2꺼 둠', '3배너 3노출 끝'])
    expect(screen.getByRole('link', { name: '최근 등록 점포 점포 목록' })).toHaveAttribute(
      'href',
      '/admin/stores',
    )
  })

  it('홈에 보이는 배너가 없으면 로즈로 알리고, 목록이 비면 어디서 만드는지 안내한다', async () => {
    mockApi({
      stores: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      banners: [],
      notices: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      faqs: [],
    })
    renderPage()
    expect(await screen.findByText('홈에 보이는 배너가 없어요')).toHaveClass('text-rose-700')
    expect(
      screen.getByText('등록된 점포가 없어요. 점포 등록에서 만들 수 있어요.'),
    ).toBeInTheDocument()
    expect(screen.getByText('올린 배너가 없어요. 메인배너에서 올릴 수 있어요.')).toBeInTheDocument()
    expect(screen.getByText('올린 공지가 없어요. 공지사항에서 쓸 수 있어요.')).toBeInTheDocument()
  })
})
