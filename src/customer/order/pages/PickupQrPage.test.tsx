import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { PickupQrPage } from './PickupQrPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
// jsdom 에는 canvas 가 없어 QR 그림은 흉내 낸다. 넣은 주소만 확인한다
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

const pass = {
  token: 'tok',
  code: '482193',
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  orderCount: 1,
}
const waiting = {
  content: [
    {
      orderId: 7,
      orderNo: 'FL-7',
      status: 'READY_FOR_PICKUP',
      failureReason: null,
      storeName: '프레시 강남점',
      productName: '매운 컵라면 115g',
      quantity: 2,
      amount: 3400,
      createdAt: '2026-11-06T14:00:00+09:00',
      pickupDeadline: null,
      refundStatus: 'NONE',
    },
  ],
  page: 0,
  size: 50,
  totalElements: 1,
  totalPages: 1,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PickupQrPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: waiting })
})

describe('PickupQrPage (/customer/orders/pickup-qr, A16)', () => {
  it('QR·6자리 코드·남은 시간과 받아 갈 주문을 보여 준다', async () => {
    post.mockResolvedValue({ data: pass })
    renderPage()
    expect(await screen.findByRole('img', { name: '픽업 QR' })).toHaveAttribute(
      'src',
      'data:image/png;base64,QR',
    )
    expect(screen.getByText('482193')).toBeInTheDocument()
    expect(screen.getByText(/남음/)).toBeInTheDocument()
    expect(await screen.findByText(/프레시 강남점 · 매운 컵라면 115g 2개/)).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/orders/pickup-pass')
    const QRCode = (await import('qrcode')).default
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      `${window.location.origin}/owner/pickup-scan?t=tok`,
      expect.anything(),
    )
  })

  it('받아 갈 주문이 없으면(409) 안내만', async () => {
    post.mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { code: 'NO_PICKUP_WAITING_ORDER', message: 'x' } },
      }),
    )
    renderPage()
    expect(await screen.findByText('받아 갈 주문이 없어요.')).toBeInTheDocument()
    // 다음에 할 일: 주문 내역으로 가는 길을 준다
    expect(screen.getByRole('link', { name: '주문 내역 보기' })).toHaveAttribute(
      'href',
      '/customer/orders',
    )
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: '픽업 QR' })).not.toBeInTheDocument(),
    )
  })
})
