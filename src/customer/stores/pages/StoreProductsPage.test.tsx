import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { StoreProduct } from '../api'
import { StoreProductsPage } from './StoreProductsPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
const get = vi.mocked(api.get)

const products: StoreProduct[] = [
  {
    productId: 15,
    name: '매운 컵라면 115g',
    category: '라면',
    price: 1700,
    availableQuantity: 3,
    soldOut: false,
  },
  {
    productId: 3,
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    availableQuantity: 0,
    soldOut: true,
  },
]

function renderAt(path: string, state?: { storeName: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer', element: <p>점포 찾기 화면</p> },
      { path: '/customer/stores/:storeId', element: <StoreProductsPage /> },
      { path: '/customer/orders/:id', element: <p>주문·결제 화면</p> },
    ],
    { initialEntries: [state ? { pathname: path, state } : path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('고객 점포 상품 목록 (U-10)', () => {
  beforeEach(() => {
    get.mockReset()
    sessionStorage.clear()
  })

  it('점포 검색에서 넘어온 점포 이름을 제목으로, 상품은 서버 순서대로 가격·남은 수량과 함께 보여 준다', async () => {
    get.mockResolvedValue({ data: products })
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products')

    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(noodle).getByText('라면')).toBeInTheDocument()
    expect(within(noodle).getByText('1,700원')).toBeInTheDocument()
    expect(within(noodle).getByText('3개 남음')).toBeInTheDocument()

    const names = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('span span')?.textContent)
    expect(names).toEqual(['매운 컵라면 115g', '샌드위치 햄치즈'])
  })

  it('품절 상품은 흐리게 보여 주고 누를 수 없다', async () => {
    get.mockResolvedValue({ data: products })
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    const sandwich = (await screen.findByText('샌드위치 햄치즈')).closest('li')!
    expect(within(sandwich).getByText('품절')).toBeInTheDocument()
    expect(within(sandwich).queryByRole('link')).not.toBeInTheDocument()
    expect(sandwich).toHaveAttribute('aria-disabled', 'true')
    expect(sandwich.firstElementChild).toHaveClass('opacity-50')
  })

  it('상품을 누르면 점포·상품·가격·남은 수량을 담아 주문·결제 화면으로 간다', async () => {
    get.mockResolvedValue({ data: products })
    const router = renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByText('매운 컵라면 115g'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/new'))
    const q = new URLSearchParams(router.state.location.search)
    expect(Object.fromEntries(q)).toEqual({
      storeId: '1',
      storeName: '프레시 강남점',
      productId: '15',
      productName: '매운 컵라면 115g',
      price: '1700',
      available: '3',
    })
  })

  it('새로고침으로 점포 이름이 사라져도 이 세션에 남긴 이름을 다시 쓴다', async () => {
    get.mockResolvedValue({ data: products })
    sessionStorage.setItem('freshlink.storeName.1', '프레시 강남점')
    renderAt('/customer/stores/1')

    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /매운 컵라면/ })).toBeInTheDocument()
  })

  it('점포 이름을 모르면 목록은 보여 주되 구매는 막고 점포 찾기로 안내한다', async () => {
    get.mockResolvedValue({ data: products })
    renderAt('/customer/stores/1')

    expect(await screen.findByText('점포 찾기에서 점포를 다시 골라 주세요.')).toBeInTheDocument()
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /매운 컵라면/ })).not.toBeInTheDocument()
  })

  it('상품이 없으면 안내 문구를, 오류면 다시 시도를 보여 준다', async () => {
    get.mockResolvedValueOnce({ data: [] })
    renderAt('/customer/stores/9', { storeName: '프레시 없는점' })
    expect(await screen.findByText('이 점포에는 상품이 없어요.')).toBeInTheDocument()

    get.mockRejectedValue(new Error('network'))
    await userEvent.click(screen.getByRole('button', { name: '새로고침' }))
    expect(await screen.findByText('상품을 불러오지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('숫자가 아닌 점포 주소는 점포 찾기로 안내한다', () => {
    renderAt('/customer/stores/abc')
    expect(screen.getByText('점포 주소가 올바르지 않아요.')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
})
