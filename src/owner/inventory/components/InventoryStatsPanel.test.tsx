import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { InventoryStats } from '../api'
import { statsPeriod } from '../format'
import { InventoryStatsPanel } from './InventoryStatsPanel'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const stats: InventoryStats = {
  from: '2026-10-20',
  to: '2026-10-26',
  inboundQuantity: 16,
  soldQuantity: 4,
  disposedQuantity: 2,
  adjustedQuantity: -1,
  disposalRate: 0.3333,
  products: [
    {
      productId: 12,
      productCode: 'P012',
      name: '흰 우유 500ml',
      category: '유제품',
      inboundQuantity: 6,
      soldQuantity: 1,
      disposedQuantity: 2,
      adjustedQuantity: 0,
      disposalRate: 0.6667,
    },
    {
      productId: 15,
      productCode: 'P015',
      name: '매운 컵라면 115g',
      category: '라면',
      inboundQuantity: 10,
      soldQuantity: 3,
      disposedQuantity: 0,
      adjustedQuantity: -1,
      disposalRate: 0,
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
      <InventoryStatsPanel />
    </QueryClientProvider>,
  )
}

/** 합계 칸에서 이름표 옆 값을 찾는다 */
function total(label: string) {
  return within(screen.getByText(label, { selector: 'dt' }).parentElement!).getByRole('definition')
}

describe('판매·폐기 통계 (S-42)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPanel()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('처음에는 오늘까지 7일을 부르고 합계와 상품별 폐기율을 보여 준다', async () => {
    get.mockResolvedValue({ data: stats })
    renderPanel()

    const milk = (await screen.findByText('흰 우유 500ml')).closest('tr')!
    expect(get).toHaveBeenCalledWith('/owner/inventory/stats', { params: statsPeriod(7) })
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute('aria-pressed', 'true')

    expect(total('입고')).toHaveTextContent('16개')
    expect(total('판매')).toHaveTextContent('4개')
    expect(total('폐기')).toHaveTextContent('2개')
    expect(total('조정')).toHaveTextContent('−1개')
    expect(total('폐기율')).toHaveTextContent('33.3%')

    expect(within(milk).getByText('66.7%')).toBeInTheDocument()
    expect(within(milk).getByText('2')).toHaveClass('text-red-600')
    const noodle = screen.getByText('매운 컵라면 115g').closest('tr')!
    expect(within(noodle).getByText('0%')).toBeInTheDocument()
    expect(within(noodle).getByText('−1')).toBeInTheDocument()

    // 서버가 준 순서(폐기 많은 순)를 그대로 쓴다
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('p')?.textContent)
    expect(names).toEqual(['흰 우유 500ml', '매운 컵라면 115g'])
  })

  it('기간 버튼을 누르면 그 기간으로 다시 부른다', async () => {
    get.mockResolvedValue({ data: stats })
    renderPanel()
    await screen.findByText('흰 우유 500ml')

    await userEvent.click(screen.getByRole('button', { name: '최근 30일' }))

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/stats', { params: statsPeriod(30) }),
    )
    expect(screen.getByRole('button', { name: '최근 30일' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const { from, to } = statsPeriod(30)
    expect(screen.getByText(`${from} ~ ${to}`)).toBeInTheDocument()
  })

  it('변동이 없으면 합계 0 과 폐기율 "-", 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({
      data: {
        ...stats,
        inboundQuantity: 0,
        soldQuantity: 0,
        disposedQuantity: 0,
        adjustedQuantity: 0,
        disposalRate: null,
        products: [],
      },
    })
    renderPanel()

    expect(await screen.findByText('이 기간에 입고·판매·폐기가 없어요.')).toBeInTheDocument()
    expect(total('폐기율')).toHaveTextContent('-')
    expect(total('입고')).toHaveTextContent('0개')
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(
      serverError(400, 'INVALID_DATE_RANGE', '조회 시작일은 종료일보다 늦을 수 없습니다'),
    )
    renderPanel()
    expect(await screen.findByText('조회 시작일은 종료일보다 늦을 수 없습니다')).toBeInTheDocument()
  })
})
