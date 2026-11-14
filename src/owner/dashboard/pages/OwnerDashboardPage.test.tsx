import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { OwnerDashboardPage } from './OwnerDashboardPage'

// 대시보드가 부르는 서버 훅을 고정 값으로 바꾼다
vi.mock('@/owner/store/api', () => ({ useOwnerStore: () => ({ data: { name: '프레시 강남점' } }) }))
vi.mock('@/owner/sales/useTodaySales', () => ({
  useTodaySales: () => ({ today: '2026-11-13', totals: undefined }),
}))
vi.mock('@/owner/orders/api', () => ({
  useOwnerOrders: () => ({ data: { content: [], totalElements: 0 } }),
}))
vi.mock('@/owner/orders/pages/OwnerOrdersPage', () => ({ ReadyButton: () => null }))
vi.mock('@/board/api', () => ({ useNotices: () => ({ data: { content: [] } }) }))
vi.mock('@/owner/inventory/api', () => ({
  useInventory: () => ({ data: { items: [], totalElements: 0, lowStockCount: 0 } }),
  useSalesRanking: () => ({ data: { items: [] } }),
  // 소비기한이 지난 lot 두 개(같은 상품 1,500개 + 다른 상품 40개)
  useExpiring: () => ({
    data: [
      { lotId: 1, productId: 1, productName: '삼각김밥 참치마요', quantity: 1500, expired: true },
      { lotId: 2, productId: 2, productName: '바나나우유', quantity: 40, expired: true },
    ],
  }),
}))

describe('OwnerDashboardPage', () => {
  it('소비기한 지남은 수량에 천 단위 쉼표와 "개"를 붙이고, 아래에 "상품 N개"로 상품 수를 보여 준다 (11/13·11/14 경우 결정)', () => {
    render(
      <MemoryRouter>
        <OwnerDashboardPage />
      </MemoryRouter>,
    )
    const card = screen.getByText('소비기한 지남').parentElement as HTMLElement
    expect(within(card).getByText('1,540개')).toBeInTheDocument()
    expect(within(card).getByText('상품 2개 폐기 처리 필요')).toBeInTheDocument()
  })
})
