import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/shared/auth'
import {
  PASSWORD_CHANGE_NOT_ALLOWED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  WRONG_CURRENT_PASSWORD_MESSAGE,
} from '../usePasswordChange'
import { PasswordChangePage } from './PasswordChangePage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const customer: AuthUser = { userId: 'sub-1', role: 'CUSTOMER', email: 'kim@test.com' }

/** gateway 오류 응답 {code, message, traceId} 를 받은 axios 오류 */
function apiError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code, traceId: null } },
  })
}

const changePassword =
  vi.fn<(current: string, next: string) => Promise<{ otherDevicesSignedOut: boolean }>>()
const expireSession = vi.fn(() => true)
const signOut = vi.fn(async () => undefined)

function renderAt(path: string, backTo: string, backLabel?: string) {
  const router = createMemoryRouter(
    [
      { path, element: <PasswordChangePage backTo={backTo} backLabel={backLabel} /> },
      { path: backTo, element: <p>돌아간 화면</p> },
      { path: '/login', element: <p>로그인 화면</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

async function fill(current: string, next: string, confirm = next) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('지금 비밀번호'), current)
  await user.type(screen.getByLabelText('새 비밀번호'), next)
  await user.type(screen.getByLabelText('새 비밀번호 확인'), confirm)
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  changePassword.mockResolvedValue({ otherDevicesSignedOut: true })
  useAuthStore.setState({ user: customer, changePassword, expireSession, signOut })
})

describe('PasswordChangePage (A4)', () => {
  it('바꾸면 지금·새 비밀번호를 보내고, 로그아웃(PASSWORD_CHANGED 안내)한 뒤 로그인 화면으로 간다', async () => {
    const router = renderAt('/customer/my/password', '/customer/my')
    const user = await fill('Old-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(changePassword).toHaveBeenCalledWith('Old-pass1', 'New-pass1!')
    expect(signOut).toHaveBeenCalledWith('PASSWORD_CHANGED')
    expect(toast.success).not.toHaveBeenCalled()
    expect(expireSession).not.toHaveBeenCalled()
  })

  it('다른 기기 로그아웃이 끝내 실패했으면 PASSWORD_CHANGED_OTHERS_ACTIVE 안내로 로그인 화면에 간다', async () => {
    changePassword.mockResolvedValue({ otherDevicesSignedOut: false })
    const router = renderAt('/customer/my/password', '/customer/my')
    const user = await fill('Old-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(signOut).toHaveBeenCalledWith('PASSWORD_CHANGED_OTHERS_ACTIVE')
  })

  it('고객은 위에 "‹ 마이페이지" 뒤로 링크가 있고, 이름을 안 주면(점주) 그리지 않는다', async () => {
    const router = renderAt('/customer/my/password', '/customer/my', '마이페이지')
    await userEvent.setup().click(screen.getByRole('link', { name: '마이페이지' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/my'))
  })

  it('점주도 같은 폼을 쓰고, 취소하면 내 점포로 돌아간다', async () => {
    useAuthStore.setState({ user: { userId: 'o', role: 'OWNER', storeId: '1' } })
    const router = renderAt('/owner/store/password', '/owner/store')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('link', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'))
  })

  it('관리자 계정이면(403 PASSWORD_CHANGE_NOT_ALLOWED) 토스트, 로그아웃하지 않는다', async () => {
    changePassword.mockRejectedValue(apiError(403, 'PASSWORD_CHANGE_NOT_ALLOWED'))
    renderAt('/customer/my/password', '/customer/my')
    const user = await fill('Old-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(PASSWORD_CHANGE_NOT_ALLOWED_MESSAGE),
    )
    expect(signOut).not.toHaveBeenCalled()
  })

  it('새 비밀번호가 규칙에 안 맞거나 확인이 다르면 버튼이 꺼진다', async () => {
    renderAt('/customer/my/password', '/customer/my')
    await fill('Old-pass1', 'abcd1234')
    expect(screen.getByRole('button', { name: '비밀번호 바꾸기' })).toBeDisabled()
    expect(screen.getByText('대문자를 넣어 주세요')).toBeInTheDocument()
  })

  it('새 비밀번호가 지금 비밀번호와 같으면 안내를 띄우고 보내지 않는다', async () => {
    renderAt('/customer/my/password', '/customer/my')
    await fill('Old-pass1!', 'Old-pass1!')

    expect(await screen.findByText('지금 비밀번호와 다르게 정해 주세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '비밀번호 바꾸기' })).toBeDisabled()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('새 비밀번호를 먼저 쓰고 지금 비밀번호를 나중에 써도 같은지 알려 주고, 고치면 안내가 사라진다', async () => {
    renderAt('/customer/my/password', '/customer/my')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('새 비밀번호'), 'Old-pass1!')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'Old-pass1!')
    await user.type(screen.getByLabelText('지금 비밀번호'), 'Old-pass1!')
    expect(await screen.findByText('지금 비밀번호와 다르게 정해 주세요')).toBeInTheDocument()

    await user.type(screen.getByLabelText('지금 비밀번호'), 'x')
    await waitFor(() =>
      expect(screen.queryByText('지금 비밀번호와 다르게 정해 주세요')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: '비밀번호 바꾸기' })).toBeEnabled()
  })

  it('눈 버튼은 그 칸만 보이게 하고, 다시 누르면 숨긴다', async () => {
    renderAt('/customer/my/password', '/customer/my')
    const user = userEvent.setup()
    const current = screen.getByLabelText('지금 비밀번호')
    const next = screen.getByLabelText('새 비밀번호')
    expect(current).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: '지금 비밀번호 보기' }))
    expect(current).toHaveAttribute('type', 'text')
    expect(next).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: '지금 비밀번호 숨기기' }))
    expect(current).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: '새 비밀번호 확인 보기' })).toBeInTheDocument()
  })

  it('지금 비밀번호가 틀리면(400 WRONG_CURRENT_PASSWORD) 그 칸에 오류', async () => {
    changePassword.mockRejectedValue(apiError(400, 'WRONG_CURRENT_PASSWORD'))
    renderAt('/customer/my/password', '/customer/my')
    const user = await fill('wrong-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    expect(await screen.findByText(WRONG_CURRENT_PASSWORD_MESSAGE)).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('시도가 너무 많으면(429) 토스트', async () => {
    changePassword.mockRejectedValue(apiError(429, 'TOO_MANY_ATTEMPTS'))
    renderAt('/customer/my/password', '/customer/my')
    const user = await fill('Old-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.'),
    )
  })

  it('로그인이 만료됐으면(401) 세션을 끝내고 안내', async () => {
    changePassword.mockRejectedValue(apiError(401, 'SESSION_EXPIRED'))
    renderAt('/customer/my/password', '/customer/my')
    const user = await fill('Old-pass1', 'New-pass1!')
    await user.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    await waitFor(() => expect(expireSession).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE)
  })

  it('구글 가입 계정은 폼 대신 안내만 보여 준다', () => {
    useAuthStore.setState({ user: { ...customer, passwordLogin: false } })
    renderAt('/customer/my/password', '/customer/my')
    expect(screen.getByText(/구글로 가입한 계정은 비밀번호가 없어요/)).toBeInTheDocument()
    expect(screen.queryByLabelText('지금 비밀번호')).not.toBeInTheDocument()
  })
})
