import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { Order } from '../api'
import { PICKUP_REQUEST_NOTICE } from '../pickupRequest'
import { OrderDetailPage } from './OrderDetailPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. OrderCancel.test 와 같은 방식으로 흉내 낸다 ([픽업 신청] 확인 창)
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const originalShowModal = dialogProto.showModal
const originalClose = dialogProto.close

beforeAll(() => {
  if (!originalShowModal) {
    dialogProto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (!originalClose) {
    dialogProto.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      setTimeout(() => this.dispatchEvent(new Event('close')), 0)
    }
  }
})

afterAll(() => {
  dialogProto.showModal = originalShowModal
  dialogProto.close = originalClose
})

const base: Order = {
  orderId: 123,
  orderNo: 'FL-20261020-000123',
  status: 'PAYMENT_WAITING',
  failureReason: null,
  storeId: 1,
  storeName: '프레시 강남점',
  productId: 15,
  productName: '매운 컵라면 115g',
  quantity: 2,
  unitPrice: 1700,
  amount: 3400,
  paymentExpiresAt: '2026-10-20T15:42:00+09:00',
  paidAt: null,
  createdAt: '2026-10-20T15:31:55+09:00',
  pickupDeadline: null,
  pickedUpAt: null,
  payment: null,
  refundStatus: 'NONE',
  refund: null,
  // 결제 마감 15:42 의 7분 30초 전. 기기 시계와 상관없이 이 값 기준으로 센다
  serverTime: '2026-10-20T15:34:30+09:00',
}

const paidPayment = {
  method: '카드',
  approvedAt: '2026-10-20T15:35:10+09:00',
  status: 'DONE' as const,
  receiptUrl: 'https://dashboard.tosspayments.com/receipt/redirection?transactionId=tviva_1',
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/orders/:id', element: <OrderDetailPage /> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록</p> },
      { path: '/customer/stores/:storeId/products/:productId', element: <p>상품 상세</p> },
      { path: '/customer', element: <p>고객 홈</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function orderReturns(...orders: Partial<Order>[]) {
  for (const o of orders) get.mockResolvedValueOnce({ data: { ...base, ...o } })
  // 그 뒤 폴링은 마지막 상태를 계속 돌려준다
  get.mockResolvedValue({ data: { ...base, ...orders.at(-1) } })
}

describe('주문 상세 (U-22·U-31)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('주문 확인 중에는 로딩 문구만 보여 준다', async () => {
    orderReturns({ status: 'RESERVING', productName: null, amount: null, unitPrice: null })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('주문을 확인하고 있어요')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/orders/123')
  })

  it('위에 주문 내역으로 돌아가는 링크가 있다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING' })
    renderAt('/customer/orders/123')
    expect(await screen.findByRole('link', { name: '주문 내역' })).toHaveAttribute(
      'href',
      '/customer/orders',
    )
  })

  it('결제 대기면 결제 수단과 10분 안내를 보여 준다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING' })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('결제 대기')).toBeInTheDocument()
    expect(screen.getByText(/10분 안에 결제하지 않으면 주문이 취소돼요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3,400원 결제하기' })).toBeInTheDocument()
  })

  it('토스 성공 URL 로 돌아오면 OR-03 을 한 번만 부르고 주소에서 토스 쿼리를 지운다', async () => {
    orderReturns(
      { status: 'PAYMENT_WAITING' },
      { status: 'PAID', paidAt: '2026-10-20T15:35:10+09:00' },
    )
    post.mockResolvedValue({ data: { ...base, status: 'PAID' } })
    const router = renderAt(
      '/customer/orders/123?paymentType=NORMAL&orderId=FL-20261020-000123&paymentKey=tgen_1&amount=3400',
    )

    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/orders/123/payment/confirm', {
      paymentKey: 'tgen_1',
      orderNo: 'FL-20261020-000123',
      amount: 3400,
    })
    expect(router.state.location.search).toBe('')
    expect(screen.getByText('FL-20261020-000123')).toBeInTheDocument()
  })

  it('토스 실패 URL 로 돌아오면 자동 취소 시각을 알려 주고 다시 결제할 수 있다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING' })
    renderAt('/customer/orders/123?code=PAY_PROCESS_CANCELED&message=x&orderId=FL-20261020-000123')
    expect(
      await screen.findByText('결제가 완료되지 않았어요. 이 주문은 15:42에 자동 취소됩니다.'),
    ).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '3,400원 결제하기' })).toBeInTheDocument()
  })

  it('토스 실패 URL 로 돌아와도 서버가 결제 완료면 서버 상태대로 보여 주고 덮어쓰지 않는다', async () => {
    orderReturns({ status: 'PAID', paidAt: '2026-10-20T15:35:10+09:00' })
    renderAt('/customer/orders/123?code=PAY_PROCESS_CANCELED&message=x&orderId=FL-20261020-000123')
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.queryByText(/결제가 완료되지 않았어요/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /결제하기/ })).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('재고 부족으로 끝나면 사유 문구와 상품으로 돌아가기를 보여 준다', async () => {
    orderReturns({ status: 'OUT_OF_STOCK', failureReason: 'OUT_OF_STOCK', amount: null })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('재고가 부족해 주문이 취소됐어요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '상품으로 돌아가기' }))
    expect(await screen.findByText('상품 목록')).toBeInTheDocument()
  })

  it('결제 대기면 서버 시각 기준 남은 시간을 보여 주고 결제 내역은 없다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING' })
    renderAt('/customer/orders/123')
    // 기기 시계가 몇 시든 serverTime 15:34:30 → 마감 15:42:00 = 7분 30초 (렌더 사이 1초 흐를 수 있음)
    expect(await screen.findByRole('timer')).toHaveTextContent(/^7분 (30|29)초 남음$/)
    expect(screen.queryByText('영수증 보기')).not.toBeInTheDocument()
    expect(screen.queryByText('결제 수단')).not.toBeInTheDocument()
  })

  it('남은 시간이 0이면 결제 시간이 끝났다고 하고 결제 버튼을 막는다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING', serverTime: '2026-10-20T15:42:05+09:00' })
    renderAt('/customer/orders/123')
    expect(await screen.findByRole('timer')).toHaveTextContent('결제 시간이 끝났어요')
    expect(screen.queryByRole('button', { name: /결제하기/ })).not.toBeInTheDocument()
  })

  it('결제 완료면 결제 수단·결제 시각·영수증 보기를 보여 준다', async () => {
    orderReturns({ status: 'PAID', paidAt: '2026-10-20T15:35:10+09:00', payment: paidPayment })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.getByText('결제 수단')).toBeInTheDocument()
    expect(screen.getByText('카드')).toBeInTheDocument()
    expect(screen.getByText('10/20 15:35')).toBeInTheDocument()
    const receipt = screen.getByRole('link', { name: '영수증 보기' })
    expect(receipt).toHaveAttribute('href', paidPayment.receiptUrl)
    expect(receipt).toHaveAttribute('target', '_blank')
    expect(receipt).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('영수증 주소가 없으면 영수증 보기만 숨긴다', async () => {
    orderReturns({
      status: 'PAID',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: { ...paidPayment, receiptUrl: null },
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.getByText('카드')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '영수증 보기' })).not.toBeInTheDocument()
  })

  it('픽업 기한이 있으면 결제 대기 화면에 날짜와 픽업 신청 안내를 보여 준다 (A4)', async () => {
    orderReturns({ status: 'PAYMENT_WAITING', pickupDeadline: '2026-10-22T23:59:59+09:00' })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('픽업 기한')).toBeInTheDocument()
    expect(screen.getByText('10월 22일(목)까지')).toBeInTheDocument()
    expect(screen.getByText(PICKUP_REQUEST_NOTICE)).toBeInTheDocument()
  })

  it('픽업 기한이 없으면(서버가 아직 안 줌) 기한 줄과 안내를 숨긴다', async () => {
    orderReturns({ status: 'PAYMENT_WAITING' })
    renderAt('/customer/orders/123')
    expect(await screen.findByRole('timer')).toBeInTheDocument()
    expect(screen.queryByText('픽업 기한')).not.toBeInTheDocument()
    expect(screen.queryByText(PICKUP_REQUEST_NOTICE)).not.toBeInTheDocument()
  })

  it('결제 완료 화면에도 픽업 기한을 보여 준다 (A4)', async () => {
    orderReturns({
      status: 'PAID',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-22T23:59:59+09:00',
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.getByText('10월 22일(목)까지')).toBeInTheDocument()
    // 신청 전에는 같은 말을 두 번 하지 않고 픽업 안내 한 줄만 보인다
    expect(screen.queryByText('픽업 신청을 하면 매장에서 준비해요')).not.toBeInTheDocument()
    expect(screen.getByText(PICKUP_REQUEST_NOTICE)).toBeInTheDocument()
  })

  it('결제 완료 화면의 [픽업 신청]은 한 번 더 묻고, 확인하면 신청 API 를 부른다', async () => {
    orderReturns({
      status: 'PAID',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-22T23:59:59+09:00',
    })
    post.mockResolvedValue({ data: {} })
    renderAt('/customer/orders/123')
    await userEvent.click(await screen.findByRole('button', { name: '픽업 신청' }))
    expect(screen.getByRole('dialog', { name: '픽업 신청할까요?' })).toBeInTheDocument()
    expect(screen.getByText('오늘 23시 59분까지 받아 가셔야 해요')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '픽업 신청' }))
    expect(post).toHaveBeenCalledWith('/orders/123/pickup-request')
  })

  it('픽업 기한이 지났거나 환불이 시작된 결제 완료 주문에는 [픽업 신청]이 없다', async () => {
    orderReturns({
      status: 'PAID',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-20T10:00:00+09:00',
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '픽업 신청' })).not.toBeInTheDocument()
  })

  it('픽업 신청 화면은 신청됨을 보여 주고 [픽업 신청] 없이 [주문 취소]는 남는다', async () => {
    orderReturns({
      status: 'PICKUP_REQUESTED',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-20T23:59:59+09:00',
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByRole('heading', { name: '픽업 신청됨' })).toBeInTheDocument()
    expect(
      screen.getByText('오늘 받아 가실 수 있게 준비해요. 준비되면 알려 드려요'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '픽업 신청' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '주문 취소' })).toBeInTheDocument()
  })

  it('준비 완료 화면은 취소 안내 대신 기한이 지나면 받아 갈 수 없고 환불도 안 된다고 알린다', async () => {
    orderReturns({
      status: 'READY_FOR_PICKUP',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-22T23:59:59+09:00',
    })
    renderAt('/customer/orders/123')
    expect(
      await screen.findByText('픽업 기한이 지나면 받아 갈 수 없고 환불도 되지 않아요'),
    ).toBeInTheDocument()
    expect(screen.queryByText('픽업 기한이 지나면 취소·환불할 수 없어요')).not.toBeInTheDocument()
  })

  it('픽업 완료면 픽업 시각을 보여 주고 폴링하지 않는다 (A5)', async () => {
    orderReturns({
      status: 'PICKED_UP',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-22T23:59:59+09:00',
      pickedUpAt: '2026-10-21T10:05:00+09:00',
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByRole('heading', { name: '픽업 완료' })).toBeInTheDocument()
    expect(screen.getByText('픽업 시각')).toBeInTheDocument()
    expect(screen.getByText('10/21 10:05')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('결제 뒤 픽업 기한이 지나면 결제 금액은 그대로, 환불 금액 0원을 보여 준다 (A4)', async () => {
    orderReturns({
      status: 'PICKUP_EXPIRED',
      paidAt: '2026-10-20T15:35:10+09:00',
      payment: paidPayment,
      pickupDeadline: '2026-10-22T23:59:59+09:00',
    })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('픽업 기한이 지났어요')).toBeInTheDocument()
    expect(screen.getByText('3,400원')).toBeInTheDocument()
    expect(screen.getByText('환불금액')).toBeInTheDocument()
    expect(screen.getByText('0원')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '상품으로 돌아가기' })).toBeInTheDocument()
  })

  it('결제 전에 픽업 기한이 지나 취소되면 사유 문구를 보여 준다 (A4)', async () => {
    orderReturns({ status: 'EXPIRED', failureReason: 'PICKUP_DEADLINE' })
    renderAt('/customer/orders/123')
    expect(await screen.findByText('픽업 기한이 지나 주문이 취소됐어요')).toBeInTheDocument()
    expect(screen.queryByText('환불 금액')).not.toBeInTheDocument()
  })

  it('다른 고객의 주문(403)이면 찾을 수 없다고 한다', async () => {
    get.mockRejectedValue(
      Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403 } }),
    )
    renderAt('/customer/orders/123')
    expect(await screen.findByText('주문을 찾을 수 없어요.')).toBeInTheDocument()
  })
})

describe('옛 주문·결제 화면 주소 (/customer/orders/new)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('상품 값이 있으면 그 상품 상세로 보내고 주문을 만들지 않는다', async () => {
    const router = renderAt(
      '/customer/orders/new?storeId=1&storeName=%ED%94%84%EB%A0%88%EC%8B%9C&productId=15&productName=x&price=1700',
    )
    expect(await screen.findByText('상품 상세')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/customer/stores/1/products/15')
    expect(router.state.location.state).toEqual({ storeName: '프레시' })
    expect(post).not.toHaveBeenCalled()
  })

  it('상품 값이 없으면 홈으로 보낸다', async () => {
    const router = renderAt('/customer/orders/new')
    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/customer')
  })
})

describe('마감세일 함께 사기', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('결제 대기 상세에 두 줄과 당일 픽업 안내를 보여 준다', async () => {
    orderReturns({
      status: 'PAYMENT_WAITING',
      productName: '꿀밤고구마 800g',
      quantity: 2,
      clearanceQuantity: 1,
      unitPrice: 4990,
      amount: 8480,
      pickupDeadline: '2026-10-20T23:59:59+09:00',
      lines: [
        { clearance: true, quantity: 1, unitPrice: 3490, amount: 3490 },
        { clearance: false, quantity: 1, unitPrice: 4990, amount: 4990 },
      ],
    })
    renderAt('/customer/orders/123')

    expect(await screen.findByText('마감세일 1개 3,490원')).toBeInTheDocument()
    expect(screen.getByText('기본 1개 4,990원')).toBeInTheDocument()
    // 마감세일 안내는 두 줄 (11/11 경우 문구)
    expect(
      screen.getByText(
        '마감 세일 제품은 당일 픽업이 원칙이에요. 오늘 23시 59분까지 픽업해 주세요.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('미픽업 시 환불되지 않으며, 물품은 폐기 처리돼요.')).toBeInTheDocument()
  })

  it('마감세일이 끝나 실패하면 남은 수를 알려 주고 다시 고르기는 상품 상세로 간다', async () => {
    orderReturns({
      status: 'OUT_OF_STOCK',
      failureReason: 'CLEARANCE_SOLD_OUT',
      productId: 31,
      quantity: 2,
      clearanceQuantity: 1,
      productName: null,
      amount: null,
      unitPrice: null,
      availableQuantity: 2,
      clearanceAvailableQuantity: 0,
    })
    const router = renderAt('/customer/orders/123')

    expect(
      await screen.findByText('마감세일이 끝났어요. 기본 상품은 2개 남았어요. 다시 골라 주세요.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '다시 고르기' }))
    expect(router.state.location.pathname).toBe('/customer/stores/1/products/31')
  })
})
