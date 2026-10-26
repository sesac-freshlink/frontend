import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { DisposalHistoryItem } from '../api'
import { DisposalHistory, HISTORY_LIMIT } from './DisposalHistory'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const items: DisposalHistoryItem[] = [
  {
    disposalId: 503,
    lotId: 412,
    productId: 3,
    productName: '흰우유 200ml',
    expiryDate: '2026-10-24T23:59:59+09:00',
    quantity: 10,
    status: 'REQUESTED',
    createdAt: '2026-10-25T12:05:00+09:00',
    processedAt: null,
  },
  {
    disposalId: 502,
    lotId: 502,
    productId: 12,
    productName: '샌드위치 햄치즈',
    expiryDate: '2026-10-26T09:00:00+09:00',
    quantity: 2,
    status: 'SKIPPED',
    createdAt: '2026-10-25T09:40:00+09:00',
    processedAt: '2026-10-25T09:40:02+09:00',
  },
  {
    disposalId: 501,
    lotId: 200,
    productId: 2,
    productName: '바나나우유',
    expiryDate: '2026-10-18T23:59:59+09:00',
    quantity: 5,
    status: 'DONE',
    createdAt: '2026-10-25T09:00:00+09:00',
    processedAt: '2026-10-25T09:00:01+09:00',
  },
]

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

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DisposalHistory />
    </QueryClientProvider>,
  )
}

describe('최근 폐기 요청 (S-33)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderHistory()
    expect(screen.getByLabelText('폐기 요청 불러오는 중')).toBeInTheDocument()
  })

  it('요청을 최신순으로 상태 배지와 함께 보여 준다', async () => {
    get.mockResolvedValue({ data: items })
    renderHistory()

    expect(await screen.findByText('흰우유 200ml')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/disposals')

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)

    expect(within(rows[0]).getByText('처리 중')).toBeInTheDocument()
    expect(within(rows[0]).getByText('10/25 12:05')).toBeInTheDocument()
    expect(within(rows[0]).getByText('-')).toBeInTheDocument()

    expect(within(rows[1]).getByText('샌드위치 햄치즈')).toBeInTheDocument()
    expect(within(rows[1]).getByText('반영 안 됨')).toBeInTheDocument()
    // 요청 시각과 처리 시각이 같은 분이라 둘 다 보인다
    expect(within(rows[1]).getAllByText('10/25 09:40')).toHaveLength(2)
    expect(rows[1]).toHaveAttribute('data-status', 'SKIPPED')

    expect(within(rows[2]).getByText('바나나우유')).toBeInTheDocument()
    expect(within(rows[2]).getByText('폐기 완료')).toBeInTheDocument()
    expect(within(rows[2]).getByText('10/18')).toBeInTheDocument()
  })

  it('반영 안 된 이유를 안내한다', async () => {
    get.mockResolvedValue({ data: items })
    renderHistory()
    await screen.findByText('흰우유 200ml')
    expect(screen.getByText(/처리 시점에 예약이 잡혀 있어/)).toBeInTheDocument()
  })

  it('최근 건수만 보여 준다', async () => {
    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => ({
      ...items[2],
      disposalId: 1000 - i,
    }))
    get.mockResolvedValue({ data: many })
    renderHistory()
    await screen.findAllByText('바나나우유')
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(HISTORY_LIMIT)
  })

  it('빈 목록이면 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({ data: [] })
    renderHistory()
    expect(await screen.findByText('아직 폐기 요청이 없어요.')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(serverError(403, 'STORE_NOT_LINKED', '연결된 점포가 없습니다'))
    renderHistory()
    expect(await screen.findByText('연결된 점포가 없습니다')).toBeInTheDocument()
  })
})
