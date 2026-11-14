import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnerSalesDayPage } from './OwnerSalesDayPage'

const calls = vi.hoisted(() => ({ sales: [] as unknown[], products: [] as unknown[] }))

vi.mock('../api', () => ({
  useSalesStream: () => undefined,
  useSales: (q: unknown) => {
    calls.sales.push(q)
    return {
      data: {
        periods: [
          {
            period: '2026-11-13',
            paidAmount: 124200,
            refundAmount: 1600,
            netAmount: 122600,
            paidCount: 42,
            refundCount: 1,
            canceledCount: 2,
          },
        ],
      },
    }
  },
  useSalesProducts: (date: string) => {
    calls.products.push(date)
    return {
      isPending: false,
      isError: false,
      data: {
        date,
        items: [
          {
            productId: 1,
            productName: '삼각김밥 참치마요',
            soldQuantity: 18,
            clearanceQuantity: 4,
            netAmount: 27000,
          },
          {
            productId: 2,
            productName: '바나나우유',
            soldQuantity: 12,
            clearanceQuantity: 0,
            netAmount: 20400,
          },
        ],
      },
    }
  },
  useDayLedger: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        ledgerId: 1,
        type: 'DISPOSE',
        productId: 3,
        productName: '샌드위치 햄치즈',
        quantity: -2,
        createdAt: '2026-11-13T09:00:00+09:00',
      },
      {
        ledgerId: 2,
        type: 'INBOUND',
        productId: 4,
        productName: '매운 컵라면 115g',
        quantity: 20,
        createdAt: '2026-11-13T07:00:00+09:00',
      },
    ],
  }),
  useStockByProduct: () =>
    new Map([
      [1, { productId: 1, availableQuantity: 4, lowStock: false }],
      [2, { productId: 2, availableQuantity: 0, lowStock: true }],
    ]),
}))
vi.mock('@/owner/orders/api', () => ({
  useOwnerOrders: ({ tab }: { tab: string }) => ({
    data: { totalElements: { PICKED_UP: 30, PICKUP_WAITING: 12, PICKUP_EXPIRED: 1 }[tab] },
  }),
}))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: '/owner/sales/day', element: <OwnerSalesDayPage /> }],
    {
      initialEntries: [path],
    },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('점주 하루 보기 (11/14 시안 A)', () => {
  beforeEach(() => {
    calls.sales.length = 0
    calls.products.length = 0
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-14T03:00:00Z')) // 오늘 = 11/14(토) KST
  })
  afterEach(() => vi.useRealTimers())

  it('주소의 날짜로 숫자 4칸·팔린 상품·픽업·폐기 입고를 보여 준다', () => {
    renderAt('/owner/sales/day?date=2026-11-13')
    expect(calls.sales.at(-1)).toEqual({ from: '2026-11-13', to: '2026-11-13', unit: 'day' })
    expect(calls.products.at(-1)).toBe('2026-11-13')
    expect(
      screen.getByRole('button', { name: '날짜 고르기, 지금 11월 13일(금)' }),
    ).toBeInTheDocument()

    expect(screen.getByText('122,600원')).toBeInTheDocument()
    expect(screen.getByText('결제 124,200원, 환불 1,600원')).toBeInTheDocument()
    expect(screen.getByText('42건')).toBeInTheDocument()
    expect(screen.getByText('30개')).toBeInTheDocument()
    expect(screen.getByText('그중 마감세일 4개')).toBeInTheDocument()
    expect(screen.getByText('2개', { selector: 'dd' })).toBeInTheDocument()

    const table = screen.getByRole('table', { name: '11월 13일(금) 팔린 상품' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual([
      '삼각김밥 참치마요',
      '바나나우유',
    ])
    expect(within(rows[0]).getByText('27,000원')).toBeInTheDocument()
    expect(within(rows[1]).getByText('품절')).toBeInTheDocument()

    expect(screen.getByText('픽업 기한 지남').nextSibling).toHaveTextContent('1건')
    expect(screen.getByText('폐기 2개')).toBeInTheDocument()
    expect(screen.getByText('입고 20개')).toBeInTheDocument()
  })

  it('전날·다음 날·오늘로 주소의 날짜를 바꾸고, 오늘에서는 다음 날·오늘을 막는다', () => {
    const router = renderAt('/owner/sales/day?date=2026-11-13')
    fireEvent.click(screen.getByRole('button', { name: '전날' }))
    expect(router.state.location.search).toBe('?date=2026-11-12')
    fireEvent.click(screen.getByRole('button', { name: '오늘' }))
    expect(router.state.location.search).toBe('?date=2026-11-14')
    expect(screen.getByRole('button', { name: '다음 날' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '오늘' })).toBeDisabled()
  })

  it('날짜가 없거나 틀리면 오늘을 본다', () => {
    renderAt('/owner/sales/day?date=2026-02-30')
    expect(calls.products.at(-1)).toBe('2026-11-14')
  })
})
