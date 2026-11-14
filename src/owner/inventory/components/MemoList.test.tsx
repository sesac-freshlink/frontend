import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { ProductMemo } from '../api'
import { MemoList } from './MemoList'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

const noodle: ProductMemo = {
  productId: 15,
  productCode: 'P015',
  name: '매운 컵라면 115g',
  category: '라면',
  content: '행사 끝나면 원래 자리로',
  version: 2,
  updatedAt: '2026-11-10T18:12:00+09:00',
}
const egg: ProductMemo = {
  productId: 21,
  productCode: 'P021',
  name: '계란 10구',
  category: '신선식품',
  content: '깨진 것 1판 반품 신청함',
  version: 0,
  updatedAt: '2026-11-11T20:41:00+09:00',
}

function serverError(status: number, code: string, message: string) {
  const headers = new AxiosHeaders()
  return new AxiosError(message, String(status), { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: { code, message, traceId: '' },
  })
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoList />
    </QueryClientProvider>,
  )
}

const card = (name: string) => screen.findByRole('article', { name: `${name} 메모` })

describe('메모 탭 포스트잇 (11/14)', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    del.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('메모마다 카드 하나, 카드 아래에 수정·삭제 버튼이 있다', async () => {
    get.mockResolvedValue({ data: [noodle, egg] })
    renderList()

    const first = await card('매운 컵라면 115g')
    expect(within(first).getByText('행사 끝나면 원래 자리로')).toBeInTheDocument()
    expect(within(first).getByText('라면')).toBeInTheDocument()
    expect(
      within(first).getByRole('button', { name: '매운 컵라면 115g 메모 수정' }),
    ).toBeInTheDocument()
    expect(
      within(first).getByRole('button', { name: '매운 컵라면 115g 메모 삭제' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('[수정]은 카드 안에서 고치고, 저장하면 처음 읽은 version 으로 보낸다', async () => {
    get.mockResolvedValue({ data: [noodle] })
    put.mockResolvedValue({ data: { ...noodle, content: '라면 3칸', version: 3 } })
    renderList()

    await userEvent.click(
      within(await card('매운 컵라면 115g')).getByRole('button', {
        name: '매운 컵라면 115g 메모 수정',
      }),
    )
    const editing = screen.getByRole('article', { name: '매운 컵라면 115g 메모 고치는 중' })
    const input = within(editing).getByRole('textbox', { name: '매운 컵라면 115g 메모' })
    expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.type(input, '라면 3칸')
    expect(within(editing).getByText('5/200')).toBeInTheDocument()
    await userEvent.click(within(editing).getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/memos/15', {
        content: '라면 3칸',
        version: 2,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('매운 컵라면 115g 메모를 저장했어요')
  })

  it('[취소]는 고치기를 닫고 [수정] 버튼으로 초점을 돌려준다', async () => {
    get.mockResolvedValue({ data: [noodle] })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 수정' }))
    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.getByRole('button', { name: '매운 컵라면 115g 메모 수정' })).toHaveFocus()
    expect(put).not.toHaveBeenCalled()
  })

  it('다른 화면이 먼저 바꿨으면(409) 그 내용을 보여 주고, 다시 저장하면 최신 version 으로 보낸다', async () => {
    get
      .mockResolvedValueOnce({ data: [noodle] })
      .mockResolvedValue({ data: [{ ...noodle, content: '라면 2칸', version: 3 }] })
    put
      .mockRejectedValueOnce(serverError(409, 'MEMO_CHANGED', '다른 화면에서 메모를 바꿨어요'))
      .mockResolvedValue({ data: {} })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 수정' }))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('라면 2칸')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('다른 화면에서 메모를 바꿨어요')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith('/owner/inventory/memos/15', {
        content: '행사 끝나면 원래 자리로',
        version: 3,
      }),
    )
  })

  it('[삭제]는 카드 안에서 한 번 더 묻고, 확인하면 version 과 함께 지운다', async () => {
    get.mockResolvedValue({ data: [noodle] })
    del.mockResolvedValue({ data: undefined })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 삭제' }))
    expect(screen.getByRole('alert')).toHaveTextContent('이 메모를 삭제할까요?')
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: '매운 컵라면 115g 메모 삭제 확인' }))

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith('/owner/inventory/memos/15', { params: { version: 2 } }),
    )
    expect(toast.success).toHaveBeenCalledWith('매운 컵라면 115g 메모를 삭제했어요')
    // 지운 카드가 사라져도 초점은 메모 목록에 남는다
    expect(screen.getByRole('region', { name: '메모' })).toHaveFocus()
  })

  it('마지막 메모를 지워 빈 안내가 떠도 초점은 메모 구역에 남는다', async () => {
    get.mockResolvedValueOnce({ data: [noodle] }).mockResolvedValue({ data: [] })
    del.mockResolvedValue({ data: undefined })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '매운 컵라면 115g 메모 삭제 확인' }))

    expect(await screen.findByText(/아직 메모가 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '메모' })).toHaveFocus()
  })

  it('삭제 묻기에서 [취소]를 누르면 지우지 않고 [삭제] 버튼으로 돌아간다', async () => {
    get.mockResolvedValue({ data: [noodle] })
    renderList()

    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '매운 컵라면 115g 메모 삭제' })).toHaveFocus()
    expect(del).not.toHaveBeenCalled()
  })

  it('메모가 없으면 재고 목록에서 남기라고 안내한다', async () => {
    get.mockResolvedValue({ data: [] })
    renderList()

    expect(
      await screen.findByText(
        '아직 메모가 없어요. 재고 목록에서 상품의 메모 버튼을 눌러 남길 수 있어요.',
      ),
    ).toBeInTheDocument()
  })

  it('상품명·메모 내용으로 검색하고 보이는 메모 개수를 보여 준다 (11/15)', async () => {
    get.mockResolvedValue({ data: [egg, noodle] })
    renderList()

    await card('계란 10구')
    expect(screen.getByText('메모 2개')).toBeInTheDocument()

    const search = screen.getByRole('searchbox', { name: '상품명·메모 검색' })
    await userEvent.type(search, '반품')
    expect(screen.getByText('메모 1개')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: '매운 컵라면 115g 메모' })).not.toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, '컵라면')
    expect(screen.getByRole('article', { name: '매운 컵라면 115g 메모' })).toBeInTheDocument()

    await userEvent.clear(search)
    await userEvent.type(search, '없는 말')
    expect(screen.getByText('검색한 내용이 든 메모가 없어요.')).toBeInTheDocument()
  })
})
