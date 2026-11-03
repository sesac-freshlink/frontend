import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { SalesRanking } from '../api'
import { statsPeriod } from '../format'
import { SalesRankingPanel } from './SalesRankingPanel'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const ranking: SalesRanking = {
  from: '2026-10-23',
  to: '2026-10-29',
  totalSoldQuantity: 12,
  items: [
    {
      rank: 1,
      productId: 1,
      productCode: 'P001',
      name: '제육볶음 도시락',
      category: '도시락',
      imageUrl: 'https://img.example/P001.jpg',
      soldQuantity: 5,
      share: 0.4167,
    },
    {
      rank: 2,
      productId: 12,
      productCode: 'P012',
      name: '흰 우유 500ml',
      category: '유제품',
      imageUrl: null,
      soldQuantity: 3,
      share: 0.25,
    },
    {
      rank: 2,
      productId: 15,
      productCode: 'P015',
      name: '매운 컵라면 115g',
      category: '라면',
      imageUrl: null,
      soldQuantity: 3,
      share: 0.25,
    },
    {
      rank: 4,
      productId: 17,
      productCode: 'P017',
      name: '단팥빵',
      category: '빵',
      imageUrl: null,
      soldQuantity: 1,
      share: 0.0833,
    },
  ],
}

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

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SalesRankingPanel />
    </QueryClientProvider>,
  )
}

describe('상품별 판매 순위', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPanel()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('처음에는 오늘까지 7일을 부르고 순위·상품·판매 수량·비중을 서버 순서대로 보여 준다', async () => {
    get.mockResolvedValue({ data: ranking })
    renderPanel()

    await screen.findByText('제육볶음 도시락')
    expect(get).toHaveBeenCalledWith('/owner/inventory/sales-ranking', { params: statsPeriod(7) })
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('12개')).toBeInTheDocument()

    const rows = screen.getAllByRole('row').slice(1)
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    )
    expect(cells).toEqual([
      ['1', '제육볶음 도시락P001', '5개', '41.7%'],
      ['2', '흰 우유 500mlP012', '3개', '25%'],
      ['2', '매운 컵라면 115gP015', '3개', '25%'],
      ['4', '단팥빵P017', '1개', '8.3%'],
    ])
  })

  it('오늘 버튼을 누르면 오늘 하루로 다시 부른다', async () => {
    get.mockResolvedValue({ data: ranking })
    renderPanel()
    await screen.findByText('제육볶음 도시락')

    await userEvent.click(screen.getByRole('button', { name: '오늘' }))

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/sales-ranking', {
        params: statsPeriod(1),
      }),
    )
    expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'true')
    // 하루면 날짜를 하나만 보여 준다
    expect(screen.getByText(statsPeriod(1).to)).toBeInTheDocument()
  })

  it('최근 30일 버튼을 누르면 30일로 다시 부른다', async () => {
    get.mockResolvedValue({ data: ranking })
    renderPanel()
    await screen.findByText('제육볶음 도시락')

    await userEvent.click(screen.getByRole('button', { name: '최근 30일' }))

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/sales-ranking', {
        params: statsPeriod(30),
      }),
    )
  })

  it('판매가 없으면 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({ data: { ...ranking, totalSoldQuantity: 0, items: [] } })
    renderPanel()
    expect(await screen.findByText('이 기간에 판매된 상품이 없어요.')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(serverError(400, 'INVALID_LIMIT', '조회 개수(limit)는 1~100입니다'))
    renderPanel()
    expect(await screen.findByText('조회 개수(limit)는 1~100입니다')).toBeInTheDocument()
  })
})
