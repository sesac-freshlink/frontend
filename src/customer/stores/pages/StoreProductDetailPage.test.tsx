import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { StoreProductDetail } from '../api'
import { StoreProductDetailPage } from './StoreProductDetailPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const del = vi.mocked(api.delete)

const milk: StoreProductDetail = {
  productId: 12,
  name: '흰 우유 500ml',
  category: '유제품',
  price: 1900,
  imageUrl: 'https://img.example/P012.jpg',
  availableQuantity: 7,
  soldOut: false,
  nearestExpiry: '2026-10-30T23:59:59+09:00',
  recommended: true,
  newArrival: false,
  firstCome: false,
}

function renderAt(path: string, state?: { storeName: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer', element: <p>점포 찾기 화면</p> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록 화면</p> },
      {
        path: '/customer/stores/:storeId/products/:productId',
        element: <StoreProductDetailPage />,
      },
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

describe('고객 상품 상세 (U-10)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    del.mockReset()
    sessionStorage.clear()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('가격·남은 수량·먼저 받게 될 상품의 유통기한·점포를 보여 준다', async () => {
    get.mockResolvedValue({ data: milk })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('heading', { name: '흰 우유 500ml' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products/12')
    expect(screen.getByText('유제품')).toBeInTheDocument()
    // 점주 추천이면 이름 아래에 배지가 붙는다
    expect(screen.getByText('추천')).toBeInTheDocument()
    expect(screen.getByText('1,900원')).toBeInTheDocument()
    expect(screen.getByText('7개')).toBeInTheDocument()
    expect(screen.getByText('10/30 23:59까지')).toBeInTheDocument()
    expect(screen.getByText('유통기한이 빠른 상품부터 드려요')).toBeInTheDocument()
    expect(screen.getByText('프레시 강남점')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '흰 우유 500ml' })).toHaveAttribute(
      'src',
      'https://img.example/P012.jpg',
    )
  })

  it('구매하기를 누르면 점포·상품·가격·남은 수량을 담아 주문·결제 화면으로 간다', async () => {
    get.mockResolvedValue({ data: milk })
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByRole('link', { name: '구매하기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/new'))
    const q = new URLSearchParams(router.state.location.search)
    expect(Object.fromEntries(q)).toEqual({
      storeId: '1',
      storeName: '프레시 강남점',
      productId: '12',
      productName: '흰 우유 500ml',
      price: '1900',
      available: '7',
      imageUrl: 'https://img.example/P012.jpg',
    })
  })

  it('품절이면 유통기한을 보여 주지 않고 구매할 수 없다', async () => {
    get.mockResolvedValue({
      data: { ...milk, availableQuantity: 0, soldOut: true, nearestExpiry: null },
    })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('button', { name: '품절' })).toBeDisabled()
    expect(screen.queryByText(/까지$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '구매하기' })).not.toBeInTheDocument()
  })

  it('품절이면 재입고 알림을 신청하고 취소할 수 있다', async () => {
    const soldOut = { ...milk, availableQuantity: 0, soldOut: true, nearestExpiry: null }
    get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/notifications/restock/12'
          ? { data: { storeId: 1, productId: 12, subscribed: false } }
          : { data: soldOut },
      ),
    )
    post.mockResolvedValue({ data: { storeId: 1, productId: 12, subscribed: true } })
    del.mockResolvedValue({ data: null })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByRole('button', { name: /재입고 알림 받기/ }))
    expect(post).toHaveBeenCalledWith('/notifications/restock/12', null, { params: { storeId: 1 } })
    expect(get).toHaveBeenCalledWith('/notifications/restock/12', { params: { storeId: 1 } })

    await userEvent.click(await screen.findByRole('button', { name: /재입고 알림 신청됨/ }))
    expect(del).toHaveBeenCalledWith('/notifications/restock/12', { params: { storeId: 1 } })
    expect(await screen.findByRole('button', { name: /재입고 알림 받기/ })).toBeInTheDocument()
  })

  it('팔고 있는 상품에는 재입고 알림 버튼이 없고 신청 상태도 묻지 않는다', async () => {
    get.mockResolvedValue({ data: milk })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('link', { name: '구매하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /재입고/ })).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('점포 이름을 모르면 구매를 막고 점포 찾기로 안내한다', async () => {
    get.mockResolvedValue({ data: milk })
    renderAt('/customer/stores/1/products/12')

    expect(await screen.findByRole('button', { name: '구매하기' })).toBeDisabled()
    expect(screen.getByText(/점포 찾기에서 점포를 다시 골라 주세요/)).toBeInTheDocument()
  })

  it('불러오지 못하면 다시 시도를 보여 준다', async () => {
    get.mockRejectedValueOnce(new Error('404'))
    renderAt('/customer/stores/1/products/999', { storeName: '프레시 강남점' })

    expect(await screen.findByText('상품을 불러오지 못했어요.')).toBeInTheDocument()
    get.mockResolvedValue({ data: milk })
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '흰 우유 500ml' })).toBeInTheDocument()
  })

  it('목록으로 돌아가는 링크가 있고, 숫자가 아닌 주소는 점포 찾기로 안내한다', async () => {
    get.mockResolvedValue({ data: milk })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })
    expect(await screen.findByRole('link', { name: /상품 목록/ })).toHaveAttribute(
      'href',
      '/customer/stores/1',
    )
  })

  it('숫자가 아닌 상품 주소는 점포 찾기로 안내하고 서버에 묻지 않는다', () => {
    renderAt('/customer/stores/1/products/abc')
    expect(screen.getByText('상품 주소가 올바르지 않아요.')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
})
