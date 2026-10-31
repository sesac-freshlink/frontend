import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { AdminStore, PageResponse, StoreImageUploadUrl } from '../api'
import { AdminStoresPage } from './AdminStoresPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
const post = vi.mocked(api.post)
const success = vi.mocked(toast.success)

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 브라우저 동작을 필요한 만큼만 흉내 낸다.
// - showModal: open 속성, 그때 포커스된 요소를 기억, Escape keydown → cancel(취소 가능) → 막히지 않으면 close
// - close: open 속성 제거, 기억한 요소로 포커스 복귀, close 이벤트는 브라우저처럼 다음 태스크에 보낸다
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const originalShowModal = dialogProto.showModal
const originalClose = dialogProto.close
const opener = new WeakMap<HTMLDialogElement, Element | null>()
const escListener = new WeakMap<HTMLDialogElement, (e: KeyboardEvent) => void>()

beforeAll(() => {
  if (!originalShowModal) {
    dialogProto.showModal = function showModal(this: HTMLDialogElement) {
      opener.set(this, document.activeElement)
      this.setAttribute('open', '')
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        const cancel = new Event('cancel', { cancelable: true })
        if (this.dispatchEvent(cancel)) this.close()
      }
      escListener.set(this, onKey)
      this.addEventListener('keydown', onKey)
    }
  }
  if (!originalClose) {
    dialogProto.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      const onKey = escListener.get(this)
      if (onKey) this.removeEventListener('keydown', onKey)
      const prev = opener.get(this)
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus()
      setTimeout(() => this.dispatchEvent(new Event('close')), 0)
    }
  }
})

afterAll(() => {
  dialogProto.showModal = originalShowModal
  dialogProto.close = originalClose
})

function store(id: number, overrides: Partial<AdminStore> = {}): AdminStore {
  return {
    storeId: id,
    storeCode: `S${id}`,
    name: `프레시 ${id}호점`,
    address: `테스트시 ${id}번길`,
    region: 'BUSAN',
    status: 'ACTIVE',
    ownerEmail: `owner${id}@test.com`,
    createdAt: '2026-10-01T10:00:00+09:00',
    latitude: null,
    longitude: null,
    description: null,
    imageUrl: null,
    ...overrides,
  }
}

function pageOf(content: AdminStore[], page = 0, totalElements = content.length) {
  const body: PageResponse<AdminStore> = {
    content,
    page,
    size: 20,
    totalElements,
    totalPages: Math.ceil(totalElements / 20),
  }
  return { data: body }
}

function axiosError(status: number, code: string) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: { code, message: '서버 문구', traceId: 't' } },
  })
}

const gangnam = store(1, {
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
})
const closed = store(7, { status: 'INACTIVE' })
const pending = store(20, { status: 'PENDING', ownerEmail: null })

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const router = createMemoryRouter(
    [
      { path: '/admin/stores', element: <AdminStoresPage /> },
      { path: '/admin/stores/new', element: <p>등록 화면</p> },
    ],
    { initialEntries: ['/admin/stores'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { invalidate, router }
}

function rowOf(name: string) {
  const row = screen.getByText(name).closest('tr')
  if (!row) throw new Error(`행 없음: ${name}`)
  return within(row)
}

async function openEdit(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `${name} 수정` }))
  return within(screen.getByRole('dialog', { name: '점포 정보 수정' }))
}

beforeEach(() => {
  get.mockReset()
  patch.mockReset()
  post.mockReset()
  success.mockReset()
})

describe('관리자 점포 목록 (A-02)', () => {
  it('불러오는 동안 로딩 표시', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('불러오지 못하면 오류 문구를 보이고 [다시 시도]로 다시 읽는다', async () => {
    get.mockRejectedValueOnce(new Error('500')).mockResolvedValue(pageOf([gangnam]))
    renderPage()
    expect(await screen.findByText('점포 목록을 불러오지 못했어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('프레시 강남점')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('점포가 없으면 안내한다', async () => {
    get.mockResolvedValue(pageOf([]))
    renderPage()
    expect(await screen.findByText('등록된 점포가 없어요')).toBeInTheDocument()
  })

  it('0페이지부터 읽고 [다음]으로 다음 페이지를 읽는다', async () => {
    const first = Array.from({ length: 20 }, (_, i) => store(21 - i))
    get.mockImplementation(async (_url, config) =>
      (config?.params as { page?: number } | undefined)?.page === 1
        ? pageOf([store(1)], 1, 21)
        : pageOf(first, 0, 21),
    )
    renderPage()

    expect(await screen.findByText('프레시 21호점')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/admin/stores', { params: { page: 0 } })
    expect(screen.getAllByRole('row')).toHaveLength(21) // 머리 1 + 20행
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/admin/stores', { params: { page: 1 } })
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('프레시 1호점')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled()
  })

  it('시도 코드를 한글 이름으로, 상태를 배지로 보여 준다', async () => {
    get.mockResolvedValue(pageOf([gangnam, closed]))
    renderPage()
    await screen.findByText('프레시 강남점')
    expect(rowOf('프레시 강남점').getByText('서울특별시')).toBeInTheDocument()
    expect(rowOf('프레시 강남점').getByText('운영 중')).toBeInTheDocument()
    expect(rowOf('프레시 7호점').getByText('운영 중단')).toBeInTheDocument()
  })

  it('PENDING 점포는 이메일 "-", "등록 중" 배지, [수정] 비활성', async () => {
    get.mockResolvedValue(pageOf([pending, gangnam]))
    renderPage()
    await screen.findByText('프레시 20호점')
    const row = rowOf('프레시 20호점')
    expect(row.getByText('-')).toBeInTheDocument()
    expect(row.getByText('등록 중')).toBeInTheDocument()
    expect(row.getByRole('button', { name: '프레시 20호점 수정' })).toBeDisabled()
    await userEvent.click(row.getByRole('button', { name: '프레시 20호점 수정' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('[점포 등록]은 등록 화면으로 간다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    const { router } = renderPage()
    await userEvent.click(await screen.findByRole('link', { name: '점포 등록' }))
    expect(router.state.location.pathname).toBe('/admin/stores/new')
  })
})

describe('관리자 점포 수정 모달 (A-02)', () => {
  it('ACTIVE 점포 [수정] → 행 값이 초기값, 바꾼 게 없으면 [저장] 비활성', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    expect(dialog.getByLabelText('점포명')).toHaveValue('프레시 강남점')
    expect(dialog.getByLabelText('주소')).toHaveValue('서울 강남구 테헤란로 1')
    expect(dialog.getByLabelText('시도')).toHaveValue('SEOUL')
    expect(dialog.getByText('S1')).toBeInTheDocument()
    expect(dialog.getByText('owner1@test.com')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('INACTIVE 점포도 수정할 수 있고 초기값이 맞다', async () => {
    get.mockResolvedValue(pageOf([closed]))
    renderPage()
    const dialog = await openEdit('프레시 7호점')
    expect(dialog.getByLabelText('점포명')).toHaveValue('프레시 7호점')
    expect(dialog.getByLabelText('시도')).toHaveValue('BUSAN')
  })

  it('점포명만 바꾸면 name 만 보내고, 200 이면 닫고 안내·목록 재조회', async () => {
    let current = gangnam
    get.mockImplementation(async () => pageOf([current]))
    patch.mockImplementation(async () => {
      current = { ...gangnam, name: '프레시 신사점' }
      return { data: current }
    })
    const { invalidate } = renderPage()
    const dialog = await openEdit('프레시 강남점')

    await userEvent.clear(dialog.getByLabelText('점포명'))
    await userEvent.type(dialog.getByLabelText('점포명'), '프레시 신사점')
    expect(dialog.getByRole('button', { name: '저장' })).toBeEnabled()
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('/admin/stores/1', { name: '프레시 신사점' })
    expect(success).toHaveBeenCalledWith('점포 정보를 수정했어요')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'stores'] })
    expect(await screen.findByText('프레시 신사점')).toBeInTheDocument()
  })

  it.each([
    [409, 'STORE_NAME_DUPLICATED', '이미 있는 점포명입니다'],
    [409, 'STORE_NOT_EDITABLE', '등록 중인 점포는 수정할 수 없습니다'],
    [404, 'STORE_NOT_FOUND', '점포가 없습니다'],
  ])('%i %s → 문구를 보이고 모달 유지, 목록 재조회', async (status, code, text) => {
    get.mockResolvedValue(pageOf([gangnam]))
    patch.mockRejectedValue(axiosError(status, code))
    const { invalidate } = renderPage()
    const dialog = await openEdit('프레시 강남점')

    await userEvent.type(dialog.getByLabelText('주소'), ' 2층')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))

    expect(await dialog.findByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(patch).toHaveBeenCalledWith('/admin/stores/1', { address: '서울 강남구 테헤란로 1 2층' })
    expect(success).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'stores'] })
  })

  it('[취소]하면 닫히고 바꾼 값은 버린다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    let dialog = await openEdit('프레시 강남점')
    await userEvent.clear(dialog.getByLabelText('점포명'))
    await userEvent.type(dialog.getByLabelText('점포명'), '바뀐 이름')
    await userEvent.click(dialog.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    dialog = await openEdit('프레시 강남점')
    expect(dialog.getByLabelText('점포명')).toHaveValue('프레시 강남점')
    expect(patch).not.toHaveBeenCalled()
  })

  it('Escape 로 닫히고 바꾼 값은 버린다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    let dialog = await openEdit('프레시 강남점')
    await userEvent.selectOptions(dialog.getByLabelText('시도'), 'BUSAN')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await openEdit('프레시 강남점')
    expect(dialog.getByLabelText('시도')).toHaveValue('SEOUL')
    expect(patch).not.toHaveBeenCalled()
  })

  it('열면 점포명 입력에 포커스', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    expect(dialog.getByLabelText('점포명')).toHaveFocus()
  })

  it('Escape(cancel) 로 닫히면 연 [수정] 버튼으로 포커스가 돌아간다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.type(dialog.getByLabelText('주소'), ' 2층')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '프레시 강남점 수정' })).toHaveFocus()
    expect(patch).not.toHaveBeenCalled()
  })

  it('[취소]로 닫혀도 [수정] 버튼으로 포커스가 돌아간다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.click(dialog.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '프레시 강남점 수정' })).toHaveFocus()
  })

  it('저장 중에는 Escape(cancel)를 막아 모달이 남는다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    patch.mockReturnValue(new Promise(() => {}))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.type(dialog.getByLabelText('주소'), ' 2층')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled())

    const cancel = new Event('cancel', { cancelable: true })
    screen.getByRole('dialog').dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await userEvent.keyboard('{Escape}')
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
  })

  it('저장 중 cancel 없이 닫히면 다시 열고, 저장 실패 문구를 모달에 보인다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    let reject: (e: unknown) => void = () => {}
    patch.mockReturnValue(
      new Promise((_, r) => {
        reject = r
      }),
    )
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.type(dialog.getByLabelText('주소'), ' 2층')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled())

    // Chrome close watcher 처럼 cancel 없이 바로 닫는다
    const el = screen.getByRole('dialog')
    if (!(el instanceof HTMLDialogElement)) throw new Error('dialog 아님')
    el.close()
    expect(el).not.toHaveAttribute('open')
    await waitFor(() => expect(el).toHaveAttribute('open'))
    expect(el).toBeInTheDocument()

    reject(axiosError(404, 'STORE_NOT_FOUND'))
    expect(await dialog.findByRole('alert')).toHaveTextContent('점포가 없습니다')
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(success).not.toHaveBeenCalled()
  })
})

describe('점포 상세 값·이미지 (A-02 수정 모달)', () => {
  const issued: StoreImageUploadUrl = {
    uploadUrl:
      'https://bucket.s3.ap-northeast-2.amazonaws.com/images/stores/1/abc.jpg?X-Amz-Expires=300',
    imageKey: 'images/stores/1/abc.jpg',
    imageUrl: '/images/stores/1/abc.jpg',
    contentType: 'image/jpeg',
    expiresAt: '2026-10-30T22:05:00+09:00',
  }

  beforeAll(() => {
    // jsdom 에는 미리보기 임시 주소가 없다
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('좌표·설명을 넣으면 숫자·앞뒤 공백 뺀 글자로 보낸다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    patch.mockResolvedValue({ data: gangnam })
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.type(dialog.getByLabelText('위도'), '37.498095')
    await userEvent.type(dialog.getByLabelText('경도'), '127.02761')
    await userEvent.type(dialog.getByLabelText('점포 설명'), ' 강남역 11번 출구 ')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/stores/1', {
        latitude: 37.498095,
        longitude: 127.02761,
        description: '강남역 11번 출구',
      }),
    )
  })

  it('좌표가 범위를 넘으면 칸 아래에 안내하고 보내지 않는다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.type(dialog.getByLabelText('위도'), '91')
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))

    expect(
      await dialog.findByText('-90~90 사이 숫자(소수 6자리까지)로 입력하세요'),
    ).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it('JPG 를 고르면 업로드 주소를 받아 그 주소로 바로 올리고, 저장 때 imageKey 를 보낸다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    post.mockResolvedValue({ data: issued })
    patch.mockResolvedValue({ data: gangnam })
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    const file = new File(['jpg'], 'store.jpg', { type: 'image/jpeg' })
    await userEvent.upload(dialog.getByLabelText('이미지 올리기'), file)

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/stores/1/image-upload-url'))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(issued.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: file,
      }),
    )
    expect(await dialog.findByRole('img', { name: '프레시 강남점 점포' })).toHaveAttribute(
      'src',
      'blob:preview',
    )
    await userEvent.click(dialog.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/admin/stores/1', {
        imageKey: 'images/stores/1/abc.jpg',
      }),
    )
    vi.unstubAllGlobals()
  })

  it('JPG 가 아니면 올리지 않고 안내한다', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    fireEvent.change(dialog.getByLabelText('이미지 올리기'), {
      target: { files: [new File(['png'], 'store.png', { type: 'image/png' })] },
    })

    expect(await dialog.findByRole('alert')).toHaveTextContent('JPG 이미지만 올릴 수 있어요')
    expect(post).not.toHaveBeenCalled()
  })

  it('S3 에 올리지 못하면 안내하고 저장 버튼은 그대로 비활성', async () => {
    get.mockResolvedValue(pageOf([gangnam]))
    post.mockResolvedValue({ data: issued })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    )
    renderPage()
    const dialog = await openEdit('프레시 강남점')
    await userEvent.upload(
      dialog.getByLabelText('이미지 올리기'),
      new File(['jpg'], 'store.jpg', { type: 'image/jpeg' }),
    )

    expect(await dialog.findByRole('alert')).toHaveTextContent('이미지를 올리지 못했어요')
    expect(dialog.getByRole('button', { name: '저장' })).toBeDisabled()
    vi.unstubAllGlobals()
  })
})
