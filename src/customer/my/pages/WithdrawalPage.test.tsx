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
    localStorage.clear()
    // 이 계정이 이 기기에 남긴 점포 설정(픽업·단골)과 다른 계정 값
    localStorage.setItem('freshlink.pickupStore.sub-1', '{"storeId":1,"name":"프레시 강남점"}')
    localStorage.setItem('freshlink.favoriteStores.sub-1', '[]')
    localStorage.setItem('freshlink.pickupStore.sub-2', '{"storeId":2,"name":"프레시 역삼점"}')
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
    // 확인 문구를 입력해야 [탈퇴]가 켜진다. 칸에 포커스가 가 있다
    const input = screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요')
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: '탈퇴' })).toBeDisabled()
    await user.type(input, '  탈퇴합니다 ')
    await user.click(screen.getByRole('button', { name: '탈퇴' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(del).toHaveBeenCalledWith('/members/me')
    expect(signOut).toHaveBeenCalledWith('WITHDRAWN')
    // 탈퇴에 성공하면 그 계정 값만 지운다
    expect(localStorage.getItem('freshlink.pickupStore.sub-1')).toBeNull()
    expect(localStorage.getItem('freshlink.favoriteStores.sub-1')).toBeNull()
    expect(localStorage.getItem('freshlink.pickupStore.sub-2')).not.toBeNull()
  })

  it('진행 중 주문이 있으면(409) 이유와 주문 내역 링크, 로그아웃하지 않는다', async () => {
    del.mockRejectedValue(apiError(409, 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER'))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.type(screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요'), '탈퇴합니다')
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

  it('탈퇴가 막히면(409) 이 기기에 남긴 점포 설정을 지우지 않는다', async () => {
    localStorage.clear()
    localStorage.setItem('freshlink.pickupStore.sub-1', '{"storeId":1,"name":"프레시 강남점"}')
    del.mockRejectedValue(apiError(409, 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER'))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.type(screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요'), '탈퇴합니다')
    await user.click(screen.getByRole('button', { name: '탈퇴' }))
    await screen.findByRole('alert')
    expect(localStorage.getItem('freshlink.pickupStore.sub-1')).not.toBeNull()
  })

  it('주문 확인을 못 하면(503) 안내만', async () => {
    del.mockRejectedValue(apiError(503, 'WITHDRAWAL_CHECK_UNAVAILABLE'))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.type(screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요'), '탈퇴합니다')
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

  it('확인 문구가 다르면 [탈퇴]가 꺼지고 칸 아래 안내가 오류로 바뀐다. 붙여넣기도 받는다', async () => {
    del.mockResolvedValue({ data: undefined })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    const input = screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText('탈퇴합니다를 똑같이 입력해 주세요')).not.toBeInTheDocument()

    await user.type(input, '탈퇴 합니다')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const hint = screen.getByText('탈퇴합니다를 똑같이 입력해 주세요')
    expect(input).toHaveAttribute('aria-describedby', hint.id)
    expect(hint).toHaveClass('text-rose-700')
    const withdraw = screen.getByRole('button', { name: '탈퇴' })
    expect(withdraw).toBeDisabled()
    await user.click(withdraw)
    expect(del).not.toHaveBeenCalled()

    await user.clear(input)
    await user.click(input)
    await user.paste('탈퇴합니다')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText('탈퇴합니다를 똑같이 입력해 주세요')).not.toBeInTheDocument()
    expect(withdraw).toBeEnabled()
  })

  it('[취소]로 돌아가면 입력한 확인 문구를 지운다', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('안내를 모두 확인했어요'))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    await user.type(screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요'), '탈퇴합니다')
    await user.click(screen.getByRole('button', { name: '취소' }))
    await user.click(screen.getByRole('button', { name: '탈퇴하기' }))
    expect(screen.getByLabelText('확인을 위해 탈퇴합니다를 입력해 주세요')).toHaveValue('')
    expect(screen.getByRole('button', { name: '탈퇴' })).toBeDisabled()
  })
})
