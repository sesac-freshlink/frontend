import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosRequestConfig } from 'axios'
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
    imageUrl: 'https://img.example/P015.jpg',
    availableQuantity: 3,
    soldOut: false,
    recommended: true,
    newArrival: false,
    firstCome: false,
    // 먼 기한이라 D-day 배지는 붙지 않는다
    nearestExpiry: '2099-12-31T23:59:59+09:00',
  },
  {
    productId: 3,
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    imageUrl: null,
    availableQuantity: 0,
    soldOut: true,
    recommended: false,
    newArrival: true,
    firstCome: true,
    nearestExpiry: null,
  },
]

const CATEGORIES = ['라면', '샌드위치']

type Get = (url: string, config?: AxiosRequestConfig) => Promise<{ data: unknown }>

/** 카테고리 주소는 CATEGORIES 를, 나머지(상품 목록)는 handler 가 답한다 */
function serve(handler: Get) {
  get.mockImplementation((url: string, config?: AxiosRequestConfig) =>
    url.endsWith('/products/categories')
      ? Promise.resolve({ data: CATEGORIES })
      : handler(url, config),
  )
}

/** 상품 목록 요청만 */
/** page·size 말고 거르는 조건(q·category·sort·recommended·newOnly)이 있는지 */
function hasFilter(config?: AxiosRequestConfig) {
  const params = (config?.params ?? {}) as Record<string, unknown>
  return Object.keys(params).some((key) => key !== 'page' && key !== 'size')
}

function productCalls() {
  return get.mock.calls.filter(([url]) => url === '/stores/1/products')
}

/** 가짜 get 이 받은 검색어(q). 없으면 빈 문자열 */
function qOf(config?: AxiosRequestConfig): string {
  const params = config?.params as { q?: string } | undefined
  return params?.q ?? ''
}

function renderAt(path: string, state?: { storeName: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/stores', element: <p>점포 찾기 화면</p> },
      { path: '/customer/stores/:storeId', element: <StoreProductsPage /> },
      { path: '/customer/stores/:storeId/products/:productId', element: <p>상품 상세 화면</p> },
      { path: '/customer/orders/:id', element: <p>주문·결제 화면</p> },
    ],
    // 주소에 ?조건이 있으면 pathname·search 로 나눠 넘긴다(state 를 같이 넘길 때)
    {
      initialEntries: [
        state
          ? {
              pathname: path.split('?')[0],
              search: path.includes('?') ? `?${path.split('?')[1]}` : '',
              state,
            }
          : path,
      ],
    },
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
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products', { params: { page: 0, size: 20 } })

    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(noodle).getByText('1,700원')).toBeInTheDocument()
    // 3개 이하로 남으면 빨갛게 "N개 남았어요"
    expect(within(noodle).getByText('3개 남았어요')).toHaveClass('text-red-700')

    // 2칸 사진 카드, 서버 순서 그대로
    const names = [...document.querySelectorAll('ul.grid > li')].map(
      (li) => li.querySelector('.line-clamp-2')?.textContent,
    )
    expect(names).toEqual(['매운 컵라면 115g', '샌드위치 햄치즈'])
  })

  it('품절 상품은 흐리게 보여 주고 누를 수 없다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    const sandwich = (await screen.findByText('샌드위치 햄치즈')).closest('li')!
    expect(within(sandwich).getByText('품절')).toBeInTheDocument()
    expect(within(sandwich).queryByRole('link')).not.toBeInTheDocument()
    expect(sandwich).toHaveAttribute('aria-disabled', 'true')
    // 사진만 흐리게 한다
    expect(sandwich.querySelector('.opacity-40')).not.toBeNull()
  })

  it('상품을 누르면 그 상품의 상세 화면으로 간다', async () => {
    serve(() => Promise.resolve({ data: products }))
    const router = renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    await userEvent.click(await screen.findByText('매운 컵라면 115g'))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/customer/stores/1/products/15'),
    )
    expect(await screen.findByText('상품 상세 화면')).toBeInTheDocument()
  })

  it('이미지가 있는 상품은 썸네일을, 없는 상품은 자리표시를 보여 준다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    expect(await screen.findByRole('img', { name: '매운 컵라면 115g' })).toHaveAttribute(
      'src',
      'https://img.example/P015.jpg',
    )
    expect(screen.getByRole('img', { name: '샌드위치 햄치즈 이미지 없음' })).toBeInTheDocument()
  })

  it('새로고침으로 점포 이름이 사라져도 이 세션에 남긴 이름을 다시 쓴다', async () => {
    serve(() => Promise.resolve({ data: products }))
    sessionStorage.setItem('freshlink.storeName.1', '프레시 강남점')
    renderAt('/customer/stores/1')

    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /매운 컵라면/ })).toBeInTheDocument()
  })

  it('점포 이름을 모르면 목록은 보여 주되 구매는 막고 점포 찾기로 안내한다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1')

    expect(await screen.findByText('점포 찾기에서 점포를 다시 골라 주세요.')).toBeInTheDocument()
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /매운 컵라면/ })).not.toBeInTheDocument()
  })

  it('상품이 없으면 안내 문구를, 오류면 다시 시도를 보여 준다', async () => {
    serve(() => Promise.resolve({ data: [] }))
    renderAt('/customer/stores/9', { storeName: '프레시 없는점' })
    expect(await screen.findByText('이 점포에는 상품이 없어요.')).toBeInTheDocument()

    get.mockRejectedValue(new Error('network'))
    await userEvent.click(screen.getByRole('button', { name: '새로고침' }))
    expect(await screen.findByText('상품을 불러오지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('검색어를 넣고 검색을 누르면 q 로 서버에 묻고 거른 목록을 보여 준다', async () => {
    serve((_url, config) =>
      Promise.resolve({
        data: qOf(config) ? products.filter((p) => p.name.includes(qOf(config))) : products,
      }),
    )
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('샌드위치 햄치즈')

    // 치는 동안에는 묻지 않는다. 검색을 누를 때만
    await userEvent.type(screen.getByRole('textbox', { name: '상품 검색어' }), ' 컵라면 ')
    expect(productCalls()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(screen.queryByText('샌드위치 햄치즈')).not.toBeInTheDocument())
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
      params: { q: '컵라면', page: 0, size: 20 },
    })
  })

  it('검색 결과가 없으면 안내와 전체 상품 보기를 보여 주고, 누르면 검색을 지운다', async () => {
    serve((_url, config) => Promise.resolve({ data: qOf(config) ? [] : products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('샌드위치 햄치즈')

    await userEvent.type(screen.getByRole('textbox', { name: '상품 검색어' }), '없는상품')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('‘없는상품’ 상품이 없어요.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '전체 상품 보기' }))
    expect(await screen.findByText('샌드위치 햄치즈')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '상품 검색어' })).toHaveValue('')
  })

  it('카테고리 칩을 누르면 그 카테고리로 서버에 묻고, 전체를 누르면 조건을 푼다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    const group = await screen.findByRole('group', { name: '카테고리' })
    expect(await within(group).findByRole('button', { name: '라면' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: '전체' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(within(group).getByRole('button', { name: '라면' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
        params: { category: '라면', page: 0, size: 20 },
      }),
    )
    expect(within(group).getByRole('button', { name: '라면' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(within(group).getByRole('button', { name: '전체' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', { params: { page: 0, size: 20 } }),
    )
  })

  it('아이콘 조건은 하나만 켜진다: 다른 것을 누르면 앞의 것이 꺼지고 정렬은 같이 걸린다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('매운 컵라면 115g')

    await userEvent.click(screen.getByRole('button', { name: '점주 추천' }))
    await userEvent.click(screen.getByRole('button', { name: '신상품' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '정렬' }), '추천순')

    expect(screen.getByRole('button', { name: '신상품' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '점주 추천' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
        params: { sort: 'POPULAR', newOnly: true, page: 0, size: 20 },
      }),
    )
  })

  it('켜진 아이콘을 다시 누르면 꺼지고 전체로 돌아간다. 카테고리는 그대로 같이 걸린다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1?category=%EB%9D%BC%EB%A9%B4', { storeName: '프레시 강남점' })
    await screen.findByText('매운 컵라면 115g')

    await userEvent.click(screen.getByRole('button', { name: '점주 추천' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
        params: { category: '라면', recommended: true, page: 0, size: 20 },
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: '점주 추천' }))
    expect(screen.getByRole('button', { name: '점주 추천' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
        params: { category: '라면', page: 0, size: 20 },
      }),
    )
  })

  it('목록에서 거르는 마감세일·선착순도 하나만: 선착순을 누르면 마감세일이 꺼진다', async () => {
    serve(() =>
      Promise.resolve({
        data: [
          {
            ...products[0],
            clearanceQuantity: 2,
            clearancePrice: 1190,
            clearanceExpiry: '2099-12-30T23:59:59+09:00',
          },
          products[1],
        ],
      }),
    )
    renderAt('/customer/stores/1?show=clearance', { storeName: '프레시 강남점' })
    expect(await screen.findByText('매운 컵라면 115g')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '선착순' }))
    expect(screen.getByRole('button', { name: '마감세일' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(await screen.findByText('샌드위치 햄치즈')).toBeInTheDocument()
    expect(screen.queryByText('매운 컵라면 115g')).not.toBeInTheDocument()
  })

  it('주소에 ?show= 가 여러 개 오면 알맞은 값 중 맨 앞 하나만 켠다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1?show=oops&show=new&show=recommended', {
      storeName: '프레시 강남점',
    })
    await screen.findByText('샌드위치 햄치즈')
    expect(screen.getByRole('button', { name: '신상품' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '점주 추천' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/stores/1/products', {
        params: { newOnly: true, page: 0, size: 20 },
      }),
    )
  })

  it('추천·신상품·선착순 상품에 배지를 붙인다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(noodle).getByText('추천')).toBeInTheDocument()
    expect(within(noodle).queryByText('신상품')).not.toBeInTheDocument()
    const sandwich = screen.getByText('샌드위치 햄치즈').closest('li')!
    expect(within(sandwich).getByText('신상품')).toBeInTheDocument()
    expect(within(sandwich).getByText('선착순')).toBeInTheDocument()
  })

  it('조건에 맞는 상품이 없으면 안내하고, 전체 상품 보기로 조건을 모두 푼다', async () => {
    // page·size 말고 다른 조건이 걸리면 빈 목록
    serve((_url, config) => Promise.resolve({ data: hasFilter(config) ? [] : products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('샌드위치 햄치즈')

    await userEvent.click(screen.getByRole('button', { name: '신상품' }))
    expect(await screen.findByText('조건에 맞는 상품이 없어요.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '전체 상품 보기' }))
    expect(await screen.findByText('샌드위치 햄치즈')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '신상품' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('숫자가 아닌 점포 주소는 점포 찾기로 안내한다', () => {
    renderAt('/customer/stores/abc')
    expect(screen.getByText('점포 주소가 올바르지 않아요.')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  it('유통기한이 가까운 상품에는 D-day 배지를 붙인다', async () => {
    // 한국 날짜로 오늘 끝나는 상품
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    serve(() =>
      Promise.resolve({
        data: [{ ...products[0], nearestExpiry: `${today}T23:59:59+09:00` }, products[1]],
      }),
    )
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(noodle).getByLabelText('유통기한 오늘까지')).toHaveTextContent('오늘까지')
    // 품절 상품은 기한이 없어 배지가 없다
    const sandwich = screen.getByText('샌드위치 햄치즈').closest('li')!
    expect(within(sandwich).queryByLabelText(/유통기한/)).not.toBeInTheDocument()
  })

  it('마감세일 수량이 있으면 배지와 할인가·수량을 붙이고 읽는 이름에도 넣는다', async () => {
    serve(() =>
      Promise.resolve({
        data: [
          {
            ...products[0],
            clearanceQuantity: 2,
            clearancePrice: 1190,
            clearanceExpiry: '2099-12-30T23:59:59+09:00',
          },
          products[1],
        ],
      }),
    )
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(noodle).getByText('마감세일')).toBeInTheDocument()
    // 할인율·할인가·원래 가격, 기본 수량 옆에 마감세일 수량
    expect(within(noodle).getByText('30%')).toBeInTheDocument()
    expect(within(noodle).getByText('1,190원')).toBeInTheDocument()
    expect(within(noodle).getByText('3개 남았어요 · 마감세일 2개')).toBeInTheDocument()
    expect(within(noodle).getByRole('link')).toHaveAccessibleName(
      '매운 컵라면 115g, 1,700원, 3개 남음, 마감세일 1,190원 2개, 추천',
    )
    // 마감세일이 없는 상품에는 붙지 않는다
    const sandwich = screen.getByText('샌드위치 햄치즈').closest('li')!
    expect(within(sandwich).queryByText(/마감세일/)).not.toBeInTheDocument()
  })

  it('홈에서 넘어온 검색어(?q)·카테고리(?category)로 시작한다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt(
      `/customer/stores/1?q=${encodeURIComponent('컵라면')}&category=${encodeURIComponent('라면')}`,
      {
        storeName: '프레시 강남점',
      },
    )
    expect(await screen.findByRole('textbox', { name: '상품 검색어' })).toHaveValue('컵라면')
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/stores/1/products', {
        params: { q: '컵라면', category: '라면', page: 0, size: 20 },
      }),
    )
  })

  it('홈 [전체 보기](?show=clearance)로 들어오면 마감세일 칩이 켜지고 마감세일 상품만 보인다', async () => {
    serve(() =>
      Promise.resolve({
        data: [
          {
            ...products[0],
            clearanceQuantity: 2,
            clearancePrice: 1190,
            clearanceExpiry: '2099-12-30T23:59:59+09:00',
          },
          products[1],
        ],
      }),
    )
    renderAt('/customer/stores/1?show=clearance', { storeName: '프레시 강남점' })
    expect(await screen.findByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.queryByText('샌드위치 햄치즈')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '마감세일' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('위 뒤로 링크는 홈으로 가고, 마감세일만 남은 상품에는 "0개 남음" 대신 마감세일로만 살 수 있다고 보인다', async () => {
    serve(() =>
      Promise.resolve({
        data: [
          {
            ...products[0],
            availableQuantity: 0,
            clearanceQuantity: 5,
            clearancePrice: 1190,
            clearanceExpiry: '2099-12-30T23:59:59+09:00',
          },
        ],
      }),
    )
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    const row = (await screen.findByText('매운 컵라면 115g')).closest('li')!
    expect(within(row).getByText('마감세일로만 5개 남았어요')).toBeInTheDocument()
    expect(within(row).queryByText('0개 남음')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/customer')
  })

  it('[픽업 점포로 정하기]를 누르면 이 기기에 저장하고 "내 픽업 점포"로 바뀐다', async () => {
    localStorage.clear()
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await userEvent.click(await screen.findByRole('button', { name: '픽업 점포로 정하기' }))
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore') ?? 'null')).toEqual({
      storeId: 1,
      name: '프레시 강남점',
    })
    expect(screen.getByText('내 픽업 점포')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '픽업 점포로 정하기' })).not.toBeInTheDocument()
  })

  it('점포 검색에서 둘러보러 왔으면 위 뒤로 링크가 점포 검색으로 간다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점', from: 'search' } as {
      storeName: string
    })
    expect(await screen.findByRole('link', { name: '점포 검색' })).toHaveAttribute(
      'href',
      '/customer/stores',
    )
  })

  it('20개가 넘으면 [더 보기]로 다음 묶음을 이어 붙이고, 마지막 묶음이면 버튼이 사라진다', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...products[0],
      productId: 100 + i,
      name: `상품 ${String(i + 1).padStart(2, '0')}`,
    }))
    serve((_url, config) => {
      const { page = 0, size = 20 } = (config?.params ?? {}) as { page?: number; size?: number }
      return Promise.resolve({ data: many.slice(page * size, (page + 1) * size) })
    })
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })

    expect(await screen.findByText('상품 20')).toBeInTheDocument()
    expect(screen.queryByText('상품 21')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '더 보기' }))
    expect(await screen.findByText('상품 25')).toBeInTheDocument()
    expect(screen.getByText('상품 01')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/stores/1/products', { params: { page: 1, size: 20 } })
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
  })

  it('한 묶음보다 적으면 [더 보기]가 없다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('매운 컵라면 115g')
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
  })

  it('맨 위에서 충분히 당겼다 놓으면 상품을 다시 읽고, 조금만 당기면 읽지 않는다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('매운 컵라면 115g')
    const area = screen.getByRole('heading', { name: '프레시 강남점' }).closest('section')!
    const before = productCalls().length

    // 조금만 당기면(저항 반영 30px) 아무것도 안 한다
    fireEvent.touchStart(area, { touches: [{ clientX: 10, clientY: 0 }] })
    fireEvent.touchMove(area, { touches: [{ clientX: 10, clientY: 60 }] })
    expect(screen.getByRole('status')).toHaveTextContent('당겨서 새로고침')
    fireEvent.touchEnd(area)
    expect(productCalls()).toHaveLength(before)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // 충분히 당기면 "놓으면 새로고침" → 놓으면 다시 읽는다
    fireEvent.touchStart(area, { touches: [{ clientX: 10, clientY: 0 }] })
    fireEvent.touchMove(area, { touches: [{ clientX: 10, clientY: 200 }] })
    expect(screen.getByRole('status')).toHaveTextContent('놓으면 새로고침')
    fireEvent.touchEnd(area)
    await waitFor(() => expect(productCalls().length).toBeGreaterThan(before))
  })

  it('옆으로 미는 동작은 당기기로 보지 않는다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    await screen.findByText('매운 컵라면 115g')
    const area = screen.getByRole('heading', { name: '프레시 강남점' }).closest('section')!
    const before = productCalls().length

    fireEvent.touchStart(area, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(area, { touches: [{ clientX: 300, clientY: 200 }] })
    fireEvent.touchEnd(area)
    expect(productCalls()).toHaveLength(before)
  })

  it('상품 줄은 화면 읽기 프로그램이 상품명, 가격, 남은 수량, 배지 순으로 한 번에 읽는다', async () => {
    serve(() => Promise.resolve({ data: products }))
    renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    expect(
      await screen.findByRole('link', { name: '매운 컵라면 115g, 1,700원, 3개 남음, 추천' }),
    ).toBeInTheDocument()
  })

  it('마우스 없이 Tab으로 상품까지 가서 Enter로 상세에 들어간다', async () => {
    serve(() => Promise.resolve({ data: products }))
    const router = renderAt('/customer/stores/1', { storeName: '프레시 강남점' })
    const link = await screen.findByRole('link', { name: /^매운 컵라면 115g,/ })

    for (let i = 0; i < 40 && document.activeElement !== link; i++) await userEvent.tab()
    expect(link).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/customer/stores/1/products/15'),
    )
  })
})
