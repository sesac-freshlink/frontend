import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { SalesPeriod, SalesQuery, SalesResponse } from '../api'
import { weekStart } from '../sales'
import { OwnerSalesPage } from './OwnerSalesPage'

dayjs.extend(utc)

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

/**
 * 가짜 응답: 하루 매출 = 날짜(일) × 100원, 1건. 10/29 = 2,900원.
 * 주·월은 서버처럼 조회 기간 안의 날만 묶음 첫날 이름으로 더한다
 */
function sales(
  { from, to, unit }: SalesQuery,
  amount = (date: string) => dayjs.utc(date).date() * 100,
) {
  const buckets = new Map<string, SalesPeriod>()
  for (let d = dayjs.utc(from); d.format('YYYY-MM-DD') <= to; d = d.add(1, 'day')) {
    const date = d.format('YYYY-MM-DD')
    const key = unit === 'week' ? weekStart(date) : unit === 'month' ? date.slice(0, 7) : date
    const bucket = buckets.get(key) ?? {
      period: key,
      paidAmount: 0,
      refundAmount: 0,
      netAmount: 0,
      paidCount: 0,
      refundCount: 0,
      canceledCount: 0,
    }
    const won = amount(date)
    bucket.paidAmount += won
    bucket.netAmount += won
    bucket.paidCount += won > 0 ? 1 : 0
    buckets.set(key, bucket)
  }
  const body: SalesResponse = { from, to, unit, periods: [...buckets.values()] }
  return { data: body }
}

function paramsOf(config: unknown): SalesQuery {
  return (config as { params: SalesQuery }).params
}

/** 이번 주(카드용) 조회인지. 오늘 = 2026-10-29(목)이라 월요일 10/26 부터 */
function isWeekQuery(p: SalesQuery) {
  return p.from === '2026-10-26' && p.to === '2026-10-29' && p.unit === 'day'
}

function calledWith(query: SalesQuery) {
  expect(get).toHaveBeenCalledWith('/owner/orders/sales', { params: query })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <OwnerSalesPage />
    </QueryClientProvider>,
  )
}

function card(label: string) {
  return screen.getByText(label, { selector: 'p' }).parentElement!
}

describe('점주 매출 대시보드', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockImplementation(async (_url, config) => sales(paramsOf(config)))
    // 오늘 = 2026-10-29(목) 12:00 KST. 날짜만 고정하고 타이머는 그대로 둔다
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T03:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('불러오는 동안 표시하고, 최근 7일·일 단위로 카드·그래프·표를 그린다', async () => {
    renderPage()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()

    const chart = await screen.findByRole('img', { name: /^일별 순매출 그래프/ })
    expect(chart).toHaveAccessibleName(
      '일별 순매출 그래프. 10/23 ~ 10/29, 합계 18,200원, 가장 높은 때 10/29 2,900원',
    )
    calledWith({ from: '2026-10-23', to: '2026-10-29', unit: 'day' })
    // 오늘·이번 주 카드는 이번 주(월요일 ~ 오늘) 일별 조회 하나로 채운다
    calledWith({ from: '2026-10-26', to: '2026-10-29', unit: 'day' })

    expect(within(card('오늘 매출')).getByText('2,900원')).toBeInTheDocument()
    expect(within(card('오늘 매출')).getByText('10/29(목) 순매출')).toBeInTheDocument()
    // 26 + 27 + 28 + 29 = 110 → 11,000원
    expect(within(card('이번 주 매출')).getByText('11,000원')).toBeInTheDocument()
    expect(within(card('결제 건수')).getByText('7건')).toBeInTheDocument()
    expect(within(card('환불 건수')).getByText('0건')).toBeInTheDocument()

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // 머리 1 + 7일 + 합계 1
    expect(rows).toHaveLength(9)
    expect(within(rows[1]).getByText('10/23(금)')).toBeInTheDocument()
    expect(within(rows[1]).getAllByText('2,300원')).toHaveLength(2)
    const total = within(rows[8])
    expect(total.getByText('합계')).toBeInTheDocument()
    expect(total.getAllByText('18,200원')).toHaveLength(2)
    expect(total.getByText('7건')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '일' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('단위를 바꾸면 같은 기간을 그 단위로 다시 읽고 그래프 제목·표 이름이 따라간다', async () => {
    renderPage()
    await screen.findByRole('img', { name: /^일별 순매출 그래프/ })

    await userEvent.click(screen.getByRole('button', { name: '주' }))
    calledWith({ from: '2026-10-23', to: '2026-10-29', unit: 'week' })
    expect(await screen.findByRole('heading', { name: '주별 순매출' })).toBeInTheDocument()
    // 주는 월요일에 시작하고 조회 기간 밖의 날은 이름에서 자른다
    expect(screen.getByText('10/23(금) ~ 10/25(일)')).toBeInTheDocument()
    expect(screen.getByText('10/26(월) ~ 10/29(목)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '월' }))
    calledWith({ from: '2026-10-23', to: '2026-10-29', unit: 'month' })
    expect(await screen.findByRole('heading', { name: '월별 순매출' })).toBeInTheDocument()
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
  })

  it('빠른 기간 버튼은 오늘에서 끝나는 기간으로 다시 읽는다', async () => {
    renderPage()
    await screen.findByRole('img', { name: /^일별 순매출 그래프/ })

    await userEvent.click(screen.getByRole('button', { name: '최근 30일' }))
    calledWith({ from: '2026-09-30', to: '2026-10-29', unit: 'day' })
    expect(screen.getByRole('button', { name: '최근 30일' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-09-30')
    await waitFor(() => expect(within(card('결제 건수')).getByText('30건')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: '이번 달' }))
    calledWith({ from: '2026-10-01', to: '2026-10-29', unit: 'day' })
    expect(screen.getByRole('button', { name: '최근 30일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('날짜를 직접 고르면 그 기간으로 읽고, 잘못된 기간이면 부르지 않고 문구를 보여 준다', async () => {
    renderPage()
    await screen.findByRole('img', { name: /^일별 순매출 그래프/ })

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-27' } })
    calledWith({ from: '2026-10-27', to: '2026-10-29', unit: 'day' })
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const before = get.mock.calls.length
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-30' } })
    expect(screen.getByRole('alert')).toHaveTextContent('시작일이 종료일보다 늦어요.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(card('결제 건수')).getByText('-')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2025-10-28' } })
    expect(screen.getByRole('alert')).toHaveTextContent('기간은 최대 366일까지 볼 수 있어요.')

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '' } })
    expect(screen.getByRole('alert')).toHaveTextContent('시작일과 종료일을 모두 골라 주세요.')
    expect(get.mock.calls.length).toBe(before)
  })

  it('고른 기간을 못 읽으면 오류 문구, 이번 주 카드는 그대로', async () => {
    get.mockImplementation(async (_url, config) => {
      const p = paramsOf(config)
      if (isWeekQuery(p)) return sales(p)
      throw new Error('500')
    })
    renderPage()

    expect(await screen.findByText('매출을 불러오지 못했어요.')).toBeInTheDocument()
    expect(within(card('결제 건수')).getByText('불러오지 못했어요')).toBeInTheDocument()
    expect(within(card('이번 주 매출')).getByText('11,000원')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('기간 안 매출이 모두 0 이면 그래프·표 대신 안내한다', async () => {
    get.mockImplementation(async (_url, config) => sales(paramsOf(config), () => 0))
    renderPage()

    expect(
      await screen.findByText('10/23(금) ~ 10/29(목) 동안 결제된 매출이 없어요.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(card('오늘 매출')).getByText('0원')).toBeInTheDocument()
    expect(within(card('결제 건수')).getByText('0건')).toBeInTheDocument()
  })
})
