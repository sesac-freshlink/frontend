import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { CustomerOrderSummary, Order } from './api'
import { PendingOrderDialog } from './components/PendingOrderDialog'
import { type BuyNowRequest, PENDING_CANCEL_FAILED_MESSAGE, useBuyNow } from './useBuyNow'

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

const ramen: BuyNowRequest = {
  storeId: 1,
  storeName: '프레시 강남점',
  productId: 15,
  quantity: 2,
}

const pendingRow: CustomerOrderSummary = {
  orderId: 45,
  orderNo: 'FL-20261112-000045',
  status: 'PAYMENT_WAITING',
  failureReason: null,
  storeName: '프레시 강남점',
  productName: '매운 컵라면 115g',
  quantity: 2,
  amount: 3000,
  createdAt: '2026-11-12T13:00:00+09:00',
  pickupDeadline: null,
  refundStatus: 'NONE',
}

function pendingOrder(overrides: Partial<Order> = {}): Order {
  return {
    orderId: 45,
    orderNo: 'FL-20261112-000045',
    status: 'PAYMENT_WAITING',
    storeId: 1,
    storeName: '프레시 강남점',
    productId: 15,
    productName: '매운 컵라면 115g',
    quantity: 2,
    amount: 3000,
    paymentExpiresAt: '2026-11-12T13:10:00+09:00',
    serverTime: '2026-11-12T13:03:00+09:00',
    ...overrides,
  } as Order
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

/** 주문 내역(최신 10개)·주문 상세 응답을 정한다 */
function serve(rows: CustomerOrderSummary[], detail: Order = pendingOrder()) {
  get.mockImplementation(async (url: string) => {
    if (url === '/orders') return { data: { content: rows, page: 0, size: 10 } }
    if (url === `/orders/${detail.orderId}`) return { data: detail }
    throw new Error(`unexpected ${url}`)
  })
}

function Buy({ request }: { request: BuyNowRequest }) {
  const buyNow = useBuyNow()
  return (
    <>
      <button type="button" onClick={() => void buyNow.buy(request)}>
        구매하기
      </button>
      {buyNow.pendingDialog && <PendingOrderDialog {...buyNow.pendingDialog} />}
    </>
  )
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderBuy(request: BuyNowRequest = ramen) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/product', element: <Buy request={request} /> },
      { path: '/customer/orders/:id', element: <Where /> },
    ],
    { initialEntries: ['/product'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('결제하지 않은 주문 안내 (11/12)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    vi.mocked(toast.error).mockReset()
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('같은 점포·같은 상품의 결제 대기가 없으면 안내 없이 바로 주문한다', async () => {
    serve([{ ...pendingRow, status: 'PAID' }])
    post.mockResolvedValue({ data: { orderId: 46 } })
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/orders/46')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('다른 상품의 결제 대기면 묻지 않는다', async () => {
    serve([pendingRow], pendingOrder({ productId: 99 }))
    post.mockResolvedValue({ data: { orderId: 46 } })
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/orders/46')
  })

  it('있으면 상품·수량·금액·남은 시간과 함께 묻고, [이어서 결제하기]는 그 주문으로 간다', async () => {
    serve([pendingRow])
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))

    const dialog = await screen.findByRole('dialog', { name: '결제하지 않은 주문이 있어요' })
    expect(dialog).toHaveTextContent('매운 컵라면 115g 2개')
    expect(dialog).toHaveTextContent('3,000원')
    expect(dialog).toHaveTextContent(/자동 취소까지 \d+분 \d+초 남음/)

    await userEvent.click(screen.getByRole('button', { name: '이어서 결제하기' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/orders/45')
    expect(post).not.toHaveBeenCalled()
  })

  it('[새로 주문하기]는 앞 주문을 결제 전 취소한 뒤 새 주문을 만든다', async () => {
    serve([pendingRow])
    post.mockImplementation(async (url: string) =>
      url === '/orders/45/payment/cancel' ? { data: {} } : { data: { orderId: 46 } },
    )
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    await userEvent.click(await screen.findByRole('button', { name: '새로 주문하기' }))

    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/orders/46')
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/orders/45/payment/cancel', '/orders'])
  })

  it('앞 주문 취소가 안 되면 새 주문을 만들지 않고 알린다', async () => {
    serve([pendingRow])
    post.mockRejectedValue(errorWith('ORDER_NOT_CANCELABLE'))
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    await userEvent.click(await screen.findByRole('button', { name: '새로 주문하기' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(PENDING_CANCEL_FAILED_MESSAGE))
    expect(post).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()
  })

  it('선착순 상품이면 [새로 주문하기] 없이 [이어서 결제하기]·[닫기]만 보인다', async () => {
    serve([pendingRow])
    renderBuy({ ...ramen, quantity: 1, firstCome: true })
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: '새로 주문하기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이어서 결제하기' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    // 닫으면 [구매하기]로 포커스가 돌아온다
    expect(screen.getByRole('button', { name: '구매하기' })).toHaveFocus()
  })

  it('결제 대기 확인에 실패하면 막지 않고 바로 주문한다', async () => {
    get.mockRejectedValue(new Error('network'))
    post.mockResolvedValue({ data: { orderId: 46 } })
    renderBuy()
    await userEvent.click(screen.getByRole('button', { name: '구매하기' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/customer/orders/46')
  })
})
