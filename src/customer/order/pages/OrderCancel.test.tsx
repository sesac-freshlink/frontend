import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { Order } from '../api'
import type { RefundInfo } from '../refund'
import { OrderDetailPage } from './OrderDetailPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. OwnerOrdersPage.test 와 같은 방식으로 흉내 낸다
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

const paid: Order = {
  orderId: 123,
  orderNo: 'FL-20261020-000123',
  status: 'PAID',
  failureReason: null,
  storeId: 1,
  storeName: '프레시 강남점',
  productId: 15,
  productName: '매운 컵라면 115g',
  quantity: 2,
  unitPrice: 1700,
  amount: 3400,
  paymentExpiresAt: '2026-10-20T15:42:00+09:00',
  paidAt: '2026-10-20T15:35:10+09:00',
  createdAt: '2026-10-20T15:31:55+09:00',
  pickupDeadline: '2026-10-22T23:59:59+09:00',
  pickedUpAt: null,
  payment: null,
  refundStatus: 'NONE',
  refund: null,
  serverTime: '2026-10-20T16:00:00+09:00',
}

const failedRefund: RefundInfo = {
  requestedBy: 'CUSTOMER',
  reason: 'CHANGE_OF_MIND',
  reasonLabel: '단순 변심',
  reasonDetail: null,
  refundAmount: 3400,
  status: 'FAILED',
  requestedAt: '2026-10-20T16:01:00+09:00',
  canceledAt: null,
}

function renderAt(order: Partial<Order>) {
  get.mockResolvedValue({ data: { ...paid, ...order } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/orders/:id', element: <OrderDetailPage /> },
      { path: '/customer/orders', element: <p>주문 내역</p> },
    ],
    { initialEntries: ['/customer/orders/123'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('주문 취소·환불 (A7·A8·A9)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('A7 결제 대기: 사유 없이 한 번 묻고 결제 전 취소를 부른다', async () => {
    renderAt({
      status: 'PAYMENT_WAITING',
      paidAt: null,
      pickupDeadline: null,
      serverTime: '2026-10-20T15:34:30+09:00',
    })
    post.mockResolvedValue({ data: { ...paid, status: 'CANCELED' } })
    await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
    expect(screen.getByText('주문을 취소하시겠습니까?')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: '주문 취소' }).at(-1)!)
    await waitFor(() => expect(post).toHaveBeenCalledWith('/orders/123/payment/cancel'))
  })

  it('A7 결제 전 취소 화면은 환불금액 0원을 보여 준다', async () => {
    renderAt({ status: 'CANCELED', paidAt: null })
    expect(await screen.findByText('주문을 취소했어요')).toBeInTheDocument()
    expect(screen.getByText('환불금액')).toBeInTheDocument()
    expect(screen.getByText('0원')).toBeInTheDocument()
  })

  it('A8 결제 완료: 사유를 고르지 않으면 넘어가지 않고, 기타는 상세가 필수다', async () => {
    renderAt({})
    await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('alert')).toHaveTextContent('취소 사유를 골라 주세요')
    await userEvent.click(screen.getByRole('radio', { name: '기타' }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('alert')).toHaveTextContent('기타 사유를 입력해 주세요')
    expect(post).not.toHaveBeenCalled()
  })

  it('A8 사유 → 최종 확인 → 전액 환불 요청을 보낸다', async () => {
    renderAt({})
    post.mockResolvedValue({
      data: {
        orderId: 123,
        orderNo: paid.orderNo,
        status: 'REFUNDED',
        refundStatus: 'COMPLETED',
        refund: null,
      },
    })
    await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))
    await userEvent.click(screen.getByRole('radio', { name: '기타' }))
    await userEvent.type(screen.getByLabelText('기타 사유'), '  일정 변경  ')
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText('주문 전체를 취소하고 전액 환불하시겠습니까?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '취소하고 환불' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/orders/123/cancel', {
        reason: 'ETC',
        reasonDetail: '일정 변경',
      }),
    )
  })

  it('픽업 기한이 지나면 주문 취소 버튼이 없다', async () => {
    renderAt({ serverTime: '2026-10-23T00:00:01+09:00' })
    expect(await screen.findByText('결제 완료')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument()
  })

  it('A9 환불 실패: 요청자·사유·처리 상태를 보여 주고 [환불 다시 신청]으로 사유를 새로 받는다', async () => {
    renderAt({ refundStatus: 'FAILED', refund: failedRefund })
    expect(await screen.findByText('환불 실패')).toBeInTheDocument()
    expect(screen.getByText('고객')).toBeInTheDocument()
    expect(screen.getByText('단순 변심')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '환불 다시 신청' }))
    expect(screen.getByRole('heading', { name: '환불 다시 신청' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '단순 변심' })).not.toBeChecked()
  })

  it('환불 처리 중이면 안내만 보이고 취소 버튼이 없다', async () => {
    renderAt({ refundStatus: 'CHECKING', refund: { ...failedRefund, status: 'CHECKING' } })
    expect(await screen.findByText('환불 결과를 확인하고 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '환불 다시 신청' })).not.toBeInTheDocument()
  })

  it('A9 환불 완료 화면: 주문번호·상품·수량·환불금액·취소 완료 시각, [주문 내역으로]', async () => {
    renderAt({
      status: 'REFUNDED',
      refundStatus: 'COMPLETED',
      refund: { ...failedRefund, status: 'COMPLETED', canceledAt: '2026-10-20T16:01:05+09:00' },
    })
    expect(await screen.findByText('취소·환불이 끝났어요')).toBeInTheDocument()
    expect(screen.getByText('FL-20261020-000123')).toBeInTheDocument()
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.getByText('2개')).toBeInTheDocument()
    expect(screen.getByText('3,400원')).toBeInTheDocument()
    expect(screen.getByText('취소 완료 시각')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '주문 내역으로' })).toHaveAttribute(
      'href',
      '/customer/orders',
    )
  })
})
