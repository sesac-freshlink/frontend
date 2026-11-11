import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
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
      { path: '/customer/stores', element: <p>점포 찾기 화면</p> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록 화면</p> },
      {
        path: '/customer/stores/:storeId/products/:productId',
        element: <StoreProductDetailPage />,
      },
      { path: '/customer/orders/:id', element: <p>결제 대기 화면</p> },
      { path: '/customer/stores/:storeId/products/:productId/queue', element: <p>대기 화면</p> },
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

  function idempotencyKeys() {
    return post.mock.calls
      .filter((c) => c[0] === '/orders')
      .map((c) => (c[2] as { headers: Record<string, string> }).headers['Idempotency-Key'])
  }

  it('상세에서 수량을 고르고 [N원 구매하기]를 누르면 주문을 만들고 바로 결제 대기 화면으로 간다', async () => {
    get.mockResolvedValue({ data: milk })
    post.mockResolvedValue({ data: { orderId: 123, orderNo: 'FL-1', status: 'RESERVING' } })
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByRole('button', { name: '수량 한 개 더하기' }))
    expect(screen.getByLabelText('수량 2개')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '3,800원 구매하기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/123'))
    expect(post).toHaveBeenCalledWith(
      '/orders',
      { storeId: 1, storeName: '프레시 강남점', productId: 12, quantity: 2 },
      expect.objectContaining({ headers: { 'Idempotency-Key': expect.any(String) } }),
    )
    // 결제 대기에서 뒤로 가면 상품 상세로 돌아온다 (옛 주문·결제 화면 주소는 쌓이지 않는다)
    router.navigate(-1)
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/customer/stores/1/products/12'),
    )
  })

  it('수량은 1개부터 5개까지, 남은 수량이 더 적으면 그만큼만 고른다', async () => {
    get.mockResolvedValue({ data: { ...milk, availableQuantity: 2 } })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('button', { name: '수량 한 개 빼기' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '수량 한 개 더하기' }))
    expect(screen.getByRole('button', { name: '수량 한 개 더하기' })).toBeDisabled()
    expect(screen.getByText('한 번에 5개까지 살 수 있어요')).toBeInTheDocument()
  })

  it('실패하면 이유를 알리고 그대로 있다. 다시 누르면 같은 키, 수량을 바꾸면 새 키를 보낸다', async () => {
    get.mockResolvedValue({ data: milk })
    post.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network'))
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByRole('button', { name: '1,900원 구매하기' }))
    await userEvent.click(await screen.findByRole('button', { name: '1,900원 구매하기' }))
    await screen.findByRole('button', { name: '1,900원 구매하기' })
    expect(router.state.location.pathname).toBe('/customer/stores/1/products/12')
    await userEvent.click(screen.getByRole('button', { name: '수량 한 개 더하기' }))
    post.mockResolvedValue({ data: { orderId: 9, orderNo: 'FL-9', status: 'RESERVING' } })
    await userEvent.click(screen.getByRole('button', { name: '3,800원 구매하기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/9'))
    const [first, retry, changed] = idempotencyKeys()
    expect(retry).toBe(first)
    expect(changed).not.toBe(first)
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

    expect(await screen.findByRole('button', { name: '1,900원 구매하기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /재입고/ })).not.toBeInTheDocument()
    // 상품 상세와 같은 카테고리 상품 목록만 읽고, 재입고 알림 신청 상태는 묻지 않는다
    expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/notifications\/restock/))
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

  it('같은 카테고리 상품은 버튼 없이 바로 펼쳐 보이고, 지금 상품과 품절은 빼고 보여 준다', async () => {
    const others = [
      milk,
      { ...milk, productId: 13, name: '딸기 우유 200ml' },
      { ...milk, productId: 14, name: '초코 우유 200ml', availableQuantity: 0, soldOut: true },
    ]
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/stores/1/products' ? others : milk }),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(
      screen.queryByRole('button', { name: /같은 카테고리 상품 보기/ }),
    ).not.toBeInTheDocument()
    const section = await screen.findByRole('region', { name: '같은 카테고리 상품' })
    expect(get).toHaveBeenCalledWith('/stores/1/products', {
      params: { category: '유제품', sort: 'POPULAR' },
    })
    expect(within(section).getByRole('link', { name: /딸기 우유 200ml/ })).toHaveAttribute(
      'href',
      '/customer/stores/1/products/13',
    )
    expect(within(section).queryByText('흰 우유 500ml')).not.toBeInTheDocument()
    expect(within(section).queryByText('초코 우유 200ml')).not.toBeInTheDocument()
  })

  it('같은 카테고리에 보여 줄 다른 상품이 없으면 그 칸을 숨긴다', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/stores/1/products' ? [milk] : milk }),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })
    expect(await screen.findByRole('button', { name: '1,900원 구매하기' })).toBeInTheDocument()
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/stores/1/products', {
        params: { category: '유제품', sort: 'POPULAR' },
      }),
    )
    expect(screen.queryByRole('region', { name: '같은 카테고리 상품' })).not.toBeInTheDocument()
    expect(screen.queryByText(/같은 카테고리에 다른 상품이 없어요/)).not.toBeInTheDocument()
  })

  it('품절이면 대신 살 같은 카테고리 상품을 바로 보여 준다', async () => {
    const soldOut = { ...milk, availableQuantity: 0, soldOut: true, nearestExpiry: null }
    get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/stores/1/products'
          ? { data: [{ ...milk, productId: 13, name: '딸기 우유 200ml' }] }
          : url === '/notifications/restock/12'
            ? { data: { storeId: 1, productId: 12, subscribed: false } }
            : { data: soldOut },
      ),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const section = await screen.findByRole('region', { name: '같은 카테고리 상품' })
    expect(within(section).getByText('딸기 우유 200ml')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /같은 카테고리 상품 보기/ }),
    ).not.toBeInTheDocument()
  })

  it('선착순 상품은 수량 칸 없이 구매하기가 상품 값을 담아 대기 화면으로 보낸다', async () => {
    get.mockResolvedValue({ data: { ...milk, firstCome: true } })
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(
      await screen.findByText(
        '선착순 상품이라 줄을 선 뒤 차례대로 살 수 있어요. 한 사람이 1개만 살 수 있어요.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '수량 한 개 더하기' })).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('link', { name: '구매하기' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/customer/stores/1/products/12/queue'),
    )
    expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
      storeId: '1',
      storeName: '프레시 강남점',
      productId: '12',
      productName: '흰 우유 500ml',
      price: '1900',
      available: '7',
      imageUrl: 'https://img.example/P012.jpg',
    })
  })

  it('팔고 있는 상품에도 구매 가능한 다른 점포를 늘 펼쳐 보인다', async () => {
    const storeOf = (storeId: number, name: string) => ({
      storeId,
      storeCode: `S${storeId}`,
      name,
      address: '주소',
      region: 'SEOUL',
      latitude: 37.5 + storeId / 100,
      longitude: 127,
      description: null,
      imageUrl: null,
    })
    const others: unknown[] = [
      { storeId: 2, availableQuantity: 4, nearestExpiry: '2026-11-08T23:59:59+09:00' },
    ]
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/products/12/stores'
            ? others
            : url === '/stores/1'
              ? storeOf(1, '프레시 강남점')
              : url === '/stores/2'
                ? storeOf(2, '프레시 역삼점')
                : url === '/stores/1/products'
                  ? []
                  : milk,
      }),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })
    const section = await screen.findByRole('region', { name: '구매 가능한 다른 점포' })
    expect(within(section).getByText('프레시 역삼점')).toBeInTheDocument()
  })

  it('팔고 있는데 다른 점포에도 재고가 없으면 그 칸을 숨긴다', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url === '/products/12/stores' ? [] : url === '/stores/1/products' ? [] : milk,
      }),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })
    expect(await screen.findByRole('button', { name: '1,900원 구매하기' })).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/products/12/stores'))
    expect(screen.queryByRole('region', { name: '구매 가능한 다른 점포' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '근처 점포에 있어요' })).not.toBeInTheDocument()
  })

  it('품절이면 같은 지역의 다른 점포 재고를 많이 남은 순으로 보여 주고, 누르면 그 점포 상품으로 간다', async () => {
    const soldOut = { ...milk, availableQuantity: 0, soldOut: true, nearestExpiry: null }
    const storeOf = (storeId: number, name: string, region: string) => ({
      storeId,
      storeCode: `S${storeId}`,
      name,
      address: '주소',
      region,
      latitude: 37.5 + storeId / 100,
      longitude: 127,
      description: null,
      imageUrl: null,
    })
    const stores: Record<string, unknown> = {
      '/stores/1': storeOf(1, '프레시 강남점', 'SEOUL'),
      '/stores/2': storeOf(2, '프레시 역삼점', 'SEOUL'),
      '/stores/3': storeOf(3, '프레시 해운대점', 'BUSAN'),
      '/stores/4': storeOf(4, '프레시 서초점', 'SEOUL'),
    }
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/products/12/stores'
            ? [
                { storeId: 2, availableQuantity: 1, nearestExpiry: '2026-11-08T23:59:59+09:00' },
                { storeId: 3, availableQuantity: 9, nearestExpiry: '2026-11-08T23:59:59+09:00' },
                { storeId: 4, availableQuantity: 5, nearestExpiry: '2026-11-08T23:59:59+09:00' },
              ]
            : url in stores
              ? stores[url]
              : url === '/notifications/restock/12'
                ? { storeId: 1, productId: 12, subscribed: false }
                : url === '/stores/1/products'
                  ? []
                  : soldOut,
      }),
    )
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const section = await screen.findByRole('region', { name: '근처 점포에 있어요' })
    // 테스트 환경은 위치를 못 써서 같은 지역(서울)만, 많이 남은 순
    expect(
      within(section).getByText('위치를 쓸 수 없어 같은 지역 점포를 보여 드려요.'),
    ).toBeInTheDocument()
    const names = within(section)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('a span')?.textContent)
    expect(names).toEqual(['프레시 서초점', '프레시 역삼점'])
    expect(within(section).queryByText('프레시 해운대점')).not.toBeInTheDocument()
    expect(within(section).getByRole('link', { name: '프레시 서초점 위치 보기' })).toHaveAttribute(
      'href',
      '/customer/stores/4/info',
    )

    await userEvent.click(within(section).getByRole('link', { name: /프레시 서초점.*5개 남음/ }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/customer/stores/4/products/12'),
    )
  })

  it('근처 점포 정보는 지금 점포 지역의 점포 목록에서 한 번에 읽고, 목록에 없는 점포만 상세를 읽는다', async () => {
    const soldOut = { ...milk, availableQuantity: 0, soldOut: true, nearestExpiry: null }
    const place = (storeId: number, name: string, region: string) => ({
      storeId,
      storeCode: `S${storeId}`,
      name,
      address: '주소',
      region,
      latitude: 37.5 + storeId / 100,
      longitude: 127,
    })
    const responses: Record<string, unknown> = {
      '/products/12/stores': [
        { storeId: 2, availableQuantity: 1, nearestExpiry: '2026-11-08T23:59:59+09:00' },
        { storeId: 3, availableQuantity: 9, nearestExpiry: '2026-11-08T23:59:59+09:00' },
        { storeId: 4, availableQuantity: 5, nearestExpiry: '2026-11-08T23:59:59+09:00' },
      ],
      '/stores/1': { ...place(1, '프레시 강남점', 'SEOUL'), description: null, imageUrl: null },
      '/stores/3': { ...place(3, '프레시 해운대점', 'BUSAN'), description: null, imageUrl: null },
      '/stores': [
        place(1, '프레시 강남점', 'SEOUL'),
        place(2, '프레시 역삼점', 'SEOUL'),
        place(4, '프레시 서초점', 'SEOUL'),
      ],
      '/notifications/restock/12': { storeId: 1, productId: 12, subscribed: false },
      '/stores/1/products': [],
    }
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url in responses ? responses[url] : soldOut }),
    )
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const section = await screen.findByRole('region', { name: '근처 점포에 있어요' })
    await waitFor(() =>
      expect(
        within(section)
          .getAllByRole('listitem')
          .map((li) => li.querySelector('a span')?.textContent),
      ).toEqual(['프레시 서초점', '프레시 역삼점']),
    )
    expect(get).toHaveBeenCalledWith('/stores', { params: { region: 'SEOUL' } })
    // 다른 지역 점포(해운대)만 상세를 읽는다
    await waitFor(() => expect(get).toHaveBeenCalledWith('/stores/3'))
    const urls = get.mock.calls.map((call) => call[0])
    expect(urls).not.toContain('/stores/2')
    expect(urls).not.toContain('/stores/4')
  })
})

describe('마감세일 구매 시트', () => {
  const clearanceMilk: StoreProductDetail = {
    ...milk,
    clearanceQuantity: 2,
    clearancePrice: 1330,
    clearanceExpiry: '2026-10-25T23:59:59+09:00',
  }

  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    sessionStorage.clear()
  })

  it('기본·마감세일 두 줄에서 수량을 골라 [N원 구매하기]로 바로 주문을 만든다', async () => {
    get.mockResolvedValue({ data: clearanceMilk })
    post.mockResolvedValue({ data: { orderId: 77, orderNo: 'FL-77', status: 'RESERVING' } })
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const sheet = await screen.findByRole('region', { name: '마감세일 30%' })
    expect(screen.getByText('마감세일 남은 수량').nextSibling).toHaveTextContent('2개')
    // 처음에는 마감세일 1개
    expect(within(sheet).getByLabelText('마감세일 1개')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('일반 0개')).toBeInTheDocument()
    expect(within(sheet).getByText('1,330원', { selector: '[aria-live]' })).toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('button', { name: '마감세일 한 개 더하기' }))
    // 마감세일은 2개만 남아 더 고를 수 없다
    expect(within(sheet).getByRole('button', { name: '마감세일 한 개 더하기' })).toBeDisabled()
    await userEvent.click(within(sheet).getByRole('button', { name: '일반 한 개 더하기' }))
    expect(within(sheet).getByText('4,560원')).toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('button', { name: '4,560원 구매하기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/77'))
    expect(post).toHaveBeenCalledWith(
      '/orders',
      {
        storeId: 1,
        storeName: '프레시 강남점',
        productId: 12,
        quantity: 3,
        clearanceQuantity: 2,
      },
      expect.anything(),
    )
  })

  it('마감세일 판매 시간이 아니라고 거절되면 이유를 알리고 상세에 남는다', async () => {
    get.mockResolvedValue({ data: clearanceMilk })
    post.mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { code: 'CLEARANCE_NOT_ON_SALE' } },
      }),
    )
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const sheet = await screen.findByRole('region', { name: '마감세일 30%' })
    await userEvent.click(within(sheet).getByRole('button', { name: '1,330원 구매하기' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(router.state.location.pathname).toBe('/customer/stores/1/products/12')
    expect(within(sheet).getByRole('button', { name: '1,330원 구매하기' })).toBeEnabled()
  })

  it('합계는 5개까지이고, 합계가 0이 되게 빼지는 못한다', async () => {
    get.mockResolvedValue({ data: { ...clearanceMilk, clearanceQuantity: 5 } })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    const sheet = await screen.findByRole('region', { name: '마감세일 30%' })
    expect(within(sheet).getByRole('button', { name: '마감세일 한 개 빼기' })).toBeDisabled()
    for (let i = 0; i < 4; i++) {
      await userEvent.click(within(sheet).getByRole('button', { name: '일반 한 개 더하기' }))
    }
    expect(within(sheet).getByRole('button', { name: '일반 한 개 더하기' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: '마감세일 한 개 더하기' })).toBeDisabled()
    expect(within(sheet).getByText(/합계 5개/)).toBeInTheDocument()
  })

  it('기본 수량이 0이어도 마감세일만 살 수 있다', async () => {
    get.mockResolvedValue({ data: { ...clearanceMilk, availableQuantity: 0, nearestExpiry: null } })
    const router = renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    post.mockResolvedValue({ data: { orderId: 78, orderNo: 'FL-78', status: 'RESERVING' } })
    const sheet = await screen.findByRole('region', { name: '마감세일 30%' })
    expect(within(sheet).getByRole('button', { name: '일반 한 개 더하기' })).toBeDisabled()
    await userEvent.click(within(sheet).getByRole('button', { name: '1,330원 구매하기' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/orders/78'))
    expect(post).toHaveBeenCalledWith(
      '/orders',
      expect.objectContaining({ quantity: 1, clearanceQuantity: 1 }),
      expect.anything(),
    )
  })

  it('마감세일이 없으면 시트 없이 수량 칸과 구매하기만 보인다', async () => {
    get.mockResolvedValue({
      data: { ...clearanceMilk, clearanceQuantity: 0, clearancePrice: null },
    })
    renderAt('/customer/stores/1/products/12', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('button', { name: '1,900원 구매하기' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '마감세일 30%' })).not.toBeInTheDocument()
    expect(screen.queryByText('마감세일 남은 수량')).not.toBeInTheDocument()
  })
})
