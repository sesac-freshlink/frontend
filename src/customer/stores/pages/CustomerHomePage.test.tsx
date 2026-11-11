import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  /** 베스트 상품(추천순) 요청을 실패시킨다 */
  bestError?: boolean
  /** 내 지역 점포 목록(점포명순으로 온다고 본다) */
  stores?: unknown[]
}

function mockApi({
  banners = notFound,
  productsError = false,
  bestError = false,
  stores = [gangnam, yeoksam, noCoords],
}: Setup = {}) {
  get.mockImplementation(async (url, config) => {
    const params = (config as { params?: Record<string, unknown> } | undefined)?.params ?? {}
    if (url === '/members/me') return { data: me }
    if (url === '/members/banners') {
      if (banners instanceof Error) throw banners
      return { data: banners }
    }
    if (url === '/stores') return { data: stores }
    if (/^\/stores\/\d+\/products$/.test(String(url))) {
      if (params.recommended) return { data: recommendedProducts }
      if (params.newOnly) return { data: [] }
      if (params.sort === 'POPULAR') {
        if (bestError) throw new Error('404')
        return { data: [...allProducts, ...recommendedProducts].slice(0, 5) }
      }
      if (productsError) throw new Error('500')
      return { data: allProducts }
    }
    throw new Error(`unexpected ${String(url)}`)
  })
}

/** ok = 허용(강남역 근처), false = 거절, 'never' = 답이 아직 없음(권한 창을 띄운 채) */
function mockPosition(ok: boolean | 'never') {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
        if (ok === 'never') return
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

  it('점포를 안 골랐고 위치를 허용하면 가장 가까운 점포로 홈 전체를 채우고, 이 기기에 저장하지 않는다', async () => {
    // 목록 첫 점포(좌표 없음)가 아니라 가장 가까운 강남점을 고른다
    mockApi({ stores: [noCoords, yeoksam, gangnam] })
    renderHome()
    const row = await screen.findByRole('link', { name: /^가까운 점포 프레시 강남점, 100m/ })
    expect(within(row).getByText('바꾸기')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: '오늘 마감세일' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '카테고리' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products')
    expect(localStorage.getItem('freshlink.pickupStore.s')).toBeNull()
    // 임시 점포에는 내 주변 점포 목록에서 "픽업 점포" 표시를 붙이지 않는다
    const nearby = screen.getByRole('region', { name: '내 주변 점포' })
    expect(await within(nearby).findByText('프레시 역삼점')).toBeInTheDocument()
    expect(within(nearby).queryByText('픽업 점포')).not.toBeInTheDocument()
  })

  it('점포를 안 골랐고 위치를 거절하면 내 지역 첫 점포로 홈을 채운다', async () => {
    mockPosition(false)
    mockApi({ stores: [noCoords, gangnam, yeoksam] })
    renderHome()
    const row = await screen.findByRole('link', { name: /^내 지역 점포 프레시 좌표없음점/ })
    expect(within(row).getByText('바꾸기')).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/stores/3/products'))
    expect(localStorage.getItem('freshlink.pickupStore.s')).toBeNull()
  })

  it('주변 점포를 누르면 픽업 점포는 그대로 두고 그 점포 둘러보기로만 간다(11/11)', async () => {
    mockApi()
    const router = renderHome()
    const nearby = await screen.findByRole('region', { name: '내 주변 점포' })
    await userEvent.click(await within(nearby).findByRole('link', { name: /프레시 역삼점/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores/2'))
    expect(localStorage.getItem('freshlink.pickupStore.s')).toBeNull()
  })

  it('위치 답을 기다리는 동안 빈 화면 대신 자리표시를 보인다', async () => {
    mockPosition('never')
    mockApi()
    renderHome()
    expect(await screen.findByText('가까운 점포를 찾는 중')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalledWith('/stores/1/products')
  })

  it('내 지역에 점포가 하나도 없을 때만 점포 찾기 안내를 보인다', async () => {
    mockApi({ stores: [] })
    const router = renderHome()
    expect(
      await screen.findByText(
        '점포 검색에서 다른 지역 점포를 찾아 [픽업 점포로 정하기]를 눌러 주세요.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('link', { name: '점포 찾기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores'))
  })

  it('점포 목록을 못 불러오면 다시 시도를 보인다', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/me') return { data: me }
      throw new Error('500')
    })
    renderHome()
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
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

  it('상품 줄 순서는 신상품 → 오늘 마감세일 → 베스트 상품이고, 점주 추천 줄은 없다(11/11)', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const fresh = await screen.findByRole('region', { name: '신상품' })
    expect(
      await within(fresh).findByText('이번 주에 새로 들어온 상품이 없어요.'),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1/products', { params: { newOnly: true } })
    const best = await screen.findByRole('region', { name: /베스트 상품/ })
    const order = [...document.querySelectorAll('section[aria-labelledby]')].map((el) =>
      el.getAttribute('aria-labelledby'),
    )
    expect(order.filter((id) => id?.startsWith('home-rail') || id === 'home-best')).toEqual([
      'home-rail-new',
      'home-rail-clearance',
      'home-best',
    ])
    expect(screen.queryByRole('region', { name: '점주 추천' })).not.toBeInTheDocument()
    expect(get).not.toHaveBeenCalledWith('/stores/1/products', { params: { recommended: true } })

    // 베스트: 최근 7일 많이 팔린 순(추천순) 앞 5개를 묻고, 1~3위 초록·4~5위 회색 순위
    expect(get).toHaveBeenCalledWith('/stores/1/products', {
      params: { sort: 'POPULAR', page: 0, size: 5 },
    })
    // 가짜 데이터는 상품이 4개라 4위까지(서버는 5개까지 준다)
    const items = within(best).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(within(items[0]).getByRole('link')).toHaveAccessibleName(/^1위, 참치김밥, /)
    expect(within(items[0]).getByText('1')).toHaveClass('bg-emerald-700')
    expect(within(items[3]).getByText('4')).toHaveClass('bg-slate-500')
    expect(within(best).getByRole('link', { name: '베스트 상품 전체 보기' })).toHaveAttribute(
      'href',
      '/customer/stores/1?sort=POPULAR',
    )
  })

  it('베스트 상품을 못 불러오면 칸을 숨긴다', async () => {
    pickGangnam()
    mockApi({ bestError: true })
    renderHome()
    await screen.findByRole('region', { name: '신상품' })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/stores/1/products', {
        params: { sort: 'POPULAR', page: 0, size: 5 },
      }),
    )
    expect(screen.queryByRole('region', { name: /베스트 상품/ })).not.toBeInTheDocument()
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

  it('배너는 제목을 그림의 대체 텍스트로만 쓰고, 공지가 있으면 공지 상세로 없으면 링크가 없다. 두 장 이상이면 멈춤 버튼이 있다', async () => {
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
    // 공지 연결이 없으면 눌러도 아무 일이 없다(링크가 아니다)
    expect(within(banner).getByRole('img', { name: '픽업 신청 안내' })).toBeInTheDocument()
    expect(within(banner).queryByRole('link', { name: '픽업 신청 안내' })).not.toBeInTheDocument()
    // 그림 위에 제목 글자를 얹지 않는다 (A18 결정 9)
    expect(within(banner).queryByText('오늘 밤 마감세일')).not.toBeInTheDocument()
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
      '/customer/stores?pick=1',
    )
  })

  it('홈 맨 위에서 당겼다 놓으면 상품 줄·점포 목록·배너를 다시 읽는다', async () => {
    pickGangnam()
    mockApi()
    renderHome()
    const rail = await screen.findByRole('region', { name: '오늘 마감세일' })
    await within(rail).findAllByRole('link', { name: /도시락|김밥/ })
    const area = screen.getByRole('heading', { name: 'freshLink 홈' }).parentElement!
    const count = (url: string) => get.mock.calls.filter(([u]) => u === url).length
    const before = {
      products: count('/stores/1/products'),
      stores: count('/stores'),
      banners: count('/members/banners'),
    }

    fireEvent.touchStart(area, { touches: [{ clientX: 10, clientY: 0 }] })
    fireEvent.touchMove(area, { touches: [{ clientX: 10, clientY: 200 }] })
    expect(screen.getByText('놓으면 새로고침')).toBeInTheDocument()
    fireEvent.touchEnd(area)

    await waitFor(() => expect(count('/stores/1/products')).toBeGreaterThan(before.products))
    await waitFor(() => expect(count('/stores')).toBeGreaterThan(before.stores))
    await waitFor(() => expect(count('/members/banners')).toBeGreaterThan(before.banners))
  })

  it('프로필이 없으면 프로필 등록 마무리 화면으로 보낸다', async () => {
    get.mockRejectedValue(notFound)
    renderHome()
    expect(await screen.findByText('프로필 등록')).toBeInTheDocument()
  })
})
