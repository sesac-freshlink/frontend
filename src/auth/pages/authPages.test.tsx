import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore, type AuthUser, type LoginNotice } from '@/shared/auth'
import {
  EMAIL_SIGNUP_EXISTS_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  GOOGLE_LOGIN_FAILED_MESSAGE,
} from '../authErrors'
import { goToGoogleLogin, MOCK_GOOGLE_EMAIL } from '../googleLogin'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

// 가짜 모드(MSW) 여부를 테스트마다 바꾼다. 기본은 실서버 모드
const mode = vi.hoisted(() => ({ mock: false }))
vi.mock('@/shared/api/mockMode', () => ({
  get isMockApi() {
    return mode.mock
  },
}))
vi.mock('../googleLogin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../googleLogin')>()),
  goToGoogleLogin: vi.fn(),
}))
const goGoogle = vi.mocked(goToGoogleLogin)

/** gateway 오류 응답 {code, message, traceId} 를 받은 axios 오류 */
function apiError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code, traceId: null } },
  })
}

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
  const [pathname, search = ''] = path.split('?')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/', element: <p>루트</p> },
      { path: '/customer', element: <p>고객 홈</p> },
      { path: '/customer/orders/new', element: <p>주문 화면</p> },
      { path: '/owner/inventory', element: <p>점주 재고</p> },
      { path: '/admin/stores', element: <p>관리자 점포</p> },
      { path: '/admin/stores/new', element: <p>점포 등록</p> },
    ],
    { initialEntries: [{ pathname, search: search ? `?${search}` : '', state }] },
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
const signOut = vi.fn(async (notice?: LoginNotice) => {
  useAuthStore.setState({ user: null, loginNotice: notice ?? null })
})

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  signIn.mockReset()
  signUp.mockClear()
  confirmSignUp.mockReset().mockResolvedValue(undefined)
  signOut.mockClear()
  goGoogle.mockClear()
  mode.mock = false
  signIn.mockImplementation(async () => {
    useAuthStore.setState({ user: customer })
    return customer
  })
  useAuthStore.setState({
    user: null,
    restoring: false,
    loginNotice: null,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
  })
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

  it('로그인 전에 보던 주문 화면으로 주소 쿼리까지 그대로 돌려보낸다', async () => {
    get.mockResolvedValue({ data: profile })
    const router = renderAt('/login', { from: '/customer/orders/new?storeId=1&productId=15' })
    await fillLogin()
    expect(await screen.findByText('주문 화면')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?storeId=1&productId=15')
  })

  it('비밀번호가 틀리면 공통 문구를 띄우고 머문다', async () => {
    signIn.mockRejectedValue(apiError(401, 'INVALID_CREDENTIALS'))
    const toastError = vi.spyOn(toast, 'error')
    const router = renderAt('/login')
    await fillLogin()
    await waitFor(() => expect(signIn).toHaveBeenCalled())
    expect(router.state.location.pathname).toBe('/login')
    expect(toastError).toHaveBeenCalledWith('이메일 또는 비밀번호를 확인해 주세요.')
    toastError.mockRestore()
  })

  it('역할 없는 계정(403 NO_ROLE)은 담당자 문의 문구를 띄운다', async () => {
    signIn.mockRejectedValue(apiError(403, 'NO_ROLE'))
    const toastError = vi.spyOn(toast, 'error')
    renderAt('/login')
    await fillLogin()
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        '계정에 역할이 지정되지 않았어요. 테스트 담당자에게 문의해 주세요.',
      ),
    )
    toastError.mockRestore()
  })

  it('이메일 인증 전 계정이면 인증 코드 입력으로 보낸다', async () => {
    signIn.mockRejectedValue(apiError(403, 'USER_NOT_CONFIRMED'))
    renderAt('/login')
    await fillLogin()
    expect(await screen.findByLabelText('인증 코드')).toBeInTheDocument()
    expect(screen.getByText('kim@test.com')).toBeInTheDocument()
  })
})

describe('구글 로그인 (C-02)', () => {
  it('실서버 모드에서는 gateway 로 전체 페이지 이동하고 이메일 로그인은 부르지 않는다', async () => {
    renderAt('/login')
    await userEvent.click(screen.getByRole('button', { name: '구글로 로그인' }))
    expect(goGoogle).toHaveBeenCalledTimes(1)
    expect(signIn).not.toHaveBeenCalled()
  })

  it('실서버 모드에서는 가짜 로그인 안내문이 없다', () => {
    renderAt('/login')
    expect(screen.queryByText(/개발용 가짜 로그인/)).not.toBeInTheDocument()
  })

  it('가짜 모드에서는 가짜 구글 고객으로 로그인하고 루트로 간다', async () => {
    mode.mock = true
    const router = renderAt('/login')
    expect(screen.getByText(/개발용 가짜 로그인/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '구글로 로그인' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith(MOCK_GOOGLE_EMAIL, 'mock'))
    expect(goGoogle).not.toHaveBeenCalled()
    // 이미 로그인한 사용자는 로그인 화면이 역할 홈으로 보낼 수도 있어 둘 다 허용한다
    await waitFor(() => expect(['/', '/customer']).toContain(router.state.location.pathname))
  })

  it('구글 로그인이 실패해 ?error=google 로 돌아오면 안내를 띄우고 다시 누를 수 있다', async () => {
    renderAt('/login?error=google')
    expect(screen.getByRole('alert')).toHaveTextContent(GOOGLE_LOGIN_FAILED_MESSAGE)
    const button = screen.getByRole('button', { name: '구글로 로그인' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(goGoogle).toHaveBeenCalledTimes(1)
  })

  it('가짜 모드 구글 로그인이 실패하면 로그인 실패 문구를 띄우고 머문다', async () => {
    mode.mock = true
    signIn.mockRejectedValue(apiError(502, 'AUTH_UNAVAILABLE'))
    const toastError = vi.spyOn(toast, 'error')
    const router = renderAt('/login')
    await userEvent.click(screen.getByRole('button', { name: '구글로 로그인' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.'),
    )
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByRole('button', { name: '구글로 로그인' })).toBeEnabled()
    toastError.mockRestore()
  })

  it('이메일 가입자 막기 안내(loginNotice)를 띄운다', () => {
    useAuthStore.setState({ loginNotice: 'EMAIL_SIGNUP_EXISTS' })
    renderAt('/login')
    expect(screen.getByRole('alert')).toHaveTextContent(EMAIL_SIGNUP_EXISTS_MESSAGE)
  })

  it('안내가 없으면 알림 상자가 없다', () => {
    renderAt('/login')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    // 역할은 보내지 않는다 (가입 확인 Lambda 가 직접 가입은 항상 CUSTOMER)
    expect(signUp).toHaveBeenCalledWith({ email: 'kim@test.com', password: 'Abcd123!' })
    await userEvent.type(await screen.findByLabelText('인증 코드'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '인증하기' }))

    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
    expect(confirmSignUp).toHaveBeenCalledWith('kim@test.com', '123456')
    expect(signIn).toHaveBeenCalledWith('kim@test.com', 'Abcd123!')
    // member-service 로 비밀번호·이메일을 보내지 않는다
    expect(post).toHaveBeenCalledWith('/members/me', {
      name: '김경우',
      nickname: 'Fresh02',
      region: 'BUSAN',
    })
  })

  it('인증 뒤 프로필을 자동 저장하는 동안에는 입력 창 대신 저장 중 안내만 보여 준다', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/nickname-availability')
        return { data: { nickname: 'Fresh02', available: true } }
      throw notFound
    })
    let finishSave: (v: unknown) => void = () => {}
    post.mockReturnValueOnce(new Promise((resolve) => (finishSave = resolve)))
    renderAt('/signup')

    await fillSignup()
    await userEvent.type(await screen.findByLabelText('인증 코드'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '인증하기' }))

    expect(await screen.findByText('프로필을 저장하고 있어요…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '프로필 등록' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument()

    finishSave({ data: { ...profile, nickname: 'Fresh02', region: 'BUSAN' } })
    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
  })

  it('인증 뒤 프로필 저장이 실패해도 로그인은 그대로 두고 프로필만 다시 저장하게 한다', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/nickname-availability')
        return { data: { nickname: 'Fresh02', available: true } }
      throw notFound
    })
    post
      .mockRejectedValueOnce(
        Object.assign(new Error('500'), { isAxiosError: true, response: { status: 500 } }),
      )
      .mockResolvedValueOnce({ data: { ...profile, nickname: 'Fresh02', region: 'BUSAN' } })
    const toastError = vi.spyOn(toast, 'error')
    renderAt('/signup')

    await fillSignup()
    await userEvent.type(await screen.findByLabelText('인증 코드'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '인증하기' }))

    // 자동 저장이 실패하면 가입 때 넣은 값이 채워진 프로필 창에 머문다
    const retry = await screen.findByRole('button', { name: '프로필 등록' })
    expect(screen.getByLabelText('닉네임')).toHaveValue('Fresh02')
    expect(screen.queryByText('고객 홈')).not.toBeInTheDocument()
    expect(toastError).toHaveBeenCalledWith('프로필 저장에 실패했어요. 다시 시도해 주세요.')

    await userEvent.click(retry)
    expect(await screen.findByText('고객 홈')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(confirmSignUp).toHaveBeenCalledTimes(1)
    toastError.mockRestore()
  })

  it('이미 있는 이메일(409 EMAIL_ALREADY_EXISTS)이면 공통 안내를 띄우고 코드 단계로 가지 않는다', async () => {
    get.mockResolvedValue({ data: { nickname: 'Fresh02', available: true } })
    signUp.mockRejectedValueOnce(apiError(409, 'EMAIL_ALREADY_EXISTS'))
    const toastError = vi.spyOn(toast, 'error')
    renderAt('/signup')
    await fillSignup()
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(EMAIL_TAKEN_MESSAGE))
    expect(screen.queryByLabelText('인증 코드')).not.toBeInTheDocument()
    toastError.mockRestore()
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
    confirmSignUp.mockRejectedValue(apiError(400, 'CODE_MISMATCH'))
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

  it('구글 첫 사용자가 이미 이메일로 가입했으면(409 EMAIL_SIGNUP_EXISTS) 로그아웃하고 로그인 화면에서 안내한다', async () => {
    useAuthStore.setState({ user: customer })
    get.mockRejectedValue(notFound)
    post.mockRejectedValue(apiError(409, 'EMAIL_SIGNUP_EXISTS'))
    const toastError = vi.spyOn(toast, 'error')
    const router = renderAt('/signup')
    await userEvent.type(await screen.findByLabelText('이름'), '김경우')
    await userEvent.type(screen.getByLabelText('닉네임'), 'Fresh03')
    await userEvent.selectOptions(screen.getByLabelText('거주 지역'), 'SEOUL')
    await userEvent.click(screen.getByRole('button', { name: '프로필 등록' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(signOut).toHaveBeenCalledWith('EMAIL_SIGNUP_EXISTS')
    expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_SIGNUP_EXISTS_MESSAGE)
    expect(toastError).not.toHaveBeenCalled()
    toastError.mockRestore()
  })
})
