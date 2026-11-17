import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { AssistantLauncher } from './AssistantLauncher'

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

function answer(
  text: string,
  source: 'AI' | 'RULE' = 'AI',
  generatedAt = '2026-11-20T14:05:12+09:00',
) {
  return { data: { answer: text, source, generatedAt } }
}

/** 버튼을 눌러 대화창을 연 상태로 그린다 */
async function renderOpened() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AssistantLauncher />
    </QueryClientProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'AI 비서 열기' }))
}

describe('AI 점주 비서 버튼과 대화창', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('처음에는 버튼만 있고, 누르면 대화창이 열리며 입력칸에 커서가 간다', async () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <AssistantLauncher />
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'AI 비서 열기' }))

    expect(screen.getByRole('dialog', { name: 'AI 비서' })).toBeInTheDocument()
    expect(screen.getByLabelText('AI 비서에게 질문')).toHaveFocus()
  })

  it('Esc로 닫으면 버튼으로 포커스가 돌아오고, 다시 열면 앞 질문과 답이 남아 있다', async () => {
    post.mockResolvedValue(answer('라면 12개 남았어요.'))
    await renderOpened()
    await userEvent.type(screen.getByLabelText('AI 비서에게 질문'), '라면 몇 개 남았어?{Enter}')
    expect(await screen.findByText('라면 12개 남았어요.')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const launcher = screen.getByRole('button', { name: 'AI 비서 열기' })
    expect(launcher).toHaveFocus()
    await userEvent.click(launcher)
    expect(screen.getByText('라면 12개 남았어요.')).toBeInTheDocument()
  })

  it('대화창의 X로도 닫힌다', async () => {
    await renderOpened()

    await userEvent.click(screen.getByRole('button', { name: '대화창 닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('버튼을 누르면 질문 번호로 묻고 답과 출처·시각을 보여 준다', async () => {
    post.mockResolvedValue(answer('닭가슴살 샐러드 4개가 오늘 끝나요.'))
    await renderOpened()

    await userEvent.click(
      screen.getByRole('button', { name: '오늘까지 유통기한이 끝나는 상품 알려줘' }),
    )

    expect(post).toHaveBeenCalledWith('/owner/inventory/assistant/ask', { presetId: 'Q1' })
    expect(await screen.findByText('닭가슴살 샐러드 4개가 오늘 끝나요.')).toBeInTheDocument()
    expect(screen.getByText('AI가 만든 답이에요 · 14:05 기준')).toBeInTheDocument()
  })

  it('자주 묻는 질문은 처음에만 펼쳐 두고, 질문하면 접었다가 다시 펼칠 수 있다', async () => {
    post.mockResolvedValue(answer('없어요.'))
    await renderOpened()
    const toggle = screen.getByRole('button', { name: '자주 묻는 질문' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' }))

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' }),
    ).not.toBeInTheDocument()
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' })).toBeVisible()
  })

  it('직접 입력은 앞뒤 공백을 빼서 보내고, 규칙 답이면 그렇게 알린다', async () => {
    post.mockResolvedValue(
      answer('지금은 AI가 답할 수 없어요.', 'RULE', '2026-11-20T09:30:00+09:00'),
    )
    await renderOpened()

    await userEvent.type(screen.getByLabelText('AI 비서에게 질문'), '  라면 몇 개 남았어?  ')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))

    expect(post).toHaveBeenCalledWith('/owner/inventory/assistant/ask', {
      question: '라면 몇 개 남았어?',
    })
    expect(await screen.findByText('기본 규칙으로 만든 답이에요 · 09:30 기준')).toBeInTheDocument()
  })

  it('입력칸은 200자까지만 받고 비어 있으면 보낼 수 없다', async () => {
    await renderOpened()
    const input = screen.getByLabelText('AI 비서에게 질문')

    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    expect(input).toHaveAttribute('maxLength', '200')
    await userEvent.type(input, '   ')
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
  })

  it('답을 기다리는 동안 생각 중을 보이고 질문을 막는다', async () => {
    let resolve: (value: unknown) => void = () => {}
    post.mockReturnValue(new Promise((r) => (resolve = r)))
    await renderOpened()

    await userEvent.type(screen.getByLabelText('AI 비서에게 질문'), '라면 몇 개 남았어?{Enter}')

    expect(screen.getByText('생각 중…')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('AI 비서에게 질문'), '두 번째')
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    resolve(answer('없어요.'))
    await waitFor(() => expect(screen.queryByText('생각 중…')).not.toBeInTheDocument())
  })

  it.each([
    [503, 'ASSISTANT_DISABLED', '지금은 AI 비서를 쓸 수 없어요.'],
    [429, 'ASSISTANT_BUSY', '잠시 뒤 다시 물어봐 주세요.'],
    [429, 'ASSISTANT_RATE_LIMITED', '오늘 질문 횟수를 다 썼어요.'],
  ])('%s %s이면 "%s"를 보이고 대화창은 그대로 쓸 수 있다', async (status, code, message) => {
    post.mockRejectedValue(apiError(status, code))
    await renderOpened()

    await userEvent.click(screen.getByRole('button', { name: '시간대별로 잘 팔리는 상품 알려줘' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('AI 비서에게 질문')).toBeEnabled()
  })
})
