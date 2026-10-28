import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { OwnerOrdersPage } from './OwnerOrdersPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <OwnerOrdersPage />
    </QueryClientProvider>,
  )
}

describe('점주 신규 주문 목록 (S-50)', () => {
  beforeEach(() => get.mockReset())

  it('결제 완료 주문을 보여 주고 [새로 고침]으로 다시 읽는다', async () => {
    get.mockResolvedValue({
      data: [
        {
          orderId: 123,
          orderNo: 'FL-20261020-000123',
          productName: '매운 컵라면 115g',
          quantity: 2,
          amount: 3400,
          paidAt: '2026-10-20T15:35:10+09:00',
          payment: null,
        },
      ],
    })
    renderPage()

    expect(await screen.findByText('FL-20261020-000123')).toBeInTheDocument()
    expect(screen.getByText('3,400원')).toBeInTheDocument()
    expect(screen.getByText('10/20 15:35')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/orders')

    await userEvent.click(screen.getByRole('button', { name: '새로 고침' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })

  it('주문마다 결제 수단·결제 시각·영수증 보기를 보여 주고, 영수증이 없으면 링크만 숨긴다', async () => {
    const payment = {
      method: '카드',
      approvedAt: '2026-10-20T15:35:10+09:00',
      status: 'DONE' as const,
      receiptUrl: 'https://receipt.test/1',
    }
    const row = {
      productName: '매운 컵라면 115g',
      quantity: 2,
      amount: 3400,
      paidAt: '2026-10-20T15:35:10+09:00',
    }
    get.mockResolvedValue({
      data: [
        { ...row, orderId: 1, orderNo: 'FL-20261020-000001', payment },
        {
          ...row,
          orderId: 2,
          orderNo: 'FL-20261020-000002',
          payment: { ...payment, method: '간편결제', receiptUrl: null },
        },
      ],
    })
    renderPage()

    expect(await screen.findByText('FL-20261020-000001')).toBeInTheDocument()
    expect(screen.getByText('카드')).toBeInTheDocument()
    expect(screen.getByText('간편결제')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: '영수증 보기' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://receipt.test/1')
  })

  it('주문이 없으면 안내한다', async () => {
    get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('아직 들어온 주문이 없어요.')).toBeInTheDocument()
  })
})
