import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { AdjustmentHistoryItem } from '../api'
import { AdjustmentHistory } from './AdjustmentHistory'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const items: AdjustmentHistoryItem[] = [
  {
    adjustmentId: 7002,
    lotId: 303,
    productId: 12,
    productName: '흰 우유 500ml',
    expiryDate: '2026-10-30T23:59:59+09:00',
    delta: 2,
    quantityBefore: 8,
    quantityAfter: 10,
    reason: 'COUNT',
    memo: null,
    createdAt: '2026-10-25T13:00:00+09:00',
  },
  {
    adjustmentId: 7001,
    lotId: 303,
    productId: 12,
    productName: '흰 우유 500ml',
    expiryDate: '2026-10-30T23:59:59+09:00',
    delta: -2,
    quantityBefore: 10,
    quantityAfter: 8,
    reason: 'DAMAGE',
    memo: '포장 찢어짐',
    createdAt: '2026-10-25T12:00:00+09:00',
  },
]

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdjustmentHistory />
    </QueryClientProvider>,
  )
}

describe('조정 내역 (S-14)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('최신순으로 조정 전후 수량·증감·사유·메모를 보여 준다', async () => {
    get.mockResolvedValue({ data: items })
    renderHistory()

    const latest = (await screen.findByText('10/25 13:00')).closest('tr')!
    expect(within(latest).getByText('8 → 10')).toBeInTheDocument()
    expect(within(latest).getByText('+2')).toHaveClass('text-emerald-700')
    expect(within(latest).getByText('실사')).toBeInTheDocument()
    expect(within(latest).getByText('-')).toBeInTheDocument()

    const older = screen.getByText('10/25 12:00').closest('tr')!
    expect(within(older).getByText('−2')).toHaveClass('text-red-600')
    expect(within(older).getByText('파손')).toBeInTheDocument()
    expect(within(older).getByText('포장 찢어짐')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/adjustments')
  })

  it('조정한 적이 없으면 어디서 조정하는지 안내한다', async () => {
    get.mockResolvedValue({ data: [] })
    renderHistory()
    expect(await screen.findByText(/아직 조정한 적이 없어요/)).toBeInTheDocument()
  })

  it('오류면 기본 문구를 보여 준다', async () => {
    get.mockRejectedValue(new Error('network'))
    renderHistory()
    expect(await screen.findByText('조정 내역을 불러오지 못했어요.')).toBeInTheDocument()
  })
})
