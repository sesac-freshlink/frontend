import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { LedgerItem } from '../api'
import { LedgerPage } from './LedgerPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const items: LedgerItem[] = [
  {
    ledgerId: 9003,
    type: 'DISPOSE',
    productId: 12,
    productName: '흰 우유 500ml',
    lotId: 302,
    expiryDate: '2026-10-09T23:59:59+09:00',
    quantity: -3,
    refId: '501',
    createdAt: '2026-10-21T09:12:40+09:00',
  },
  {
    ledgerId: 9002,
    type: 'SALE',
    productId: 15,
    productName: '매운 컵라면 115g',
    lotId: 301,
    expiryDate: '2026-10-20T23:59:59+09:00',
    quantity: -1,
    refId: '1024',
    createdAt: '2026-10-20T08:30:00+09:00',
  },
  {
    ledgerId: 9001,
    type: 'INBOUND',
    productId: 15,
    productName: '매운 컵라면 115g',
    lotId: 301,
    expiryDate: '2026-10-20T23:59:59+09:00',
    quantity: 10,
    refId: 'SHP-20261020-001',
    createdAt: '2026-10-20T05:00:03+09:00',
  },
]

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LedgerPage />
    </QueryClientProvider>,
  )
}

/** 표에서 refId 로 행을 찾는다 */
async function rowOf(refId: string) {
  return (await screen.findByText(refId)).closest('tr')!
}

describe('재고 변동 이력 (S-13)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('처음에는 종류 없이 전체를 부르고 전체 버튼이 선택돼 있다', async () => {
    get.mockResolvedValue({ data: items })
    renderPage()
    await rowOf('SHP-20261020-001')
    expect(get).toHaveBeenCalledWith('/owner/inventory/ledger', { params: { type: undefined } })
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('종류 배지와 부호 붙은 수량을 색으로 나눠 보여 준다', async () => {
    get.mockResolvedValue({ data: items })
    renderPage()

    const inbound = await rowOf('SHP-20261020-001')
    expect(within(inbound).getByText('입고')).toHaveClass('bg-emerald-100', 'text-emerald-800')
    expect(within(inbound).getByText('+10')).toHaveClass('text-emerald-700')
    expect(within(inbound).getByText('10/20 05:00')).toBeInTheDocument()
    expect(within(inbound).getByText('유통기한 10/20')).toBeInTheDocument()

    const sale = await rowOf('1024')
    expect(within(sale).getByText('판매')).toHaveClass('bg-sky-100', 'text-sky-800')
    expect(within(sale).getByText('−1')).toHaveClass('text-red-600')

    const dispose = await rowOf('501')
    expect(within(dispose).getByText('폐기')).toHaveClass('bg-red-100', 'text-red-700')
    expect(within(dispose).getByText('−3')).toHaveClass('text-red-600')
  })

  it('종류 버튼을 누르면 그 종류로 다시 부른다', async () => {
    get.mockResolvedValue({ data: items })
    renderPage()
    await rowOf('SHP-20261020-001')

    await userEvent.click(screen.getByRole('button', { name: '판매' }))

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/ledger', { params: { type: 'SALE' } }),
    )
    expect(screen.getByRole('button', { name: '판매' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('빈 목록이면 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('아직 변동 이력이 없어요.')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(
      serverError(400, 'INVALID_DATE_RANGE', '조회 시작일은 종료일보다 늦을 수 없습니다'),
    )
    renderPage()
    expect(await screen.findByText('조회 시작일은 종료일보다 늦을 수 없습니다')).toBeInTheDocument()
  })

  it('message 가 없는 오류는 기본 문구로 보여 준다', async () => {
    get.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByText('이력을 불러오지 못했어요.')).toBeInTheDocument()
  })

  it('조정 원장은 조정 배지와 부호 붙은 수량으로 보여 주고 조정 버튼으로 거른다 (S-14)', async () => {
    get.mockResolvedValue({
      data: [
        {
          ledgerId: 9004,
          type: 'ADJUST',
          productId: 12,
          productName: '흰 우유 500ml',
          lotId: 302,
          expiryDate: '2026-10-09T23:59:59+09:00',
          quantity: -2,
          refId: '7001',
          createdAt: '2026-10-21T10:00:00+09:00',
        },
      ],
    })
    renderPage()

    const row = await rowOf('7001')
    expect(within(row).getByText('조정')).toHaveClass('bg-violet-100', 'text-violet-800')
    expect(within(row).getByText('−2')).toHaveClass('text-red-600')

    await userEvent.click(screen.getByRole('button', { name: '조정' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/ledger', { params: { type: 'ADJUST' } }),
    )
  })

  it('조정 내역 탭으로 바꾸면 조정 이력을 부른다 (S-14)', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/owner/inventory/adjustments' ? [] : items }),
    )
    renderPage()
    await rowOf('SHP-20261020-001')

    await userEvent.click(screen.getByRole('tab', { name: '조정 내역' }))

    expect(await screen.findByText(/아직 조정한 적이 없어요/)).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/adjustments')
  })

  it('판매 순위 탭으로 바꾸면 이력 대신 판매 순위를 부른다', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/owner/inventory/sales-ranking'
            ? { from: '2026-10-23', to: '2026-10-29', totalSoldQuantity: 0, items: [] }
            : items,
      }),
    )
    renderPage()
    await rowOf('SHP-20261020-001')

    await userEvent.click(screen.getByRole('tab', { name: '판매 순위' }))

    expect(await screen.findByText('이 기간에 판매된 상품이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '판매 순위' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('SHP-20261020-001')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/sales-ranking', expect.anything())
  })

  it('통계 탭으로 바꾸면 이력 대신 기간 통계를 부른다 (S-42)', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/owner/inventory/stats'
            ? {
                from: '2026-10-20',
                to: '2026-10-26',
                inboundQuantity: 0,
                soldQuantity: 0,
                disposedQuantity: 0,
                adjustedQuantity: 0,
                disposalRate: null,
                products: [],
              }
            : items,
      }),
    )
    renderPage()
    await rowOf('SHP-20261020-001')

    await userEvent.click(screen.getByRole('tab', { name: '통계' }))

    expect(await screen.findByText('이 기간에 입고·판매·폐기가 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '통계' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('SHP-20261020-001')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/stats', expect.anything())
  })
})
