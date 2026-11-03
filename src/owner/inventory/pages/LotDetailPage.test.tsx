import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { LotDetailPage } from './LotDetailPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/owner/inventory/:productId', element: <LotDetailPage /> },
      { path: '/owner/inventory', element: <p>재고 목록 화면</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('lot 상세 바로 열기 (S-11 /owner/inventory/:productId)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('주소의 상품 번호로 lot 을 읽어 패널을 보여 준다', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/owner/inventory')
        return Promise.resolve({
          data: {
            items: [
              {
                productId: 7,
                productCode: 'P007',
                name: '제육볶음 도시락',
                category: '도시락',
                price: 4900,
                imageUrl: null,
                totalQuantity: 3,
                reservedQuantity: 0,
                availableQuantity: 3,
                nearestExpiry: '2026-10-23T23:59:59+09:00',
                imminentLotCount: 0,
                expiredLotCount: 0,
                safetyStock: 5,
                lowStock: true,
                hasMemo: false,
              },
            ],
            page: 0,
            size: 100,
            totalElements: 1,
            totalPages: 1,
            lowStockCount: 1,
          },
        })
      if (url === '/owner/inventory/7/lots')
        return Promise.resolve({
          data: [
            {
              lotId: 70,
              expiryDate: '2026-10-23T23:59:59+09:00',
              quantity: 3,
              reservedQuantity: 0,
              availableQuantity: 3,
              status: 'NORMAL',
            },
          ],
        })
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    renderAt('/owner/inventory/7')

    // 역할(role) 찾기는 매번 접근성 트리를 계산해 느리다. 글자로 기다린다
    expect(await screen.findByText('제육볶음 도시락', { selector: 'h2' })).toBeInTheDocument()
    expect(await screen.findByText('10/23')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /재고 목록/ })).toHaveAttribute(
      'href',
      '/owner/inventory',
    )
  })

  it('숫자가 아닌 상품 번호는 오류로 보여 준다', async () => {
    get.mockResolvedValue({ data: [] })
    renderAt('/owner/inventory/abc')
    expect(await screen.findByText('상품 번호가 올바르지 않아요.')).toBeInTheDocument()
  })
})
