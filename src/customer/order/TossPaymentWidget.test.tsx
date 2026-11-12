import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGREEMENT_REQUIRED_MESSAGE, RealWidget, WIDGET_SLOW_MS } from './TossPaymentWidget'

type StatusListener = (s: { agreedRequiredTerms: boolean; agreements: [] }) => void

const requestPayment = vi.fn()
// 다음 위젯 그리기를 어떻게 할지: 정상 / 결제 수단 그리기 실패 / 끝나지 않음(느린 경우)
let renderMode: 'ok' | 'fail' | 'hang' = 'ok'
let emitAgreement: StatusListener = () => undefined

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: vi.fn(async () => ({
    widgets: () => ({
      setAmount: vi.fn(() =>
        renderMode === 'hang' ? new Promise<void>(() => undefined) : Promise.resolve(),
      ),
      renderPaymentMethods: vi.fn(async () => {
        if (renderMode === 'fail') throw new Error('NETWORK_ERROR')
        return { destroy: vi.fn(async () => undefined) }
      }),
      renderAgreement: vi.fn(async ({ selector }: { selector: string }) => {
        const el = document.querySelector(selector)
        if (el) el.textContent = '[필수] 결제 서비스 이용 약관 동의'
        return {
          on: (_: string, cb: StatusListener) => {
            emitAgreement = cb
          },
          destroy: vi.fn(async () => undefined),
        }
      }),
      requestPayment,
    }),
  })),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function renderWidget() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <RealWidget
            clientKey="test_gck"
            orderId={7}
            orderNo="FL-20261111-000007"
            amount={3490}
            orderName="단팥빵"
            onInterrupted={vi.fn()}
          />
        ),
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

describe('토스 결제위젯 필수 약관 (U-22)', () => {
  beforeEach(() => {
    requestPayment.mockReset()
    vi.mocked(toast.error).mockReset()
    Element.prototype.scrollIntoView = vi.fn()
    renderMode = 'ok'
  })

  it('필수 약관에 동의하지 않고 [결제하기]를 누르면 결제창을 열지 않고 알린 뒤 약관으로 옮긴다', async () => {
    renderWidget()
    const pay = await screen.findByRole('button', { name: '3,490원 결제하기' })
    await waitFor(() => expect(pay).toBeEnabled())
    emitAgreement({ agreedRequiredTerms: false, agreements: [] })

    await userEvent.click(pay)
    expect(requestPayment).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(AGREEMENT_REQUIRED_MESSAGE)
    expect(screen.getByText(AGREEMENT_REQUIRED_MESSAGE)).toHaveAttribute('aria-live', 'assertive')
    // 버튼은 그대로 누를 수 있고, 약관 칸으로 포커스가 옮겨진다
    expect(pay).toBeEnabled()
    expect(document.activeElement?.textContent).toBe('[필수] 결제 서비스 이용 약관 동의')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('동의하면 빨간 안내가 사라지고 결제창을 연다', async () => {
    renderWidget()
    const pay = await screen.findByRole('button', { name: '3,490원 결제하기' })
    await waitFor(() => expect(pay).toBeEnabled())
    emitAgreement({ agreedRequiredTerms: false, agreements: [] })
    await userEvent.click(pay)
    expect(screen.getByText(AGREEMENT_REQUIRED_MESSAGE)).toBeInTheDocument()

    emitAgreement({ agreedRequiredTerms: true, agreements: [] })
    await waitFor(() =>
      expect(screen.queryByText(AGREEMENT_REQUIRED_MESSAGE)).not.toBeInTheDocument(),
    )
    await userEvent.click(pay)
    expect(requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'FL-20261111-000007', orderName: '단팥빵' }),
    )
  })
})

describe('토스 결제위젯 다시 불러오기 (11/12)', () => {
  beforeEach(() => {
    renderMode = 'ok'
  })

  it('결제 수단을 못 그리면 단계와 이유를 콘솔에 남기고, [다시 불러오기]로 위젯만 다시 그린다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderMode = 'fail'
    renderWidget()

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 수단을 불러오지 못했어요.')
    expect(screen.queryByText(/새로 고침/)).not.toBeInTheDocument()
    expect(error).toHaveBeenCalledWith('[결제위젯] 결제 수단 그리기 실패', expect.any(Error))
    expect(screen.getByRole('button', { name: '3,490원 결제하기' })).toBeDisabled()

    renderMode = 'ok'
    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '3,490원 결제하기' })).toBeEnabled(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // 이전 자리는 지워져 약관 UI 가 한 벌만 남는다
    expect(screen.getAllByText('[필수] 결제 서비스 이용 약관 동의')).toHaveLength(1)
    error.mockRestore()
  })

  it('[다시 불러오기]를 누르면 버튼이 사라져도 포커스가 로딩 표시로 옮겨 간다', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderMode = 'fail'
    renderWidget()
    await screen.findByRole('alert')
    renderMode = 'hang'
    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(document.activeElement).toContainElement(screen.getByLabelText('결제 수단 불러오는 중'))
    error.mockRestore()
  })

  it('10초 안에 준비되지 않으면 안내와 [다시 불러오기]를 보여 준다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderMode = 'hang'
    renderWidget()
    await screen.findByLabelText('결제 수단 불러오는 중')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(WIDGET_SLOW_MS)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '결제 수단을 불러오는 데 시간이 걸리고 있어요.',
    )
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
