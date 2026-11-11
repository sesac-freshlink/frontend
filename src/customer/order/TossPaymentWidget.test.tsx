import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AGREEMENT_REQUIRED_MESSAGE, RealWidget } from './TossPaymentWidget'

type StatusListener = (s: { agreedRequiredTerms: boolean; agreements: [] }) => void

const requestPayment = vi.fn()
let emitAgreement: StatusListener = () => undefined

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: vi.fn(async () => ({
    widgets: () => ({
      setAmount: vi.fn(async () => undefined),
      renderPaymentMethods: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
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
