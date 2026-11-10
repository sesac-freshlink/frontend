import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { PickupPassOrders } from '../api'
import { PickupApproveDialog } from './PickupApproveDialog'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다
const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const { showModal, close } = proto
beforeAll(() => {
  proto.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
})
afterAll(() => {
  proto.showModal = showModal
  proto.close = close
})

const list: PickupPassOrders = {
  token: 'tok',
  orders: [
    {
      orderId: 1,
      orderNo: 'FL-1',
      status: 'PAID',
      productName: '바나나우유',
      quantity: 1,
      amount: 1700,
      paidAt: null,
      pickupDeadline: null,
      selectable: false,
    },
    {
      orderId: 2,
      orderNo: 'FL-2',
      status: 'READY_FOR_PICKUP',
      productName: '삼각김밥 참치마요',
      quantity: 2,
      amount: 3000,
      paidAt: null,
      pickupDeadline: null,
      selectable: true,
    },
    {
      orderId: 3,
      orderNo: 'FL-3',
      status: 'READY_FOR_PICKUP',
      productName: '샌드위치 햄치즈',
      quantity: 1,
      amount: 3200,
      paidAt: null,
      pickupDeadline: null,
      selectable: true,
    },
  ],
}

function renderDialog(key = 'tok', onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PickupApproveDialog pickupKey={key} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: list })
})

describe('PickupApproveDialog (A16)', () => {
  it('처음엔 아무것도 체크하지 않고, 준비 전 주문은 목록에 없다', async () => {
    renderDialog()
    const ready = await screen.findByRole('checkbox', { name: /FL-2/ })
    expect(ready).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: /FL-1/ })).not.toBeInTheDocument()
    expect(screen.queryByText('준비 전')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '픽업 승인' })).toBeDisabled()
    expect(get).toHaveBeenCalledWith('/owner/orders/pickup-pass/tok')
  })

  it('고르고 [픽업 승인] → 확인 → 고른 주문만 보내고 건마다 결과를 보여 준다', async () => {
    post.mockResolvedValue({
      data: {
        results: [
          { orderId: 2, result: 'PICKED_UP' },
          { orderId: 3, result: 'DEADLINE_PASSED' },
        ],
      },
    })
    renderDialog()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: /FL-2/ }))
    await user.click(screen.getByRole('checkbox', { name: /FL-3/ }))
    await user.click(screen.getByRole('button', { name: '픽업 승인' }))
    expect(screen.getByText('2건을 픽업 완료로 바꿀까요?')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '바꾸기' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/owner/orders/pickup', { token: 'tok', orderIds: [2, 3] }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('FL-2 · 픽업 완료')).toBeInTheDocument()
    expect(within(dialog).getByText('FL-3 · 픽업 기한이 지났어요')).toBeInTheDocument()
  })

  it('확인 단계에서 취소하면 다시 고르기로 돌아간다', async () => {
    renderDialog()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: /FL-2/ }))
    await user.click(screen.getByRole('button', { name: '픽업 승인' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.getByRole('button', { name: '픽업 승인' })).toBeEnabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('표가 만료됐거나 코드가 틀리면 안내', async () => {
    get.mockRejectedValue(
      Object.assign(new Error('404'), {
        isAxiosError: true,
        response: { status: 404, data: { code: 'PICKUP_PASS_NOT_FOUND', message: 'x' } },
      }),
    )
    renderDialog('123456')
    expect(await screen.findByRole('alert')).toHaveTextContent('QR이 만료됐거나 없어요')
  })

  it('[닫기]를 누르면 닫힌다', async () => {
    const onClose = renderDialog()
    await userEvent.setup().click(await screen.findByRole('button', { name: '닫기' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
