import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { InventoryLotItem } from '../api'
import { AdjustLotDialog } from './AdjustLotDialog'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const post = vi.mocked(api.post)

const lot: InventoryLotItem = {
  lotId: 303,
  expiryDate: '2026-10-30T23:59:59+09:00',
  quantity: 10,
  reservedQuantity: 3,
  availableQuantity: 7,
  status: 'NORMAL',
}

/** 서버 오류 모양(common ErrorResponse)으로 axios 오류를 만든다 */
function serverError(status: number, code: string, message: string) {
  const headers = new AxiosHeaders()
  return new AxiosError(message, String(status), { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: { code, message, traceId: '' },
  })
}

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdjustLotDialog productName="흰 우유 500ml" lot={lot} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

const countInput = () => screen.getByLabelText('실제 수량')
const submitButton = () => screen.getByRole('button', { name: '조정' })

async function typeCount(text: string) {
  await userEvent.clear(countInput())
  await userEvent.type(countInput(), text)
}

describe('재고 조정 모달 (S-14)', () => {
  beforeEach(() => {
    post.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('지금 실물·예약을 보여 주고, 처음에는 같은 수량이라 조정할 수 없다', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: '재고 조정' })).toBeInTheDocument()
    expect(screen.getByText('흰 우유 500ml · 유통기한 10/30')).toBeInTheDocument()
    expect(screen.getByText('10개')).toBeInTheDocument()
    expect(screen.getByText('3개')).toBeInTheDocument()
    expect(countInput()).toHaveValue(10)
    expect(screen.getByText('지금 수량과 같아요.')).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('센 수량을 넣으면 증감을 보여 주고, 조정하면 증감·사유를 보내고 닫는다', async () => {
    post.mockResolvedValue({
      data: { adjustmentId: 7001, lotId: 303, delta: -2, quantityBefore: 10, quantityAfter: 8 },
    })
    const onClose = renderDialog()

    await typeCount('8')
    expect(screen.getByText('−2개')).toHaveClass('text-red-600')
    await userEvent.click(submitButton())

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('흰 우유 500ml 10개 → 8개로 조정했어요'),
    )
    expect(post).toHaveBeenCalledWith('/owner/inventory/adjustments', {
      lotId: 303,
      delta: -2,
      reason: 'COUNT',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('사유와 메모를 고르면 같이 보낸다', async () => {
    post.mockResolvedValue({
      data: { adjustmentId: 7002, lotId: 303, delta: -1, quantityBefore: 10, quantityAfter: 9 },
    })
    renderDialog()

    await typeCount('9')
    await userEvent.click(screen.getByRole('radio', { name: '파손' }))
    await userEvent.type(screen.getByLabelText('메모 (선택)'), '  포장 찢어짐 ')
    await userEvent.click(submitButton())

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/owner/inventory/adjustments', {
        lotId: 303,
        delta: -1,
        reason: 'DAMAGE',
        memo: '포장 찢어짐',
      }),
    )
  })

  it('예약보다 적게 넣으면 안내하고 보내지 않는다', async () => {
    renderDialog()
    await typeCount('2')

    expect(screen.getByText('예약된 3개보다 적게 줄일 수 없어요.')).toBeInTheDocument()
    expect(countInput()).toHaveAttribute('aria-invalid', 'true')
    expect(submitButton()).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('쪽지 처리와 겹쳐 409 가 오면 서버 message 로 알리고 모달을 남긴다', async () => {
    post.mockRejectedValue(
      serverError(409, 'LOT_CHANGED', '다른 처리와 겹쳐 재고가 바뀌었습니다. 다시 확인해 주세요'),
    )
    const onClose = renderDialog()

    await typeCount('12')
    expect(screen.getByText('+2개')).toHaveClass('text-emerald-700')
    await userEvent.click(submitButton())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '다른 처리와 겹쳐 재고가 바뀌었습니다. 다시 확인해 주세요',
      ),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '재고 조정' })).toBeInTheDocument()
  })

  it('Escape 나 취소로 닫는다', async () => {
    const onClose = renderDialog()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
