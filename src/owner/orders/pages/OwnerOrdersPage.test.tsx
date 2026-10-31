import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  status: 'PAID',
  productName: '매운 컵라면 115g',
  quantity: 2,
  amount: 3400,
  paidAt: '2026-10-20T15:35:10+09:00',
  pickupDeadline: '2026-10-22T23:59:59+09:00',
  pickedUpAt: null,
  payment: null,
}

/** 점주가 [준비 완료]를 누른 주문 (N-02). [픽업 확인]은 이 상태에서만 보인다 */
const readyOrder: OwnerOrder = { ...paidOrder, status: 'READY_FOR_PICKUP' }

/** A6 페이지 응답 한 장 */
function pageOf(content: Partial<OwnerOrder>[], extra: { totalPages?: number } = {}) {
  return {
    data: {
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: extra.totalPages ?? 1,
    },
  }
}

/** 마지막 목록 요청의 쿼리 */
function lastParams() {
  return get.mock.lastCall?.[1]?.params as Record<string, unknown> | undefined
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

describe('점주 주문 목록 (S-50·A5·A6)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    success.mockReset()
    error.mockReset()
  })

  it('결제 완료 주문을 보여 주고 [새로 고침]으로 다시 읽는다', async () => {
    get.mockResolvedValue(pageOf([paidOrder]))
    renderPage()

    expect(await screen.findByText('FL-20261020-000123')).toBeInTheDocument()
    expect(screen.getByText('3,400원')).toBeInTheDocument()
    expect(screen.getByText('10/20 15:35')).toBeInTheDocument()
    // 처음에는 픽업 대기 구분, 0페이지, 20개씩, 기간 없음
    expect(get).toHaveBeenCalledWith('/owner/orders', {
      params: { tab: 'PICKUP_WAITING', page: 0, size: 20 },
    })

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
    get.mockResolvedValue(
      pageOf([
        { ...row, orderId: 1, orderNo: 'FL-20261020-000001', payment },
        {
          ...row,
          orderId: 2,
          orderNo: 'FL-20261020-000002',
          payment: { ...payment, method: '간편결제', receiptUrl: null },
        },
      ]),
    )
    renderPage()

    expect(await screen.findByText('FL-20261020-000001')).toBeInTheDocument()
    expect(screen.getByText('카드')).toBeInTheDocument()
    expect(screen.getByText('간편결제')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: '영수증 보기' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://receipt.test/1')
  })

  it('주문이 없으면 안내한다', async () => {
    get.mockResolvedValue(pageOf([]))
    renderPage()
    expect(await screen.findByText('픽업을 기다리는 주문이 없어요.')).toBeInTheDocument()
  })

  it('불러오지 못하면 오류 문구를 보여 준다', async () => {
    get.mockRejectedValue(axiosError(500, 'INTERNAL_ERROR'))
    renderPage()
    expect(await screen.findByText('주문을 불러오지 못했어요.')).toBeInTheDocument()
  })

  it('픽업 기한을 날짜만 보여 주고, 서버가 아직 안 주면 - 로 둔다 (A4)', async () => {
    get.mockResolvedValue(
      pageOf([
        paidOrder,
        {
          ...paidOrder,
          orderId: 124,
          orderNo: 'FL-20261020-000124',
          pickupDeadline: null,
          // 결제 수단 칸이 - 가 되지 않게 결제 내역을 채운다 (- 는 픽업 기한 칸 하나만)
          payment: { method: '카드', approvedAt: null, status: 'DONE', receiptUrl: null },
        },
      ]),
    )
    renderPage()
    expect(await screen.findByText('10/22(목)')).toBeInTheDocument()
    const noDeadline = screen.getByText('FL-20261020-000124').closest('tr')!
    expect(within(noDeadline).getByText('-', { selector: 'td' })).toBeInTheDocument()
  })

  it('[픽업 확인] → 확인 창 [픽업 완료] → OR-05 를 부르고 목록을 다시 읽는다 (A5)', async () => {
    get.mockResolvedValueOnce(pageOf([readyOrder])).mockResolvedValue(pageOf([]))
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
    // 픽업한 주문은 픽업 대기 목록에서 빠진다
    expect(await screen.findByText('픽업을 기다리는 주문이 없어요.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('확인 창에서 [취소]하면 아무 요청도 보내지 않는다', async () => {
    get.mockResolvedValue(pageOf([readyOrder]))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(post).not.toHaveBeenCalled()
  })

  it('이미 처리된 주문(409)이면 알림을 띄우고 목록을 다시 읽는다', async () => {
    get.mockResolvedValue(pageOf([readyOrder]))
    post.mockRejectedValue(axiosError(409, 'ORDER_NOT_PICKABLE'))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '픽업 완료' }))
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith('픽업 준비 완료를 먼저 누르거나, 이미 픽업한 주문이에요'),
    )
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(success).not.toHaveBeenCalled()
  })

  it('픽업 기한이 지났으면(409) 기한 문구를 띄운다', async () => {
    get.mockResolvedValue(pageOf([readyOrder]))
    post.mockRejectedValue(axiosError(409, 'PICKUP_DEADLINE_PASSED'))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '픽업 완료' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('픽업 기한이 지난 주문이에요'))
  })

  it('상품별 판매 순위 탭으로 바꾸면 주문 대신 판매 순위를 부른다 (변동 이력에서 옮김)', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/owner/inventory/sales-ranking'
          ? { data: { from: '2026-10-24', to: '2026-10-30', totalSoldQuantity: 0, items: [] } }
          : pageOf([paidOrder]),
      ),
    )
    renderPage()
    expect(await screen.findByText('FL-20261020-000123')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '주문 목록' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: '상품별 판매 순위' }))

    expect(await screen.findByText('이 기간에 판매된 상품이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '상품별 판매 순위' })).toBeInTheDocument()
    expect(screen.queryByText('FL-20261020-000123')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/sales-ranking', expect.anything())
  })

  it('구분을 바꾸면 그 구분으로 다시 읽고, [픽업 확인]은 픽업 대기에서만 보인다 (A6)', async () => {
    get.mockResolvedValue(pageOf([readyOrder]))
    renderPage()
    expect(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '픽업 대기' })).toHaveAttribute('aria-selected', 'true')

    get.mockResolvedValue(
      pageOf([
        {
          ...paidOrder,
          orderId: 200,
          orderNo: 'FL-20261019-000200',
          status: 'PICKED_UP',
          pickedUpAt: '2026-10-21T10:05:00+09:00',
        },
      ]),
    )
    await userEvent.click(screen.getByRole('tab', { name: '픽업 완료' }))
    expect(await screen.findByText('FL-20261019-000200')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'PICKED_UP', page: 0, size: 20 })
    // 픽업 완료는 픽업 시각 칸을 보여 주고 픽업 기한·[픽업 확인]은 없다
    expect(screen.getByRole('columnheader', { name: '픽업 시각' })).toBeInTheDocument()
    expect(screen.getByText('10/21 10:05')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '픽업 기한' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /픽업 확인/ })).not.toBeInTheDocument()

    get.mockResolvedValue(
      pageOf([
        {
          ...paidOrder,
          orderId: 300,
          orderNo: 'FL-20261015-000300',
          status: 'PICKUP_EXPIRED',
          pickupDeadline: '2026-10-16T23:59:59+09:00',
        },
      ]),
    )
    await userEvent.click(screen.getByRole('tab', { name: '기한 경과' }))
    expect(await screen.findByText('FL-20261015-000300')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'PICKUP_EXPIRED', page: 0, size: 20 })
    expect(screen.getByText('10/16(금)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /픽업 확인/ })).not.toBeInTheDocument()

    // 취소·환불은 환불 기능(A7~A9) 전이라 늘 빈 목록이다
    get.mockResolvedValue(pageOf([]))
    await userEvent.click(screen.getByRole('tab', { name: '취소·환불' }))
    expect(await screen.findByText('취소·환불된 주문이 없어요.')).toBeInTheDocument()
    expect(lastParams()).toEqual({ tab: 'CANCELED', page: 0, size: 20 })
  })

  it('기간을 고르면 from·to 를 같이 보내고 첫 페이지로 돌아가며, [기간 지우기]로 뺀다 (A6)', async () => {
    get.mockResolvedValue(pageOf([paidOrder], { totalPages: 3 }))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1 }))

    fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-01' } })
    await waitFor(() =>
      expect(lastParams()).toEqual({
        tab: 'PICKUP_WAITING',
        page: 0,
        size: 20,
        from: '2026-10-01',
      }),
    )
    fireEvent.change(screen.getByLabelText('끝 날짜'), { target: { value: '2026-10-20' } })
    await waitFor(() =>
      expect(lastParams()).toEqual({
        tab: 'PICKUP_WAITING',
        page: 0,
        size: 20,
        from: '2026-10-01',
        to: '2026-10-20',
      }),
    )

    // 구분을 바꿔도 기간은 그대로 같이 보낸다
    await userEvent.click(screen.getByRole('tab', { name: '픽업 완료' }))
    await waitFor(() =>
      expect(lastParams()).toEqual({
        tab: 'PICKED_UP',
        page: 0,
        size: 20,
        from: '2026-10-01',
        to: '2026-10-20',
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: '기간 지우기' }))
    await waitFor(() => expect(lastParams()).toEqual({ tab: 'PICKED_UP', page: 0, size: 20 }))
    expect(screen.getByRole('button', { name: '기간 지우기' })).toBeDisabled()
  })

  it('시작 날짜가 끝 날짜보다 늦으면 안내만 띄우고 목록을 부르지 않는다', async () => {
    get.mockResolvedValue(pageOf([paidOrder]))
    renderPage()
    await screen.findByText('FL-20261020-000123')
    fireEvent.change(screen.getByLabelText('끝 날짜'), { target: { value: '2026-10-10' } })
    await waitFor(() => expect(lastParams()).toMatchObject({ to: '2026-10-10' }))
    const calls = get.mock.calls.length

    fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-20' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('시작 날짜가 끝 날짜보다 늦어요.')
    expect(screen.queryByText('FL-20261020-000123')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '새로 고침' })).toBeDisabled()
    expect(get).toHaveBeenCalledTimes(calls)
  })

  it('결제 완료 주문은 [준비 완료]만 보이고, 누르면 N-02 API 를 부르고 알린 뒤 목록을 다시 읽는다', async () => {
    get.mockResolvedValueOnce(pageOf([paidOrder])).mockResolvedValue(pageOf([readyOrder]))
    post.mockResolvedValue({
      data: {
        orderId: 123,
        orderNo: paidOrder.orderNo,
        status: 'READY_FOR_PICKUP',
        pickedUpAt: null,
      },
    })
    renderPage()

    const ready = await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 준비 완료' })
    expect(
      screen.queryByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    ).not.toBeInTheDocument()
    await userEvent.click(ready)

    expect(post).toHaveBeenCalledWith('/owner/orders/123/ready')
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith('FL-20261020-000123 픽업 준비 완료. 고객에게 알렸어요'),
    )
    // 다시 읽은 목록에서는 같은 줄이 [픽업 확인]으로 바뀐다
    expect(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 확인' }),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('[준비 완료]가 409 면 서버 code 에 맞는 문구를 띄운다', async () => {
    get.mockResolvedValue(pageOf([paidOrder]))
    post.mockRejectedValue(axiosError(409, 'PICKUP_DEADLINE_PASSED'))
    renderPage()
    await userEvent.click(
      await screen.findByRole('button', { name: 'FL-20261020-000123 픽업 준비 완료' }),
    )

    await waitFor(() => expect(error).toHaveBeenCalledWith('픽업 기한이 지난 주문이에요'))
    expect(success).not.toHaveBeenCalled()
  })
})
