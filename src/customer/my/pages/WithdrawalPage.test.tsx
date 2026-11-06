import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import { WithdrawalPage } from './WithdrawalPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), delete: vi.fn() } }))
const del = vi.mocked(api.delete)
const signOut = vi.fn(async () => undefined)

function apiError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code, traceId: null } },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/my/withdraw', element: <WithdrawalPage /> },
      { path: '/login', element: <p>로그인 화면</p> },
    ],
    { initialEntries: ['/customer/my/withdraw'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { userId: 'sub-1', role: 'CUSTOMER' }, signOut })
})

describe('WithdrawalPage (/customer/my/withdraw, A6)', () => {
  it('안내를 확인해야 [탈퇴하기]가 켜지고, 마지막 확인 뒤에만 탈퇴를 보낸다', async () => {
    del.mockResolvedValue({ data: undefined })
    const router = renderPage()
    const user = userEvent.setup()
    expect(screen.getByText(/30일 동안 보관/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: '탈퇴하기' })
    expect(button).toBeDisabled()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(button)
    expect(screen.getByText('정말 탈퇴할까요? 되돌릴 수 없어요.')).toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '탈퇴' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(del).toHaveBeenCalledWith('/members/me')
    expect(signOut).toHaveBeenCalledWith('WITHDRAWN')
  })

  it('진행 중 주문이 있으면(409) 이유와 주문 내역 링크, 로그아웃하지 않는다', async () => {
    del.mockRejectedValue(apiError(409, 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER'))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.click(screen.getByRole('button', { name: '탈퇴' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '진행 중인 주문이 있어 탈퇴할 수 없어요',
    )
    expect(screen.getByRole('link', { name: '주문 내역 보기' })).toHaveAttribute(
      'href',
      '/customer/orders',
    )
    expect(signOut).not.toHaveBeenCalled()
  })

  it('주문 확인을 못 하면(503) 안내만', async () => {
    del.mockRejectedValue(apiError(503, 'WITHDRAWAL_CHECK_UNAVAILABLE'))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.click(screen.getByRole('button', { name: '탈퇴' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('지금은 주문을 확인할 수 없어')
    expect(screen.queryByRole('link', { name: '주문 내역 보기' })).not.toBeInTheDocument()
  })

  it('마지막 확인에서 취소하면 보내지 않는다', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.getByRole('button', { name: '탈퇴하기' })).toBeEnabled()
    expect(del).not.toHaveBeenCalled()
  })
})
