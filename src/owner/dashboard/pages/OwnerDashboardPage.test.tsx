import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { OwnerDashboardPage } from './OwnerDashboardPage'

// 대시보드가 부르는 서버 훅을 고정 값으로 바꾼다
vi.mock('@/owner/store/api', () => ({ useOwnerStore: () => ({ data: { name: '프레시 강남점' } }) }))
vi.mock('@/owner/sales/useTodaySales', () => ({
  useTodaySales: () => ({ today: '2026-11-13', totals: undefined }),
}))
const useOwnerOrders = vi.fn((_query: { tab: string }) => ({
  data: { content: [], totalElements: 0 },
}))
vi.mock('@/owner/orders/api', () => ({
  useOwnerOrders: (query: { tab: string }) => useOwnerOrders(query),
}))
vi.mock('@/owner/orders/pages/OwnerOrdersPage', () => ({ ReadyButton: () => null }))
vi.mock('@/board/api', () => ({ useNotices: () => ({ data: { content: [] } }) }))
/** 상태 조건별 재고 목록. 품절 1개(부족이기도 하다) + 부족 1개 → 재입고 필요는 2개 */
const soldOutItem = { productId: 7, name: '참치 김밥', availableQuantity: 0, safetyStock: 5 }
const lowItem = { productId: 8, name: '단팥빵', availableQuantity: 2, safetyStock: 5 }
const inventoryByStatus: Record<string, { items: unknown[]; totalElements: number }> = {
  SOLD_OUT: { items: [soldOutItem], totalElements: 1 },
  RESTOCK: { items: [lowItem, soldOutItem], totalElements: 2 },
}
vi.mock('@/owner/inventory/api', () => ({
  useInventory: (query: { statuses: string[] }) => ({
    data: inventoryByStatus[query.statuses[0]] ?? { items: [], totalElements: 0 },
  }),
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
  it('픽업 대기는 결제·픽업 화면 픽업 대기 구분(픽업 신청)과 같은 주문을 센다 (11/15)', () => {
    render(
      <MemoryRouter>
        <OwnerDashboardPage />
      </MemoryRouter>,
    )
    expect(useOwnerOrders).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'PICKUP_REQUESTED' }),
    )
  })

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

  it('재입고 필요는 품절 또는 부족 상품을 한 번씩 세고, 목록에 같은 상품이 두 번 나오지 않는다 (11/15)', () => {
    render(
      <MemoryRouter>
        <OwnerDashboardPage />
      </MemoryRouter>,
    )
    const stat = screen.getAllByText('재입고 필요')[0].parentElement as HTMLElement
    expect(within(stat).getByText('2')).toBeInTheDocument()
    expect(within(stat).getByText('품절 1')).toBeInTheDocument()
    // 품절 먼저, 그다음 부족
    expect(screen.getAllByText('참치 김밥')).toHaveLength(1)
    const names = screen.getAllByText(/^(참치 김밥|단팥빵)$/).map((el) => el.textContent)
    expect(names).toEqual(['참치 김밥', '단팥빵'])
  })
})
