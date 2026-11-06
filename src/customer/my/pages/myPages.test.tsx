import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore, type AuthUser } from '@/shared/auth'
import { MyPage } from './MyPage'
import { ProfileEditPage } from './ProfileEditPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const customer: AuthUser = { userId: 'sub-1', role: 'CUSTOMER', email: 'kim@test.com' }
const profile = {
  memberId: 'sub-1',
  role: 'CUSTOMER',
  name: '김경우',
  nickname: 'Fresh01',
  region: 'SEOUL',
}

/** gateway 오류 응답 {code, message, traceId} 를 받은 axios 오류 */
function apiError(status: number, code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message: code, traceId: null } },
  })
}

/** GET /members/me 는 profile, MB-01 은 available 로 답한다 */
function answerGet(available = true) {
  get.mockImplementation(async (url: string, config?: { params?: unknown }) => {
    if (url === '/members/me') return { data: profile }
    if (url === '/members/nickname-availability')
      return { data: { params: config?.params, available } }
    throw new Error(`예상 못 한 GET ${url}`)
  })
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/my', element: <MyPage /> },
      { path: '/customer/my/profile', element: <ProfileEditPage /> },
      { path: '/customer/orders', element: <p>주문 내역 화면</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const signOut = vi.fn(async () => undefined)

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: customer, signOut })
})

describe('MyPage (/customer/my)', () => {
  it('내 정보 4칸과 메뉴를 보여 주고, 비밀번호 변경은 준비 중이다', async () => {
    answerGet()
    renderAt('/customer/my')

    expect(await screen.findByText('Fresh01')).toBeInTheDocument()
    expect(screen.getByText('kim@test.com')).toBeInTheDocument()
    expect(screen.getByText('김경우')).toBeInTheDocument()
    expect(screen.getByText('서울특별시')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /회원정보 수정/ })).toHaveAttribute(
      'href',
      '/customer/my/profile',
    )
    expect(screen.getByRole('link', { name: /주문 내역/ })).toHaveAttribute(
      'href',
      '/customer/orders',
    )
    expect(screen.queryByRole('link', { name: /비밀번호 변경/ })).not.toBeInTheDocument()
    expect(screen.getByText('준비 중')).toBeInTheDocument()
  })

  it('이용약관을 누르면 두 약관을 창으로 보여 준다 (A16)', async () => {
    // jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다
    const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
    const { showModal, close } = proto
    proto.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    proto.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
    onTestFinished(() => {
      proto.showModal = showModal
      proto.close = close
    })
    answerGet()
    renderAt('/customer/my')
    await userEvent.click(await screen.findByRole('button', { name: /이용약관/ }))
    const dialog = screen.getByRole('dialog', { name: 'FreshLink 이용약관' })
    expect(dialog).toHaveTextContent('FreshLink 개인정보 처리방침')
  })

  it('로그아웃을 누르면 signOut', async () => {
    answerGet()
    renderAt('/customer/my')
    await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('내 정보를 못 읽으면 오류 안내', async () => {
    get.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))
    renderAt('/customer/my')
    expect(await screen.findByRole('alert')).toHaveTextContent('내 정보를 불러오지 못했어요')
  })
})

describe('ProfileEditPage (/customer/my/profile, MB-04)', () => {
  it('지금 값으로 미리 채우고, 바뀐 게 없으면 저장이 꺼져 있다', async () => {
    answerGet()
    renderAt('/customer/my/profile')

    expect(await screen.findByLabelText('이름')).toHaveValue('김경우')
    expect(screen.getByLabelText('닉네임')).toHaveValue('Fresh01')
    expect(screen.getByLabelText('거주 지역')).toHaveValue('SEOUL')
    expect(screen.getByLabelText('이메일')).toHaveValue('kim@test.com')
    expect(screen.getByLabelText('이메일')).toBeDisabled()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('이름만 바꾸면 이름만 보내고, MB-01 은 부르지 않고, 마이페이지로 돌아간다', async () => {
    answerGet()
    patch.mockResolvedValue({ data: { ...profile, name: '이태우', createdAt: '' } })
    const router = renderAt('/customer/my/profile')

    const name = await screen.findByLabelText('이름')
    await userEvent.clear(name)
    await userEvent.type(name, '이태우')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/my'))
    expect(patch).toHaveBeenCalledWith('/members/me', { name: '이태우' })
    expect(get).not.toHaveBeenCalledWith('/members/nickname-availability', expect.anything())
    expect(toast.success).toHaveBeenCalledWith('회원정보를 저장했어요')
  })

  it('대소문자만 바꾼 내 닉네임은 MB-01 없이 저장한다', async () => {
    answerGet(false)
    patch.mockResolvedValue({ data: { ...profile, nickname: 'FRESH01', createdAt: '' } })
    renderAt('/customer/my/profile')

    const nickname = await screen.findByLabelText('닉네임')
    await userEvent.clear(nickname)
    await userEvent.type(nickname, 'FRESH01')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/members/me', { nickname: 'FRESH01' }))
    expect(get).not.toHaveBeenCalledWith('/members/nickname-availability', expect.anything())
  })

  it('다른 닉네임이 이미 쓰이면 MB-01 결과로 칸 오류를 보이고 저장하지 않는다', async () => {
    answerGet(false)
    renderAt('/customer/my/profile')

    const nickname = await screen.findByLabelText('닉네임')
    await userEvent.clear(nickname)
    await userEvent.type(nickname, 'Taken1')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/members/nickname-availability', {
      params: { nickname: 'Taken1' },
    })
    expect(patch).not.toHaveBeenCalled()
  })

  it('저장 때 409 NICKNAME_DUPLICATED 면 닉네임 칸 오류', async () => {
    answerGet(true)
    patch.mockRejectedValue(apiError(409, 'NICKNAME_DUPLICATED'))
    renderAt('/customer/my/profile')

    const nickname = await screen.findByLabelText('닉네임')
    await userEvent.clear(nickname)
    await userEvent.type(nickname, 'Fresh02')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument()
  })

  it('그 밖의 저장 실패는 토스트', async () => {
    answerGet()
    patch.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))
    renderAt('/customer/my/profile')

    await userEvent.selectOptions(await screen.findByLabelText('거주 지역'), 'BUSAN')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('회원정보를 저장하지 못했어요. 다시 시도해 주세요.'),
    )
  })

  it('입력 규칙이 틀리면 저장이 꺼진다', async () => {
    answerGet()
    renderAt('/customer/my/profile')

    const name = await screen.findByLabelText('이름')
    await userEvent.clear(name)
    await userEvent.type(name, '김')
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeDisabled())
  })
})
