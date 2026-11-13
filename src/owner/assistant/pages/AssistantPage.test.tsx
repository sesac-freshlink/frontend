import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { AssistantPage } from './AssistantPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const post = vi.mocked(api.post)

function apiError(status: number, code: string) {
  const headers = new AxiosHeaders()
  return new AxiosError(code, String(status), { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: { code, message: code, traceId: '' },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AssistantPage />
    </QueryClientProvider>,
  )
}

describe('AI 점주 비서', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('버튼을 누르면 질문 번호로 묻고 답과 출처·시각을 보여 준다', async () => {
    post.mockResolvedValue({
      data: {
        answer: '닭가슴살 샐러드 4개가 오늘 끝나요.',
        source: 'AI',
        generatedAt: '2026-11-20T14:05:12+09:00',
      },
    })
    renderPage()

    await userEvent.click(
      screen.getByRole('button', { name: '오늘까지 유통기한이 끝나는 상품 알려줘' }),
    )

    expect(post).toHaveBeenCalledWith('/owner/inventory/assistant/ask', { presetId: 'Q1' })
    expect(await screen.findByText('닭가슴살 샐러드 4개가 오늘 끝나요.')).toBeInTheDocument()
    expect(screen.getByText('AI가 만든 답이에요 · 14:05 기준')).toBeInTheDocument()
  })

  it('직접 입력은 앞뒤 공백을 빼서 보내고, 규칙 답이면 그렇게 알린다', async () => {
    post.mockResolvedValue({
      data: {
        answer: '지금은 AI가 답할 수 없어요.',
        source: 'RULE',
        generatedAt: '2026-11-20T09:30:00+09:00',
      },
    })
    renderPage()

    await userEvent.type(screen.getByLabelText('AI 비서에게 질문'), '  라면 몇 개 남았어?  ')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))

    expect(post).toHaveBeenCalledWith('/owner/inventory/assistant/ask', {
      question: '라면 몇 개 남았어?',
    })
    expect(await screen.findByText('기본 규칙으로 만든 답이에요 · 09:30 기준')).toBeInTheDocument()
  })

  it('입력칸은 200자까지만 받고 비어 있으면 보낼 수 없다', async () => {
    renderPage()
    const input = screen.getByLabelText('AI 비서에게 질문')

    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    expect(input).toHaveAttribute('maxLength', '200')
    await userEvent.type(input, '   ')
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
  })

  it('답을 기다리는 동안 생각 중을 보이고 버튼을 막는다', async () => {
    let resolve: (value: unknown) => void = () => {}
    post.mockReturnValue(new Promise((r) => (resolve = r)))
    renderPage()

    await userEvent.click(
      screen.getByRole('button', { name: '재고가 부족하거나 곧 떨어질 상품 알려줘' }),
    )

    expect(screen.getByText('생각 중…')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '폐기가 많아서 덜 주문해야 할 상품 알려줘' }),
    ).toBeDisabled()
    resolve({ data: { answer: '없어요.', source: 'AI', generatedAt: '2026-11-20T14:05:12+09:00' } })
    await waitFor(() => expect(screen.queryByText('생각 중…')).not.toBeInTheDocument())
  })

  it.each([
    [503, 'ASSISTANT_DISABLED', '지금은 AI 비서를 쓸 수 없어요.'],
    [429, 'ASSISTANT_BUSY', '잠시 뒤 다시 물어봐 주세요.'],
    [429, 'ASSISTANT_RATE_LIMITED', '오늘 질문 횟수를 다 썼어요.'],
  ])('%s %s이면 "%s"를 보이고 화면은 그대로다', async (status, code, message) => {
    post.mockRejectedValue(apiError(status, code))
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' })).toBeEnabled()
  })
})
