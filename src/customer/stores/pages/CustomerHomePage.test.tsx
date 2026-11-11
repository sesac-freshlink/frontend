import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import type { StoreProduct } from '../api'
import { CustomerHomePage } from './CustomerHomePage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)

const notFound = Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } })
const me = { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'SEOUL' }
const gangnam = {
  storeId: 1,
  storeCode: 'S1',
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
  latitude: 37.498095,
  longitude: 127.02761,
}
const yeoksam = {
  ...gangnam,
  storeId: 2,
  name: '프레시 역삼점',
  latitude: 37.500622,
  longitude: 127.036456,
}
const noCoords = {
  ...gangnam,
  storeId: 3,
  name: '프레시 좌표없음점',
  latitude: null,
  longitude: null,
}

function product(over: Partial<StoreProduct> & { productId: number; name: string }): StoreProduct {
  return {
    category: '김밥',
    price: 3000,
    imageUrl: null,
    availableQuantity: 5,
    soldOut: false,
    recommended: false,
    newArrival: false,
    firstCome: false,
    nearestExpiry: null,
    ...over,
  }
}

const soon = new Date(Date.now() + 40 * 60_000).toISOString()
const later = new Date(Date.now() + 5 * 60 * 60_000).toISOString()
const allProducts = [
  product({
    productId: 1,
    name: '참치김밥',
    price: 3000,
    clearanceQuantity: 2,
    clearancePrice: 2100,
    clearanceExpiry: later,
  }),
  product({
    productId: 2,
    name: '제육 도시락',
    category: '도시락',
    price: 5000,
    imageUrl: '/dosirak.png',
    clearanceQuantity: 1,
    clearancePrice: 3500,
    clearanceExpiry: soon,
  }),
  product({ productId: 3, name: '바나나우유', category: '유제품', price: 1700 }),
]
const recommendedProducts = [
  product({ productId: 3, name: '바나나우유', category: '유제품', price: 1700, recommended: true }),
]

interface Setup {
  banners?: unknown
  productsError?: boolean
}

function mockApi({ banners = notFound, productsError = false }: Setup = {}) {
  get.mockImplementation(async (url, config) => {
    const params = (config as { params?: Record<string, unknown> } | undefined)?.params ?? {}
    if (url === '/members/me') return { data: me }
    if (url === '/members/banners') {
      if (banners instanceof Error) throw banners
      return { data: banners }
    }
    if (url === '/stores') return { data: [gangnam, yeoksam, noCoords] }
    if (url === '/stores/1/products') {
      if (params.recommended) return { data: recommendedProducts }
      if (params.newOnly) return { data: [] }
      if (productsError) throw new Error('500')
      return { data: allProducts }
    }
    throw new Error(`unexpected ${String(url)}`)
  })
}

function mockPosition(ok: boolean) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (ok) {
          success({ coords: { latitude: 37.4979, longitude: 127.0276 } } as GeolocationPosition)
        } else {
          failure({ code: 1 } as GeolocationPositionError)
        }
      },
    },
  })
}

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer', element: <CustomerHomePage /> },
      { path: '/customer/stores', element: <p>점포 검색 화면</p> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록</p> },
      { path: '/customer/notices/:noticeId', element: <p>공지 상세</p> },
      { path: '/signup', element: <p>프로필 등록</p> },
    ],
    { initialEntries: ['/customer'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const pickGangnam = () =>
  localStorage.setItem(
    'freshlink.pickupStore',
    JSON.stringify({ storeId: 1, name: '프레시 강남점' }),
  )

describe('고객 홈 (U-01)', () => {
  beforeEach(() => {
    get.mockReset()
    localStorage.clear()
    useAuthStore.setState({ user: { userId: 's', role: 'CUSTOMER' }, restoring: false })
    mockPosition(true)
  })
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('픽업 점포를 안 골랐으면 점포 고르기 안내만 보이고 상품을 부르지 않는다', async () => {
    mockApi()
    const router = renderHome()
    await userEvent.click(await screen.findByRole('link', { name: '점포 고르기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores'))
    expect(get).not.toHaveBeenCalledWith('/stores/1/products')
  })

  it('픽업 점포 한 줄에 이름과 거리를 보이고, 누르면 점포 검색으로 간다', async () => {
    pickGangnam()
    mockApi()
    const router = renderHome()
    const row = await screen.findByRole('link', { name: /^픽업 점포 프레시 강남점, 100m/ })
    await userEvent.click(row)
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores'))
  })

  it('오늘 마감세일 줄은 마감세일 상품만 마감 빠른 순으로, 할인율·할인가·원래 가격·남은 개수를 보인다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const rail = await screen.findByRole('region', { name: '오늘 마감세일' })
    const cards = await within(rail).findAllByRole('link', { name: /도시락|김밥|우유/ })
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/customer/stores/1/products/2',
      '/customer/stores/1/products/1',
    ])
    expect(within(cards[0]).getByText('3,500원')).toBeInTheDocument()
    expect(within(cards[0]).getByText('5,000원')).toHaveClass('line-through')
    expect(within(cards[0]).getByText('30%')).toBeInTheDocument()
    expect(within(cards[0]).getByText('1개 남음')).toBeInTheDocument()
    expect(within(cards[0]).getByText(/분 남음$/)).toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: '오늘 마감세일 전체 보기' })).toHaveAttribute(
      'href',
      '/customer/stores/1?show=clearance',
    )
  })

  it('점주 추천·신상품 줄은 서버 조건으로 부르고, 비면 안내한다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const recommended = await screen.findByRole('region', { name: '점주 추천' })
    expect(await within(recommended).findByText('바나나우유')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products', { params: { recommended: true } })
    const fresh = screen.getByRole('region', { name: '신상품' })
    expect(
      await within(fresh).findByText('이번 주에 새로 들어온 상품이 없어요.'),
    ).toBeInTheDocument()
  })

  it('상품 줄을 못 불러오면 다시 시도를 보인다', async () => {
    pickGangnam()
    mockApi({ productsError: true })
    renderHome()
    const rail = await screen.findByRole('region', { name: '오늘 마감세일' })
    expect(await within(rail).findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('카테고리 칸은 그 분류 상품 목록으로, 마지막 칸은 전체 분류로 간다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const nav = await screen.findByRole('navigation', { name: '카테고리' })
    expect(within(nav).getAllByRole('link')).toHaveLength(8)
    expect(within(nav).getByRole('link', { name: '도시락' })).toHaveAttribute(
      'href',
      `/customer/stores/1?category=${encodeURIComponent('도시락')}`,
    )
    expect(within(nav).getByRole('link', { name: '카테고리' })).toHaveAttribute(
      'href',
      '/customer/stores/1/categories',
    )
  })

  it('상품 검색은 그 점포 상품 목록을 검색어와 함께 연다', async () => {
    pickGangnam()
    mockApi()
    const router = renderHome()
    await userEvent.type(await screen.findByPlaceholderText('프레시 강남점 상품 검색'), ' 김밥 ')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores/1'))
    expect(router.state.location.search).toBe(`?q=${encodeURIComponent('김밥')}`)
  })

  it('배너 API 가 없으면(404) 배너 칸을 숨긴다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    await screen.findByRole('region', { name: '오늘 마감세일' })
    await waitFor(() => expect(get).toHaveBeenCalledWith('/members/banners'))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '알림 배너' })).not.toBeInTheDocument(),
    )
  })

  it('배너 응답이 목록이 아니면(모양이 다르면) 배너 칸만 숨기고 홈은 그대로 보인다', async () => {
    pickGangnam()
    mockApi({ banners: { message: 'not a list' } })
    renderHome()
    expect(await screen.findByRole('region', { name: '오늘 마감세일' })).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/members/banners'))
    expect(screen.queryByRole('region', { name: '알림 배너' })).not.toBeInTheDocument()
  })

  it('배너가 있으면 제목을 보이고 공지 상세로 간다. 두 장 이상이면 멈춤 버튼이 있다', async () => {
    pickGangnam()
    mockApi({
      banners: [
        { bannerId: 1, title: '오늘 밤 마감세일', imageUrl: '/b1.svg', noticeId: 7 },
        { bannerId: 2, title: '픽업 신청 안내', imageUrl: '/b2.svg', noticeId: null },
      ],
    })
    renderHome()
    const banner = await screen.findByRole('region', { name: '알림 배너' })
    expect(within(banner).getByRole('link', { name: '오늘 밤 마감세일' })).toHaveAttribute(
      'href',
      '/customer/notices/7',
    )
    expect(within(banner).getByText('픽업 신청 안내')).toBeInTheDocument()
    expect(
      within(banner).getByRole('button', { name: /배너 멈춤|배너 저절로 넘기기/ }),
    ).toBeInTheDocument()
  })

  it('내 주변 점포는 좌표가 있는 점포만 가까운 순으로 거리와 함께 보인다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const section = await screen.findByRole('region', { name: '내 주변 점포' })
    const links = await within(section).findAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/customer/stores/1',
      '/customer/stores/2',
    ])
    expect(within(links[1]).getByText('800m')).toBeInTheDocument()
    expect(within(section).queryByText('프레시 좌표없음점')).not.toBeInTheDocument()
  })

  it('위치를 못 얻으면 내 주변 점포 자리에 점포 검색 안내를 보인다', async () => {
    pickGangnam()
    mockPosition(false)
    mockApi()
    renderHome()
    const section = await screen.findByRole('region', { name: '내 주변 점포' })
    expect(await within(section).findByText(/위치를 알 수 없어/)).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: '점포 검색으로 가기' })).toHaveAttribute(
      'href',
      '/customer/stores',
    )
  })

  it('프로필이 없으면 프로필 등록 마무리 화면으로 보낸다', async () => {
    get.mockRejectedValue(notFound)
    renderHome()
    expect(await screen.findByText('프로필 등록')).toBeInTheDocument()
  })
})
