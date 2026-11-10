import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { SalesResponse } from '../api'
import { TodaySalesCard } from './TodaySalesCard'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

function renderCard(live = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TodaySalesCard live={live} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('점주 대시보드 매출 카드', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 한국 시간 11/6 오전 (UTC 11/5 밤이어도 한국 날짜로 오늘)
    vi.setSystemTime(new Date('2026-11-05T23:30:00Z'))
    get.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 하루를 매출 API 로 읽어 순매출과 건수를 보여 주고, 누르면 매출 화면으로 간다', async () => {
    const body: SalesResponse = {
      from: '2026-11-06',
      to: '2026-11-06',
      unit: 'day',
      periods: [
        {
          period: '2026-11-06',
          paidAmount: 125000,
          refundAmount: 5000,
          netAmount: 120000,
          paidCount: 12,
          refundCount: 1,
          canceledCount: 0,
        },
      ],
    }
    get.mockResolvedValue({ data: body })
    renderCard()

    expect(await screen.findByText('120,000원')).toBeInTheDocument()
    expect(screen.getByText(/결제 12건 · 환불 1건/)).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/orders/sales', {
      params: { from: '2026-11-06', to: '2026-11-06', unit: 'day' },
    })
    expect(screen.getByRole('link', { name: /오늘 매출/ })).toHaveAttribute('href', '/owner/sales')
  })

  it('못 읽으면 "불러오지 못했어요"', async () => {
    get.mockRejectedValue(new Error('500'))
    renderCard()
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요')
  })

  it('live 면 매출 SSE 에 붙고, 아니면 붙지 않는다', () => {
    const created: string[] = []
    class FakeEventSource {
      constructor(url: string) {
        created.push(url)
      }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    vi.stubGlobal('EventSource', FakeEventSource)
    get.mockReturnValue(new Promise(() => {}))
    renderCard(false)
    expect(created).toEqual([])
    renderCard(true)
    expect(created).toEqual(['/api/owner/orders/sales/stream'])
    vi.unstubAllGlobals()
  })
})
