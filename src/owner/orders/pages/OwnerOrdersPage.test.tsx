import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { OwnerOrder } from '../api'
import { OwnerOrdersPage } from './OwnerOrdersPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const success = vi.mocked(toast.success)
const error = vi.mocked(toast.error)

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. AdminStoresPage.test 와 같은 방식으로 필요한 만큼만 흉내 낸다
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

const paidOrder: OwnerOrder = {
  orderId: 123,
  orderNo: 'FL-20261020-000123',
  productName: '매운 컵라면 115g',
  quantity: 2,
  amount: 3400,
  paidAt: '2026-10-20T15:35:10+09:00',
  pickupDeadline: '2026-10-22T23:59:59+09:00',
  payment: null,
}

function axiosError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: '' } },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <OwnerOrdersPage />
    </QueryClientProvider>,
  )
}

describe('점주 신규 주문 목록 (S-50)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    success.mockReset()
    error.mockReset()
  })

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

  it('픽업 기한을 날짜만 보여 주고, 서버가 아직 안 주면 - 로 둔다 (A4)', async () => {
    get.mockResolvedValue({
      data: [
        paidOrder,
        {
          ...paidOrder,
          orderId: 124,
          orderNo: 'FL-20261020-000124',
          pickupDeadline: null,
          // 결제 수단 칸이 - 가 되지 않게 결제 내역을 채운다 (- 는 픽업 기한 칸 하나만)
          payment: { method: '카드', approvedAt: null, status: 'DONE', receiptUrl: null },
        },
      ],
    })
    renderPage()
    expect(await screen.findByText('10/22(목)')).toBeInTheDocument()
    const noDeadline = screen.getByText('FL-20261020-000124').closest('tr')!
    expect(within(noDeadline).getByText('-', { selector: 'td' })).toBeInTheDocument()
  })

  it('[픽업 확인] → 확인 창 [픽업 완료] → OR-05 를 부르고 목록을 다시 읽는다 (A5)', async () => {
    get.mockResolvedValueOnce({ data: [paidOrder] }).mockResolvedValue({ data: [] })
    post.mockResolvedValue({
      data: {
        orderId: 123,
        orderNo: paidOrder.orderNo,
        status: 'PICKED_UP',
        pickedUpAt: '2026-10-21T10:05:00+09:00',
      },
    })
    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    const dialog = screen.getByRole('dialog', { name: '픽업 완료 처리하시겠습니까?' })
    expect(within(dialog).getByText('매운 컵라면 115g 2개')).toBeInTheDocument()
    expect(within(dialog).getByText('10월 22일(목)까지')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: '픽업 완료' }))
    expect(post).toHaveBeenCalledWith('/owner/orders/123/pickup')
    expect(post).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(success).toHaveBeenCalledWith('FL-20261020-000123 픽업 완료했어요'))
    // 픽업한 주문은 결제 완료 목록에서 빠진다
    expect(await screen.findByText('아직 들어온 주문이 없어요.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('확인 창에서 [취소]하면 아무 요청도 보내지 않는다', async () => {
    get.mockResolvedValue({ data: [paidOrder] })
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(post).not.toHaveBeenCalled()
  })

  it('이미 처리된 주문(409)이면 알림을 띄우고 목록을 다시 읽는다', async () => {
    get.mockResolvedValue({ data: [paidOrder] })
    post.mockRejectedValue(axiosError(409, 'ORDER_NOT_PICKABLE'))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '픽업 완료' }))
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('이미 픽업했거나 처리할 수 없는 주문이에요'),
    )
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(success).not.toHaveBeenCalled()
  })

  it('픽업 기한이 지났으면(409) 기한 문구를 띄운다', async () => {
    get.mockResolvedValue({ data: [paidOrder] })
    post.mockRejectedValue(axiosError(409, 'PICKUP_DEADLINE_PASSED'))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '픽업 완료' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('픽업 기한이 지난 주문이에요'))
  })
})
