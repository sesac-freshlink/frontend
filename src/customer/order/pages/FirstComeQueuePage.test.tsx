import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { QueueStatusResponse } from '../api'
import { FirstComeQueuePage } from './FirstComeQueuePage'

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const del = vi.mocked(api.delete)

const QUERY =
  'storeId=1&storeName=%ED%94%84%EB%A0%88%EC%8B%9C+%EA%B0%95%EB%82%A8%EC%A0%90&productId=3' +
  '&productName=%EC%83%8C%EB%93%9C%EC%9C%84%EC%B9%98+%ED%96%84%EC%B9%98%EC%A6%88&price=3200'
const QUEUE_PATH = `/customer/stores/1/products/3/queue?${QUERY}`

const waiting: QueueStatusResponse = {
  storeId: 1,
  productId: 3,
  status: 'WAITING',
  position: 4,
  ahead: 3,
  waiting: 120,
  remaining: 2,
  ticketExpiresAt: null,
  serverTime: '2026-11-02T10:00:00+09:00',
}

function errorWith(code: string, status = 409) {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', String(status), { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data: { code, message: '', traceId: 't' },
  })
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        path: '/customer/stores/:storeId/products/:productId/queue',
        element: <FirstComeQueuePage />,
      },
      { path: '/customer/stores/:storeId/products/:productId', element: <Where /> },
      { path: '/customer/orders/:id', element: <Where /> },
      { path: '/customer/orders', element: <p>주문 내역</p> },
      { path: '/customer', element: <p>고객 홈</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('선착순 대기 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    post.mockResolvedValue({ data: waiting })
    get.mockResolvedValue({ data: waiting })
    del.mockResolvedValue({ data: null })
  })

  it('들어오면 줄을 서고 내 순번·앞사람·남은 수량·기다리는 사람을 보여 준다', async () => {
    renderAt(QUEUE_PATH)
    expect(await screen.findByText('4번째')).toBeInTheDocument()
    expect(screen.getByText('3명')).toBeInTheDocument()
    expect(screen.getByText('2개')).toBeInTheDocument()
    expect(screen.getByText('120명')).toBeInTheDocument()
    expect(screen.getByText('샌드위치 햄치즈')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/orders/queue/3', null, { params: { storeId: 1 } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/orders/queue/3/me', { params: { storeId: 1 } }),
    )
  })

  it('차례가 오면 수량을 1개로 묶은 주문 화면으로 간다', async () => {
    get.mockResolvedValue({
      data: {
        ...waiting,
        status: 'ADMITTED',
        position: null,
        ahead: null,
        ticketExpiresAt: '2026-11-02T10:05:00+09:00',
      },
    })
    renderAt(QUEUE_PATH)
    const where = await screen.findByTestId('where')
    expect(where.textContent).toMatch(/^\/customer\/orders\/new\?/)
    expect(where.textContent).toContain('available=1')
    expect(where.textContent).toContain('productId=3')
  })

  it('선착순이 아닌 상품이면(404 NOT_FIRST_COME) 바로 주문 화면으로 간다', async () => {
    post.mockRejectedValue(errorWith('NOT_FIRST_COME', 404))
    renderAt(QUEUE_PATH)
    const where = await screen.findByTestId('where')
    expect(where.textContent).toMatch(/^\/customer\/orders\/new\?/)
    expect(where.textContent).not.toContain('available=1')
  })

  it('이미 주문한 선착순 상품이면 이유와 주문 내역 링크를 보여 준다', async () => {
    post.mockRejectedValue(errorWith('FIRST_COME_ALREADY_ORDERED'))
    renderAt(QUEUE_PATH)
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 주문한 선착순 상품이에요')
    expect(screen.getByRole('link', { name: '주문 내역 보기' })).toBeInTheDocument()
  })

  it('대기열을 쓸 수 없으면 다시 줄 서기를 보여 준다', async () => {
    post.mockRejectedValueOnce(errorWith('FIRST_COME_UNAVAILABLE', 503))
    renderAt(QUEUE_PATH)
    await userEvent.click(await screen.findByRole('button', { name: '다시 줄 서기' }))
    expect(await screen.findByText('4번째')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('그만 기다리기를 누르면 줄에서 빠지고 상품으로 돌아간다', async () => {
    renderAt(QUEUE_PATH)
    await userEvent.click(await screen.findByRole('button', { name: '그만 기다리기' }))
    expect(del).toHaveBeenCalledWith('/orders/queue/3/me', { params: { storeId: 1 } })
    expect((await screen.findByTestId('where')).textContent).toBe('/customer/stores/1/products/3')
  })

  it('줄에서 빠졌으면 안내와 다시 줄 서기를 보여 준다', async () => {
    get.mockResolvedValue({
      data: { ...waiting, status: 'NOT_IN_QUEUE', position: null, ahead: null },
    })
    renderAt(QUEUE_PATH)
    expect(await screen.findByText('줄에서 빠졌어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 줄 서기' })).toBeInTheDocument()
  })

  it('남은 수량이 0이면 품절 안내를 보여 준다', async () => {
    get.mockResolvedValue({
      data: { ...waiting, status: 'SOLD_OUT', remaining: 0 },
    })
    renderAt(QUEUE_PATH)
    expect(await screen.findByText('준비한 수량이 모두 나갔어요')).toBeInTheDocument()
  })

  it('주소에 상품 정보가 없으면 줄을 서지 않고 안내한다', async () => {
    renderAt('/customer/stores/1/products/3/queue')
    expect(await screen.findByText(/상품 정보를 찾을 수 없어요/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
})
