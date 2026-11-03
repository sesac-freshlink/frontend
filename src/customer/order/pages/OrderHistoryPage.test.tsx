import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { CustomerOrderSummary } from '../api'
import { OrderHistoryPage } from './OrderHistoryPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)

const paid: CustomerOrderSummary = {
  orderId: 123,
  orderNo: 'FL-20261020-000123',
  status: 'PAID',
  failureReason: null,
  storeName: '프레시 강남점',
  productName: '매운 컵라면 115g',
  quantity: 2,
  amount: 3400,
  createdAt: '2026-10-20T15:30:00+09:00',
  pickupDeadline: '2026-10-22T23:59:59+09:00',
  refundStatus: 'NONE',
}

/** A3 페이지 응답 한 장 */
function pageOf(
  content: CustomerOrderSummary[],
  extra: { page?: number; size?: number; totalPages?: number } = {},
) {
  return {
    data: {
      content,
      page: extra.page ?? 0,
      size: extra.size ?? 20,
      totalElements: content.length,
      totalPages: extra.totalPages ?? 1,
    },
  }
}

/** 마지막 목록 요청의 쿼리 */
function lastParams() {
  return get.mock.lastCall?.[1]?.params as Record<string, unknown> | undefined
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/orders', element: <OrderHistoryPage /> },
      { path: '/customer/orders/:id', element: <p>주문 상세</p> },
    ],
    { initialEntries: ['/customer/orders'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('고객 주문 내역 (A3)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('처음에는 전체 구분을 20개씩 읽고 주문번호·점포·상품·수량·금액·상태·주문일시를 보여 준다', async () => {
    get.mockResolvedValue(pageOf([paid]))
    renderPage()

    expect(await screen.findByText('FL-20261020-000123')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/orders', { params: { tab: 'ALL', page: 0, size: 20 } })
    expect(screen.getByRole('tab', { name: '전체' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('list')).getByText('픽업 대기')).toBeInTheDocument()
    expect(screen.getByText('매운 컵라면 115g · 2개')).toBeInTheDocument()
    expect(screen.getByText('프레시 강남점 · 10/20 15:30')).toBeInTheDocument()
    expect(screen.getByText('10월 22일(목)까지 픽업')).toBeInTheDocument()
    expect(screen.getByText('3,400원')).toBeInTheDocument()
  })

  it('주문 확인 중 주문은 "예약" 없이 "주문 확인 중"으로 보여 준다', async () => {
    get.mockResolvedValue(
      pageOf([
        {
          ...paid,
          status: 'RESERVING',
          productName: null,
          amount: null,
          pickupDeadline: null,
        },
      ]),
    )
    renderPage()
    expect(await screen.findByText('주문 확인 중')).toBeInTheDocument()
    expect(screen.getByText('상품 확인 중 · 2개')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('예약')
  })

  it('구분을 바꾸면 그 구분으로 다시 읽고, 비어 있으면 구분에 맞는 문구를 보여 준다', async () => {
    get.mockResolvedValue(pageOf([paid]))
    renderPage()
    await screen.findByText('FL-20261020-000123')

    get.mockResolvedValue(pageOf([]))
    await userEvent.click(screen.getByRole('tab', { name: '취소·환불' }))
    expect(await screen.findByText('취소·환불된 주문이 없어요.')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'CANCELED', page: 0, size: 20 })
    expect(screen.getByRole('tab', { name: '취소·환불' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: '픽업 완료' }))
    expect(await screen.findByText('픽업한 주문이 없어요.')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'PICKED_UP', page: 0, size: 20 })

    await userEvent.click(screen.getByRole('tab', { name: '픽업 대기' }))
    expect(await screen.findByText('픽업을 기다리는 주문이 없어요.')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'PICKUP_WAITING', page: 0, size: 20 })
  })

  it('줄을 누르면 주문 상세로 간다', async () => {
    get.mockResolvedValue(pageOf([paid]))
    const router = renderPage()
    await userEvent.click(await screen.findByRole('link', { name: /FL-20261020-000123/ }))
    expect(await screen.findByText('주문 상세')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/customer/orders/123')
  })

  it('기간을 고르면 from·to 를 같이 보내고 첫 페이지로 돌아가며, [기간 지우기]로 뺀다', async () => {
    get.mockResolvedValue(pageOf([paid], { totalPages: 2 }))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    expect(screen.getByRole('button', { name: '기간 지우기' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1 }))

    get.mockResolvedValue(pageOf([]))
    fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('끝 날짜'), { target: { value: '2026-10-15' } })
    await waitFor(() =>
      expect(lastParams()).toEqual({
        tab: 'ALL',
        page: 0,
        size: 20,
        from: '2026-10-01',
        to: '2026-10-15',
      }),
    )
    expect(await screen.findByText('고른 기간에 해당하는 주문이 없어요.')).toBeInTheDocument()

    get.mockResolvedValue(pageOf([paid]))
    await userEvent.click(screen.getByRole('button', { name: '기간 지우기' }))
    await waitFor(() => expect(lastParams()).toEqual({ tab: 'ALL', page: 0, size: 20 }))
    expect(await screen.findByText('FL-20261020-000123')).toBeInTheDocument()
  })

  it('시작 날짜가 끝 날짜보다 늦으면 빨간 안내만 띄우고 목록을 부르지 않는다', async () => {
    get.mockResolvedValue(pageOf([paid]))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-20' } })
    await waitFor(() => expect(lastParams()).toMatchObject({ from: '2026-10-20' }))
    const calls = get.mock.calls.length

    fireEvent.change(screen.getByLabelText('끝 날짜'), { target: { value: '2026-10-10' } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('시작 날짜가 끝 날짜보다 늦어요.')
    expect(alert).toHaveClass('text-red-600')
    expect(screen.queryByText('FL-20261020-000123')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(calls)

    // 끝 날짜를 고치면 다시 읽는다
    fireEvent.change(screen.getByLabelText('끝 날짜'), { target: { value: '2026-10-25' } })
    await waitFor(() => expect(lastParams()).toMatchObject({ to: '2026-10-25' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('한 페이지 개수를 바꾸면 그 개수로 첫 페이지부터 다시 읽는다', async () => {
    get.mockResolvedValue(pageOf([paid], { totalPages: 3 }))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1 }))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '한 페이지에' }), '50')
    await waitFor(() => expect(lastParams()).toEqual({ tab: 'ALL', page: 0, size: 50 }))
  })

  it('[새로 고침]을 누르면 다시 읽고, 실패하면 오류 문구를 보여 준다', async () => {
    get.mockResolvedValueOnce(pageOf([paid])).mockRejectedValue(new Error('network'))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    await userEvent.click(screen.getByRole('button', { name: '새로 고침' }))
    expect(await screen.findByText('주문 내역을 불러오지 못했어요.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('상태 배지는 주문마다 짧은 이름으로 보여 준다', async () => {
    get.mockResolvedValue(
      pageOf([
        { ...paid, orderId: 1, orderNo: 'A-1', status: 'PICKED_UP' },
        {
          ...paid,
          orderId: 2,
          orderNo: 'A-2',
          status: 'EXPIRED',
          failureReason: 'PICKUP_DEADLINE',
        },
        { ...paid, orderId: 3, orderNo: 'A-3', status: 'PICKUP_EXPIRED' },
      ]),
    )
    renderPage()
    const list = await screen.findByRole('list')
    expect(within(list).getByText('픽업 완료')).toBeInTheDocument()
    expect(within(list).getByText('픽업 기한 지나 취소')).toBeInTheDocument()
    expect(within(list).getByText('픽업 기한 지남')).toBeInTheDocument()
    // 픽업 기한 안내는 픽업 대기(PAID) 주문에만 붙는다
    expect(within(list).queryByText(/까지 픽업/)).not.toBeInTheDocument()
  })
})
