import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { ProductMemo } from '../api'
import { MemoDialog } from './MemoDialog'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

const memo = (
  content: string,
  version: number,
  updatedAt = '2026-10-28T09:10:00+09:00',
): ProductMemo => ({
  productId: 15,
  productCode: 'P015',
  name: '매운 컵라면 115g',
  category: '라면',
  content,
  version,
  updatedAt,
})

/** 서버 오류 모양(common ErrorResponse)으로 axios 오류를 만든다 */
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

function renderDialog() {
  const onClose = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoDialog productId={15} productName="매운 컵라면 115g" onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

const textbox = () => screen.findByRole('textbox', { name: '내용' })

describe('점주 상품 메모 모달', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    del.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('메모가 없으면 빈 칸으로 열리고, 저장하면 version 없이 만든다', async () => {
    get.mockResolvedValue({ data: [] })
    put.mockResolvedValue({ data: memo('냉장 2칸에 둠', 0) })
    const onClose = renderDialog()

    const input = await textbox()
    expect(input).toHaveValue('')
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    await userEvent.type(input, '  냉장 2칸에 둠 ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(put).toHaveBeenCalledWith('/owner/inventory/memos/15', { content: '냉장 2칸에 둠' })
    expect(toast.success).toHaveBeenCalledWith('매운 컵라면 115g 메모를 저장했어요')
  })

  it('있는 메모는 내용을 채워 열고, 고치면 읽은 version 으로 저장한다', async () => {
    get.mockResolvedValue({ data: [memo('첫 메모', 3)] })
    put.mockResolvedValue({ data: memo('다음 주 입고 늘리기', 4) })
    const onClose = renderDialog()

    const input = await textbox()
    expect(input).toHaveValue('첫 메모')
    await userEvent.clear(input)
    await userEvent.type(input, '다음 주 입고 늘리기')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(put).toHaveBeenCalledWith('/owner/inventory/memos/15', {
      content: '다음 주 입고 늘리기',
      version: 3,
    })
  })

  it('내용을 다 지우고 저장하면 읽은 version 으로 지운다', async () => {
    get.mockResolvedValue({ data: [memo('지울 메모', 2)] })
    del.mockResolvedValue({ data: undefined })
    const onClose = renderDialog()

    await userEvent.clear(await textbox())
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(put).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith('/owner/inventory/memos/15', { params: { version: 2 } })
  })

  it('삭제 버튼도 읽은 version 으로 지운다', async () => {
    get.mockResolvedValue({ data: [memo('지울 메모', 5)] })
    del.mockResolvedValue({ data: undefined })
    const onClose = renderDialog()

    await textbox()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(del).toHaveBeenCalledWith('/owner/inventory/memos/15', { params: { version: 5 } })
    expect(toast.success).toHaveBeenCalledWith('매운 컵라면 115g 메모를 지웠어요')
  })

  it('메모가 없는데 빈 채로 저장하면 아무 요청 없이 닫는다', async () => {
    get.mockResolvedValue({ data: [] })
    const onClose = renderDialog()

    await textbox()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(onClose).toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('다른 화면이 먼저 고쳤으면(409) 쓰던 내용은 두고 그 내용을 보여 주며, 다시 저장하면 그 위에 덮어쓴다', async () => {
    // 처음 읽을 때는 version 3, 저장에 실패한 뒤 다시 읽으면 휴대폰이 고친 version 4
    get
      .mockResolvedValueOnce({ data: [memo('포스기에서 쓴 메모', 3)] })
      .mockResolvedValue({ data: [memo('휴대폰에서 고침', 4, '2026-10-29T10:05:00+09:00')] })
    put
      .mockRejectedValueOnce(
        serverError(409, 'MEMO_CHANGED', '다른 화면에서 메모가 바뀌었습니다. 다시 확인해 주세요'),
      )
      .mockResolvedValueOnce({ data: memo('포스기에서 고침', 5) })
    const onClose = renderDialog()

    const input = await textbox()
    await userEvent.clear(input)
    await userEvent.type(input, '포스기에서 고침')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('휴대폰에서 고침')).toBeInTheDocument()
    expect(screen.getByText('다른 화면에서 10/29 10:05에 저장한 내용')).toBeInTheDocument()
    expect(input).toHaveValue('포스기에서 고침')
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      '다른 화면에서 메모가 바뀌었습니다. 다시 확인해 주세요',
    )

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(put).toHaveBeenLastCalledWith('/owner/inventory/memos/15', {
      content: '포스기에서 고침',
      version: 4,
    })
  })

  it('목록을 못 읽으면 서버 message 와 닫기 버튼을 보여 준다', async () => {
    get.mockRejectedValue(serverError(500, 'INTERNAL_ERROR', '잠시 후 다시 시도해 주세요'))
    const onClose = renderDialog()

    expect(await screen.findByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
  })
})
