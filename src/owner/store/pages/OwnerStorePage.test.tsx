import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { OwnerStore, OwnerStoreImageUploadUrl } from '../api'
import { OwnerStorePage } from './OwnerStorePage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
const post = vi.mocked(api.post)

const store: OwnerStore = {
  storeId: 1,
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
  latitude: 37.498,
  longitude: 127.028,
  description: '강남역 앞',
  imageUrl: null,
  status: 'ACTIVE',
}

const issued: OwnerStoreImageUploadUrl = {
  uploadUrl: 'https://s3.example/images/stores/1/a.jpg?sig',
  imageKey: 'images/stores/1/a.jpg',
  imageUrl: '/images/stores/1/a.jpg',
  contentType: 'image/jpeg',
  expiresAt: '2026-11-06T16:05:00+09:00',
}

/** gateway·member 오류 응답 {code, message, traceId} 를 받은 axios 오류 */
function apiError(status: number, code: string, message = code) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status, data: { code, message, traceId: null } },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OwnerStorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

/** 다른 사람(관리자)이 설명을 바꾼 뒤 화면이 서버 값을 다시 읽는다 */
async function refetchWithServerDescription(queryClient: QueryClient, description: string) {
  get.mockResolvedValue({ data: { ...store, description } })
  await act(() => queryClient.invalidateQueries({ queryKey: ['owner', 'store'] }))
}

const save = () => screen.getByRole('button', { name: '저장' })
const picker = () => screen.getByLabelText(/사진 고르기/)

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: store })
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => vi.unstubAllGlobals())

describe('OwnerStorePage (/owner/store, A15)', () => {
  it('이름·주소·시도·좌표는 보기만, 설명은 미리 채우고 바뀐 게 없으면 저장이 꺼져 있다', async () => {
    renderPage()
    expect(await screen.findByDisplayValue('프레시 강남점')).toBeDisabled()
    expect(screen.getByLabelText('주소')).toHaveValue('서울 강남구 테헤란로 1')
    expect(screen.getByLabelText('주소')).toBeDisabled()
    expect(screen.getByLabelText('시도')).toHaveValue('서울특별시')
    expect(screen.getByLabelText('지도 좌표')).toHaveValue('37.498, 127.028')
    expect(screen.getByText('관리자만 바꿀 수 있어요')).toBeInTheDocument()
    expect(screen.getByLabelText('점포 설명')).toHaveValue('강남역 앞')
    expect(save()).toBeDisabled()
    expect(get).toHaveBeenCalledWith('/owner/store')
  })

  it('설명만 바꾸면 설명만 보내고 안내 뒤 그 화면에 남는다', async () => {
    patch.mockResolvedValue({ data: { ...store, description: '24시간 영업' } })
    renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')
    await user.clear(field)
    await user.type(field, '24시간 영업')
    await user.click(save())

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('점포 정보를 수정했어요'))
    expect(patch).toHaveBeenCalledWith('/owner/store', { description: '24시간 영업' })
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '점포 수정' })).toBeInTheDocument()
  })

  it('사진을 고르면 바로 미리 보고, 저장하면 업로드 주소 → PUT → 키를 보낸다', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    post.mockResolvedValue({ data: issued })
    patch.mockResolvedValue({ data: { ...store, imageUrl: issued.imageUrl } })
    renderPage()
    const user = userEvent.setup()
    await screen.findByLabelText('점포 설명')
    const file = new File(['img'], 'store.jpg', { type: 'image/jpeg' })
    await user.upload(picker(), file)

    expect(screen.getByRole('img', { name: '프레시 강남점 점포' })).toHaveAttribute(
      'src',
      'blob:preview',
    )
    expect(post).not.toHaveBeenCalled()
    await user.click(save())

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/owner/store', { imageKey: issued.imageKey }),
    )
    expect(post).toHaveBeenCalledWith('/owner/store/image-upload-url', {
      contentType: 'image/jpeg',
    })
    expect(fetchMock).toHaveBeenCalledWith(issued.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: file,
    })
    expect(toast.success).toHaveBeenCalledWith('점포 정보를 수정했어요')
  })

  it('5MB 를 넘는 사진은 고르지 않고 안내한다', async () => {
    renderPage()
    const user = userEvent.setup()
    await screen.findByLabelText('점포 설명')
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(picker(), big)

    expect(screen.getByRole('alert')).toHaveTextContent('5MB 이하 사진만 올릴 수 있어요')
    expect(save()).toBeDisabled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('JPG·PNG 가 아니면 안내한다', async () => {
    renderPage()
    const user = userEvent.setup({ applyAccept: false })
    await screen.findByLabelText('점포 설명')
    await user.upload(picker(), new File(['x'], 'a.gif', { type: 'image/gif' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JPG나 PNG 이미지만 올릴 수 있어요')
  })

  it('저장 실패는 오류 코드 문구, 검증 오류는 서버 문구', async () => {
    renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')
    await user.type(field, '!')

    patch.mockRejectedValueOnce(apiError(409, 'STORE_NOT_EDITABLE'))
    await user.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '등록 중인 점포는 수정할 수 없습니다',
    )

    patch.mockRejectedValueOnce(
      apiError(400, 'VALIDATION_ERROR', 'description: 500자 이하여야 합니다'),
    )
    await user.click(save())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('description: 500자 이하여야 합니다'),
    )
  })

  it('설명이 500자를 넘으면 칸 오류, 저장이 꺼진다', async () => {
    renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')
    await user.clear(field)
    await user.click(field)
    await user.paste('가'.repeat(501))
    expect(await screen.findByText('500자까지 쓸 수 있어요')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('설명 길이는 앞뒤 공백을 지우고 센다: 500자 + 공백은 저장되고 공백 없이 보낸다', async () => {
    const text = '가'.repeat(500)
    patch.mockResolvedValue({ data: { ...store, description: text } })
    renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')
    await user.clear(field)
    await user.click(field)
    await user.paste(`  ${text}  `)

    await waitFor(() => expect(save()).toBeEnabled())
    expect(screen.queryByText('500자까지 쓸 수 있어요')).not.toBeInTheDocument()
    await user.click(save())
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/owner/store', { description: text }))
  })

  it('점주가 쓰는 중에 서버 설명이 바뀌어도 쓰던 글은 그대로이고, 저장하면 쓴 글을 보낸다', async () => {
    patch.mockResolvedValue({ data: { ...store, description: '점주가 쓴 설명' } })
    const queryClient = renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')
    await user.clear(field)
    await user.type(field, '점주가 쓴 설명')

    await refetchWithServerDescription(queryClient, '관리자가 바꾼 설명')

    expect(screen.getByLabelText('점포 설명')).toHaveValue('점주가 쓴 설명')
    await user.click(save())
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/owner/store', { description: '점주가 쓴 설명' }),
    )
  })

  it('사진만 고른 중에 서버 설명이 바뀌면 사진은 그대로, 설명 칸은 새 값이라 덮어쓰지 않는다', async () => {
    const queryClient = renderPage()
    const user = userEvent.setup()
    await screen.findByLabelText('점포 설명')
    await user.upload(picker(), new File(['img'], 'store.jpg', { type: 'image/jpeg' }))

    await refetchWithServerDescription(queryClient, '관리자가 바꾼 설명')

    await waitFor(() =>
      expect(screen.getByLabelText('점포 설명')).toHaveValue('관리자가 바꾼 설명'),
    )
    expect(screen.getByRole('img', { name: '프레시 강남점 점포' })).toHaveAttribute(
      'src',
      'blob:preview',
    )
  })

  it('건드리지 않은 칸은 서버 값을 따라가고, 저장 뒤에도 다시 서버 값을 따라간다', async () => {
    const queryClient = renderPage()
    const user = userEvent.setup()
    const field = await screen.findByLabelText('점포 설명')

    await refetchWithServerDescription(queryClient, '관리자가 바꾼 설명')
    await waitFor(() => expect(field).toHaveValue('관리자가 바꾼 설명'))

    get.mockResolvedValue({ data: { ...store, description: '저장한 설명' } })
    patch.mockResolvedValue({ data: { ...store, description: '저장한 설명' } })
    await user.clear(field)
    await user.type(field, '저장한 설명')
    await user.click(save())
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    await waitFor(() => expect(save()).toBeDisabled())

    await refetchWithServerDescription(queryClient, '또 바뀐 설명')
    await waitFor(() => expect(field).toHaveValue('또 바뀐 설명'))
  })

  it('연결된 점포가 없으면(404) 안내', async () => {
    get.mockRejectedValue(apiError(404, 'STORE_NOT_FOUND'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('연결된 점포가 없습니다')
  })
})
