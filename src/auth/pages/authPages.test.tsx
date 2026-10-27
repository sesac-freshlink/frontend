import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore, type AuthUser } from '@/shared/auth'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

const customer: AuthUser = { userId: 'sub-1', role: 'CUSTOMER', email: 'kim@test.com' }
const admin: AuthUser = { userId: 'sub-a', role: 'ADMIN', email: 'admin@test.com' }
const notFound = Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } })
const profile = {
  memberId: 'sub-1',
  role: 'CUSTOMER',
  name: '김경우',
  nickname: 'Fresh01',
  region: 'SEOUL',
}

function renderAt(path: string, state?: { from: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/customer', element: <p>고객 홈</p> },
      { path: '/owner/inventory', element: <p>점주 재고</p> },
      { path: '/admin/stores', element: <p>관리자 점포</p> },
      { path: '/admin/stores/new', element: <p>점포 등록</p> },
    ],
    { initialEntries: [{ pathname: path, state }] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const signIn = vi.fn<(email: string, password: string) => Promise<AuthUser>>()
const signUp = vi.fn(async () => undefined)
const confirmSignUp = vi.fn(async () => undefined)

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  signIn.mockReset()
  signUp.mockClear()
  confirmSignUp.mockReset().mockResolvedValue(undefined)
  signIn.mockImplementation(async () => {
    useAuthStore.setState({ user: customer })
    return customer
  })
  useAuthStore.setState({ user: null, restoring: false, signIn, signUp, confirmSignUp })
})

async function fillLogin() {
  await userEvent.type(screen.getByLabelText('이메일'), 'kim@test.com')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'Abcd123!')
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('로그인 (C-02)', () => {
  it('프로필이 있는 고객은 고객 홈으로 간다', async () => {
    get.mockResolvedValue({ data: profile })
    renderAt('/login')
    await fillLogin()
    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/members/me')
  })

  it('프로필이 없는 고객(MB-03 404)은 프로필 등록 마무리 화면으로 간다', async () => {
    get.mockRejectedValue(notFound)
    const router = renderAt('/login')
    await fillLogin()
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'))
    expect(await screen.findByRole('button', { name: '프로필 등록' })).toBeInTheDocument()
  })

  it('비밀번호가 틀리면 공통 문구를 띄우고 머문다', async () => {
    signIn.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAuthorizedException' }))
    const router = renderAt('/login')
    await fillLogin()
    await waitFor(() => expect(signIn).toHaveBeenCalled())
    expect(router.state.location.pathname).toBe('/login')
  })

  it('이메일 인증 전 계정이면 인증 코드 입력으로 보낸다', async () => {
    signIn.mockRejectedValue(new Error('추가 단계가 필요합니다: CONFIRM_SIGN_UP'))
    renderAt('/login')
    await fillLogin()
    expect(await screen.findByLabelText('인증 코드')).toBeInTheDocument()
    expect(screen.getByText('kim@test.com')).toBeInTheDocument()
  })
})

describe('관리자 로그인', () => {
  beforeEach(() => {
    signIn.mockImplementation(async () => {
      useAuthStore.setState({ user: admin })
      return admin
    })
  })

  it('관리자는 점포 목록으로 가고 회원 프로필(MB-03)을 부르지 않는다', async () => {
    const router = renderAt('/login')
    await fillLogin()
    expect(await screen.findByText('관리자 점포')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/stores')
    expect(get).not.toHaveBeenCalled()
  })

  it('로그인 전에 보던 관리자 화면으로 돌려보낸다', async () => {
    renderAt('/login', { from: '/admin/stores/new' })
    await fillLogin()
    expect(await screen.findByText('점포 등록')).toBeInTheDocument()
  })

  it('보던 화면이 다른 역할 영역이면 점포 목록으로 보낸다', async () => {
    renderAt('/login', { from: '/owner/inventory' })
    await fillLogin()
    expect(await screen.findByText('관리자 점포')).toBeInTheDocument()
  })

  it('이미 로그인한 관리자가 로그인 화면에 오면 점포 목록으로 보낸다', async () => {
    useAuthStore.setState({ user: admin })
    renderAt('/login')
    expect(await screen.findByText('관리자 점포')).toBeInTheDocument()
  })

  it('로그인한 관리자가 회원가입 화면에 오면 점포 목록으로 보낸다', async () => {
    useAuthStore.setState({ user: admin })
    renderAt('/signup')
    expect(await screen.findByText('관리자 점포')).toBeInTheDocument()
  })
})

describe('회원가입 (C-01)', () => {
  async function fillSignup(nickname = 'Fresh02') {
    await userEvent.type(screen.getByLabelText('이메일'), 'kim@test.com')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'Abcd123!')
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'Abcd123!')
    await userEvent.type(screen.getByLabelText('이름'), '김경우')
    await userEvent.type(screen.getByLabelText('닉네임'), nickname)
    await userEvent.selectOptions(screen.getByLabelText('거주 지역'), 'BUSAN')
    await userEvent.click(screen.getByRole('button', { name: '가입하기' }))
  }

  it('가입 → 인증 코드 → 로그인 → 프로필 등록 → 고객 홈', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/nickname-availability')
        return { data: { nickname: 'Fresh02', available: true } }
      throw notFound
    })
    post.mockResolvedValue({ data: { ...profile, nickname: 'Fresh02', region: 'BUSAN' } })
    renderAt('/signup')

    await fillSignup()
    expect(signUp).toHaveBeenCalledWith({
      email: 'kim@test.com',
      password: 'Abcd123!',
      role: 'CUSTOMER',
    })
    await userEvent.type(await screen.findByLabelText('인증 코드'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '인증하기' }))

    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
    expect(confirmSignUp).toHaveBeenCalledWith('kim@test.com', '123456', 'CUSTOMER')
    expect(signIn).toHaveBeenCalledWith('kim@test.com', 'Abcd123!')
    // member-service 로 비밀번호·이메일을 보내지 않는다
    expect(post).toHaveBeenCalledWith('/members/me', {
      name: '김경우',
      nickname: 'Fresh02',
      region: 'BUSAN',
    })
  })

  it('이미 쓰는 닉네임이면 가입 요청을 보내지 않는다', async () => {
    get.mockResolvedValue({ data: { nickname: 'Fresh01', available: false } })
    renderAt('/signup')
    await fillSignup('Fresh01')
    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('인증 코드가 틀리면 코드 칸에 알린다', async () => {
    get.mockResolvedValue({ data: { nickname: 'Fresh02', available: true } })
    confirmSignUp.mockRejectedValue(
      Object.assign(new Error('x'), { name: 'CodeMismatchException' }),
    )
    renderAt('/signup')
    await fillSignup()
    await userEvent.type(await screen.findByLabelText('인증 코드'), '000000')
    await userEvent.click(screen.getByRole('button', { name: '인증하기' }))
    expect(await screen.findByText('인증 코드가 맞지 않아요.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('프로필 저장 때 닉네임이 겹치면(409) 닉네임 칸에 알린다', async () => {
    useAuthStore.setState({ user: customer })
    get.mockRejectedValue(notFound)
    post.mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { code: 'NICKNAME_DUPLICATED' } },
      }),
    )
    renderAt('/signup')
    await userEvent.type(await screen.findByLabelText('이름'), '김경우')
    await userEvent.type(screen.getByLabelText('닉네임'), 'Fresh01')
    await userEvent.selectOptions(screen.getByLabelText('거주 지역'), 'SEOUL')
    await userEvent.click(screen.getByRole('button', { name: '프로필 등록' }))
    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument()
  })
})
