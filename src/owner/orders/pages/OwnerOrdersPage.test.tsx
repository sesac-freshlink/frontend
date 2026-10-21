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

  it('주문이 없으면 안내한다', async () => {
    get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('아직 들어온 주문이 없어요.')).toBeInTheDocument()
  })
})
