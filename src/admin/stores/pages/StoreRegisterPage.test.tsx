import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { StoreRegisterPage } from './StoreRegisterPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const post = vi.mocked(api.post)
const success = vi.mocked(toast.success)

function axiosError(status: number, code: string) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: { code, message: '서버 문구', traceId: 't' } },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const router = createMemoryRouter(
    [
      { path: '/admin/stores/new', element: <StoreRegisterPage /> },
      { path: '/admin/stores', element: <p>점포 목록</p> },
    ],
    { initialEntries: ['/admin/stores/new'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { invalidate, router }
}

interface Fill {
  name?: string
  address?: string
  region?: string
  ownerEmail?: string
  initialPassword?: string
}

async function fill({
  name = '강남점',
  address = '서울 강남구 테헤란로 1',
  region = 'BUSAN',
  ownerEmail = 'owner@test.com',
  initialPassword = 'Abcd!234',
}: Fill = {}) {
  if (name) await userEvent.type(screen.getByLabelText('점포명'), name)
  if (address) await userEvent.type(screen.getByLabelText('주소'), address)
  if (region) await userEvent.selectOptions(screen.getByLabelText('시도'), region)
  if (ownerEmail) await userEvent.type(screen.getByLabelText('점주 이메일'), ownerEmail)
  if (initialPassword) await userEvent.type(screen.getByLabelText('초기 비밀번호'), initialPassword)
}

const submit = () => userEvent.click(screen.getByRole('button', { name: '등록하기' }))

beforeEach(() => {
  post.mockReset()
  success.mockReset()
})

describe('점포·점주 등록 (A-01)', () => {
  it('빈 칸으로 제출하면 칸마다 빨간 문구를 보이고 보내지 않는다', async () => {
    renderPage()
    await submit()
    for (const text of ['2~30자로 입력하세요', '주소를 입력하세요', '시도를 고르세요']) {
      expect(await screen.findByText(text)).toHaveClass('text-red-600')
    }
    expect(screen.getByText('이메일 형식이 아닙니다')).toHaveClass('text-red-600')
    expect(screen.getByText('8자 이상 입력하세요')).toHaveClass('text-red-600')
    expect(post).not.toHaveBeenCalled()
  })

  it('시도를 고르지 않으면 보내지 않는다', async () => {
    renderPage()
    await fill({ region: '' })
    await submit()
    expect(await screen.findByText('시도를 고르세요')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('trim 뒤 1자인 점포명은 거부한다', async () => {
    renderPage()
    await fill({ name: '  가 ' })
    await submit()
    expect(await screen.findByText('2~30자로 입력하세요')).toHaveClass('text-red-600')
    expect(post).not.toHaveBeenCalled()
  })

  it('비밀번호에 대문자·특수문자가 없으면 거부한다', async () => {
    renderPage()
    await fill({ initialPassword: 'abcd1234' })
    await submit()
    expect(await screen.findByText('대문자를 넣어 주세요')).toHaveClass('text-red-600')
    expect(post).not.toHaveBeenCalled()
  })

  it('점포명 앞뒤 공백을 빼서 보낸다', async () => {
    post.mockResolvedValue({ data: {} })
    renderPage()
    await fill({ name: '  강남점  ' })
    await submit()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith('/admin/stores', {
      name: '강남점',
      address: '서울 강남구 테헤란로 1',
      region: 'BUSAN',
      ownerEmail: 'owner@test.com',
      initialPassword: 'Abcd!234',
    })
  })

  it('보내는 동안 버튼이 비활성이고 두 번 눌러도 한 번만 보낸다', async () => {
    post.mockReturnValue(new Promise(() => {}))
    renderPage()
    await fill()
    const button = screen.getByRole('button', { name: '등록하기' })
    await userEvent.dblClick(button)
    await waitFor(() => expect(button).toBeDisabled())
    await userEvent.click(button)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('201 이면 안내하고 모든 칸(시도 포함)을 비우고 목록을 다시 받는다', async () => {
    post.mockResolvedValue({ data: { storeId: 22, storeCode: 'S22' } })
    const { invalidate } = renderPage()
    await fill()
    await submit()

    await waitFor(() => expect(success).toHaveBeenCalledWith('점포를 등록했어요'))
    expect(screen.getByLabelText('점포명')).toHaveValue('')
    expect(screen.getByLabelText('주소')).toHaveValue('')
    expect(screen.getByLabelText('시도')).toHaveValue('')
    expect(screen.getByRole<HTMLOptionElement>('option', { name: '시도 선택' }).selected).toBe(true)
    expect(screen.getByLabelText('점주 이메일')).toHaveValue('')
    expect(screen.getByLabelText('초기 비밀번호')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'stores'] })
    expect(screen.getByRole('button', { name: '등록하기' })).toBeEnabled()
  })

  it.each([
    [409, 'STORE_NAME_DUPLICATED', '이미 있는 점포명입니다'],
    [409, 'OWNER_EMAIL_DUPLICATED', '이미 등록된 이메일입니다'],
    [500, 'STORE_REGISTRATION_FAILED', '점포 등록에 실패했습니다. 다시 시도해 주세요'],
    [403, 'FORBIDDEN', '권한이 없습니다'],
  ])('%i %s → 문구 그대로, 비밀번호 칸만 비우고 목록 재조회', async (status, code, text) => {
    post.mockRejectedValue(axiosError(status, code))
    const { invalidate } = renderPage()
    await fill()
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.getByLabelText('초기 비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('점포명')).toHaveValue('강남점')
    expect(screen.getByLabelText('주소')).toHaveValue('서울 강남구 테헤란로 1')
    expect(screen.getByLabelText('시도')).toHaveValue('BUSAN')
    expect(screen.getByLabelText('점주 이메일')).toHaveValue('owner@test.com')
    expect(success).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'stores'] })
  })

  it('모르는 오류·네트워크 오류는 일반 문구', async () => {
    post.mockRejectedValue(new Error('Network Error'))
    renderPage()
    await fill()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '점포를 등록하지 못했어요. 다시 시도해 주세요',
    )
  })

  it('[목록으로]는 점포 목록으로 간다', async () => {
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('link', { name: '목록으로' }))
    expect(router.state.location.pathname).toBe('/admin/stores')
  })
})
