import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { ExpiryCalendar as Calendar } from '../api'
import { ExpiryCalendar } from './ExpiryCalendar'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const october: Calendar = {
  month: '2026-10',
  days: [
    {
      date: '2026-10-20',
      lotCount: 1,
      quantity: 2,
      lots: [
        {
          lotId: 301,
          productId: 3,
          productCode: 'P003',
          name: '단팥빵',
          expiryDate: '2026-10-20T23:59:59+09:00',
          quantity: 2,
          reservedQuantity: 0,
          status: 'EXPIRED',
        },
      ],
    },
    {
      date: '2026-10-25',
      lotCount: 2,
      quantity: 7,
      lots: [
        {
          lotId: 121,
          productId: 12,
          productCode: 'P012',
          name: '흰 우유 500ml',
          expiryDate: '2026-10-25T23:59:59+09:00',
          quantity: 3,
          reservedQuantity: 1,
          status: 'IMMINENT',
        },
        {
          lotId: 151,
          productId: 15,
          productCode: 'P015',
          name: '매운 컵라면 115g',
          expiryDate: '2026-10-25T23:59:59+09:00',
          quantity: 4,
          reservedQuantity: 0,
          status: 'IMMINENT',
        },
      ],
    },
    {
      date: '2026-10-31',
      lotCount: 1,
      quantity: 5,
      lots: [
        {
          lotId: 152,
          productId: 15,
          productCode: 'P015',
          name: '매운 컵라면 115g',
          expiryDate: '2026-10-31T23:59:59+09:00',
          quantity: 5,
          reservedQuantity: 0,
          status: 'NORMAL',
        },
      ],
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

function renderCalendar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ExpiryCalendar />
    </QueryClientProvider>,
  )
}

/**
 * 날짜 칸 버튼. 역할(role) 찾기는 칸이 35개라 부하가 걸리면 느리다.
 * 달력 제목 다음에 그려지는 lot 배지 글자를 먼저 기다린 뒤 바로 찾는다
 */
async function dayCell(name: string) {
  await screen.findAllByText(/ lot · /, undefined, { timeout: 3000 })
  return screen.getByRole('button', { name })
}

describe('유통기한 달력', () => {
  beforeEach(() => {
    get.mockReset()
    // 오늘 = 2026-10-25 12:00 KST. 날짜만 고정하고 타이머는 그대로 둔다
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T03:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('이번 달을 부르고, lot 이 있는 날짜 칸에 lot 수·수량을 그날 가장 급한 상태 색으로 보여 준다', async () => {
    get.mockResolvedValue({ data: october })
    renderCalendar()

    expect(screen.getByRole('heading', { name: '2026년 10월' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/expiry-calendar', {
      params: { month: '2026-10' },
    })
    const expired = await dayCell('10월 20일, lot 1개 2개')
    expect(within(expired).getByText('1 lot · 2개')).toHaveClass('bg-red-100')
    expect(within(await dayCell('10월 25일, lot 2개 7개')).getByText('2 lot · 7개')).toHaveClass(
      'bg-amber-100',
    )
    expect(within(await dayCell('10월 31일, lot 1개 5개')).getByText('1 lot · 5개')).toHaveClass(
      'bg-emerald-50',
    )
    // lot 이 없는 날은 날짜만
    expect(screen.getByRole('button', { name: '10월 21일' })).toBeInTheDocument()
  })

  it('처음에는 오늘이 골라져 있고 아래에 오늘 기한이 끝나는 lot 을 보여 준다', async () => {
    get.mockResolvedValue({ data: october })
    renderCalendar()

    expect(await dayCell('10월 25일, lot 2개 7개')).toHaveAttribute('aria-pressed', 'true')
    const list = await screen.findByRole('region', { name: '10월 25일 lot' })
    const rows = within(list).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      '흰 우유 500ml',
      '매운 컵라면 115g',
    ])
    expect(within(rows[0]).getByText('임박')).toBeInTheDocument()
    expect(within(rows[0]).getByText('10/25 23:59')).toBeInTheDocument()
  })

  it('날짜를 누르면 그날 lot 을, lot 이 없는 날은 안내를 보여 준다', async () => {
    get.mockResolvedValue({ data: october })
    renderCalendar()

    await userEvent.click(await dayCell('10월 20일, lot 1개 2개'))
    const list = screen.getByRole('region', { name: '10월 20일 lot' })
    expect(within(list).getByText('단팥빵')).toBeInTheDocument()
    expect(within(list).getByText('경과')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '10월 21일' }))
    expect(screen.getByText('이날 기한이 끝나는 lot이 없어요.')).toBeInTheDocument()
  })

  it('다음 달·이전 달 버튼으로 그 달을 부르고, 고른 날짜는 지운다', async () => {
    get.mockImplementation((_url: string, config?: { params?: unknown }) => {
      const month = (config?.params as { month?: string } | undefined)?.month ?? ''
      return Promise.resolve({ data: month === '2026-10' ? october : { month, days: [] } })
    })
    renderCalendar()
    await dayCell('10월 25일, lot 2개 7개')

    await userEvent.click(screen.getByRole('button', { name: '다음 달' }))

    expect(screen.getByRole('heading', { name: '2026년 11월' })).toBeInTheDocument()
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/owner/inventory/expiry-calendar', {
        params: { month: '2026-11' },
      }),
    )
    expect(await screen.findByText('이 달에 기한이 끝나는 lot이 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '이전 달' }))
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByRole('heading', { name: '2026년 9월' })).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(serverError(403, 'STORE_NOT_LINKED', '연결된 점포가 없습니다'))
    renderCalendar()
    expect(await screen.findByText('연결된 점포가 없습니다')).toBeInTheDocument()
  })
})
