import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import { toast } from 'sonner'
import { kakaoMapKey, loadKakaoMaps, type KakaoMaps } from '../kakaoMap'
import { StoreSearchPage } from './StoreSearchPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../kakaoMap', () => ({ kakaoMapKey: vi.fn(() => null), loadKakaoMaps: vi.fn() }))
const get = vi.mocked(api.get)

/** 가짜 카카오맵: 핀(CustomOverlay 내용)을 화면에 그대로 붙여 눌러 볼 수 있게 한다. 좌표 1도 = 화면 100000px */
let fakeLevel = 5
const fakeSetBounds = vi.fn()
function fakeKakao(): KakaoMaps {
  const layer = document.createElement('div')
  layer.dataset.testid = 'fake-map-layer'
  document.body.append(layer)
  return {
    load: (cb: () => void) => cb(),
    LatLng: class {
      lat: number
      lng: number
      constructor(lat: number, lng: number) {
        this.lat = lat
        this.lng = lng
      }
    },
    LatLngBounds: class {
      extend() {}
    },
    Map: class {
      setBounds = fakeSetBounds
      panTo = vi.fn()
      setLevel = vi.fn()
      relayout = vi.fn()
      getLevel = () => fakeLevel
      getBounds = () => ({ contain: () => true })
      getProjection = () => ({
        pointFromCoords: (p: { lat: number; lng: number }) => ({
          x: p.lng * 100000,
          y: -p.lat * 100000,
        }),
      })
    },
    Marker: class {},
    event: { addListener: vi.fn(), removeListener: vi.fn() },
    CustomOverlay: class {
      private el: HTMLElement
      constructor(o: { content: HTMLElement }) {
        this.el = o.content
        layer.append(o.content)
      }
      setMap(map: unknown) {
        if (map === null) this.el.remove()
      }
    },
  } as unknown as KakaoMaps
}

const seoulStores = [
  {
    storeId: 1,
    storeCode: 'S1',
    name: '프레시 강남점',
    address: '서울 강남구 테헤란로 1',
    region: 'SEOUL',
    latitude: 37.498095,
    longitude: 127.02761,
  },
  {
    storeId: 2,
    storeCode: 'S2',
    name: '프레시 역삼점',
    address: '서울 강남구 역삼로 2',
    region: 'SEOUL',
    latitude: 37.500622,
    longitude: 127.036456,
  },
]

const seoulMe = {
  data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'SEOUL' },
}

/** 역삼역 근처로 위치를 준다 */
function allowLocation() {
  // 이미 위치를 허용한 기기처럼: 들어오자마자 위치를 쓴다
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: async () => ({ state: 'granted' }) },
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        ok({ coords: { latitude: 37.5007, longitude: 127.0365 } }),
    },
  })
}

const notFound = Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } })
const busanStore = {
  storeId: 3,
  storeCode: 'S3',
  name: '프레시 해운대점',
  address: '부산 해운대구',
  region: 'BUSAN',
}

function renderSearch(path = '/customer/stores?pick=1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer/stores', element: <StoreSearchPage /> },
      { path: '/customer', element: <p>고객 홈</p> },
      { path: '/customer/stores/:storeId', element: <p>점포 둘러보기</p> },
      { path: '/signup', element: <p>프로필 등록</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('점포 검색 (U-01)', () => {
  beforeEach(() => {
    get.mockReset()
    localStorage.clear()
    vi.mocked(kakaoMapKey).mockReturnValue(null)
    vi.mocked(toast.success).mockReset()
    fakeLevel = 5
    fakeSetBounds.mockReset()
    useAuthStore.setState({ user: { userId: 'sub-1', role: 'CUSTOMER' }, restoring: false })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
    Reflect.deleteProperty(navigator, 'permissions')
    document.querySelectorAll('[data-testid="fake-map-layer"]').forEach((e) => e.remove())
  })

  it('프로필의 거주 지역으로 먼저 찾고, 고르기(?pick=1)에서도 목록 줄을 누르면 저장하지 않고 그 점포 둘러보기로 간다', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/me') {
        return {
          data: {
            memberId: 'sub-1',
            role: 'CUSTOMER',
            name: '김',
            nickname: 'Fresh01',
            region: 'BUSAN',
          },
        }
      }
      return { data: [busanStore] }
    })
    const router = renderSearch()

    await userEvent.click(await screen.findByText('프레시 해운대점'))
    expect(get).toHaveBeenCalledWith('/stores', { params: { region: 'BUSAN' } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores/3'))
    expect(localStorage.getItem('freshlink.pickupStore.sub-1')).toBeNull()
  })

  it('검색어는 앞뒤 공백을 지워 보내고, 결과가 없으면 안내한다', async () => {
    get.mockImplementation(async (url, config) => {
      if (url === '/members/me') {
        return {
          data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'SEOUL' },
        }
      }
      const params = (config as { params: Record<string, string> }).params
      return { data: params.keyword ? [] : [busanStore] }
    })
    renderSearch()

    await userEvent.type(await screen.findByPlaceholderText('점포명이나 주소'), '  없는점포 ')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('검색어에 맞는 점포가 없어요.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores', {
      params: { region: 'SEOUL', keyword: '없는점포' },
    })
  })

  it('이미 고른 픽업 점포는 목록에 표시한다', async () => {
    localStorage.setItem(
      'freshlink.pickupStore',
      JSON.stringify({ storeId: 3, name: '프레시 해운대점' }),
    )
    get.mockImplementation(async (url) => {
      if (url === '/members/me') {
        return {
          data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'BUSAN' },
        }
      }
      return { data: [busanStore] }
    })
    renderSearch()
    const row = await screen.findByRole('link', { name: /프레시 해운대점/ })
    expect(within(row).getByText('픽업 점포')).toBeInTheDocument()
  })

  it('고르기(?pick=1)로 열면 제목이 "픽업할 점포 고르기"다', async () => {
    get.mockImplementation(async (url) => {
      if (url === '/members/me') {
        return {
          data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'BUSAN' },
        }
      }
      return { data: [busanStore] }
    })
    renderSearch()
    expect(await screen.findByRole('heading', { name: '픽업할 점포 고르기' })).toBeInTheDocument()
  })

  it('하단 메뉴로 열면(둘러보기) 점포를 눌러도 픽업 점포를 바꾸지 않고 그 점포 상품 화면으로 간다', async () => {
    localStorage.setItem(
      'freshlink.pickupStore',
      JSON.stringify({ storeId: 1, name: '프레시 강남점' }),
    )
    get.mockImplementation(async (url) => {
      if (url === '/members/me') {
        return {
          data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n1', region: 'BUSAN' },
        }
      }
      return { data: [busanStore] }
    })
    const router = renderSearch('/customer/stores')
    expect(await screen.findByRole('heading', { name: '점포 검색' })).toBeInTheDocument()
    await userEvent.click(await screen.findByText('프레시 해운대점'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores/3'))
    expect(router.state.location.state).toEqual({ storeName: '프레시 해운대점', from: 'search' })
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore.sub-1') ?? 'null')).toEqual({
      storeId: 1,
      name: '프레시 강남점',
    })
  })

  it('프로필이 없으면 프로필 등록 마무리 화면으로 보낸다', async () => {
    get.mockRejectedValue(notFound)
    renderSearch()
    expect(await screen.findByText('프로필 등록')).toBeInTheDocument()
  })

  describe('지도형 (11/11)', () => {
    const serveSeoul = (orders: string[] = []) =>
      get.mockImplementation(async (url) => {
        if (url === '/members/me') return seoulMe
        if (url === '/orders') {
          return {
            data: {
              content: orders.map((storeName, i) => ({ orderId: i + 1, storeName })),
              page: 0,
              size: 50,
              totalElements: orders.length,
              totalPages: 1,
            },
          }
        }
        return { data: seoulStores }
      })

    it('지도 키가 없으면 지도 대신 안내 한 줄을 보이고, 목록으로 찾을 수 있다', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      expect(
        await screen.findByText('지도가 아직 없어요. 아래 목록에서 점포를 찾아 주세요.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /프레시 강남점/ })).toBeInTheDocument()
    })

    it('목록 위에 개수·정렬 안내·[내 위치로]가 있고, 처음에는 이름순, 누르면 위치를 묻고 못 얻으면 알린다(11/12)', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      expect(await screen.findByText('이름순으로 보여드려요')).toBeInTheDocument()
      // 지도가 없으면(키 없음) 지역 점포 수
      expect(screen.getByText('서울특별시 2곳')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '내 위치로' }))
      expect(await screen.findByText('위치를 알 수 없어 이름순으로 보여드려요')).toBeInTheDocument()
    })

    it('지도가 있으면 지금 지도 안에 보이는 점포 수를 보인다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serveSeoul()
      renderSearch('/customer/stores')
      expect(await screen.findByText('이 지도 안 2곳')).toBeInTheDocument()
    })

    it('위치를 알면 가까운 순으로 거리와 함께 보여 준다', async () => {
      allowLocation()
      serveSeoul()
      renderSearch('/customer/stores')
      // 이미 허용한 기기면 묻지 않고 바로 가까운 순
      await waitFor(() =>
        expect(
          screen
            .getAllByRole('link', { name: /프레시/ })
            .map((l) => within(l).getByText(/프레시/).textContent),
        ).toEqual(['프레시 역삼점', '프레시 강남점']),
      )
      const links = screen.getAllByRole('link', { name: /프레시/ })
      expect(within(links[0]).getByText('100m')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: '내 위치로 가까운 순 보기' }),
      ).not.toBeInTheDocument()
    })

    it('점포 칸은 열리면 제목으로 포커스가 가고, Esc 로 닫으면 그 핀으로 돌아간다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serveSeoul()
      renderSearch('/customer/stores')

      await userEvent.click(await screen.findByRole('button', { name: '프레시 역삼점' }))
      const sheet = screen.getByRole('region', { name: '프레시 역삼점 정보' })
      expect(within(sheet).getByRole('heading', { name: /프레시 역삼점/ })).toHaveFocus()
      expect(screen.getByText('지도에서 고른 점포 정보를 열었어요')).toHaveAttribute(
        'aria-live',
        'polite',
      )

      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('region', { name: '프레시 역삼점 정보' })).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '프레시 역삼점' })).toHaveFocus(),
      )
    })

    it('탭은 화살표 키로 옮기고 고르며, [목록만]은 켜짐 상태를 알린다', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      const near = await screen.findByRole('tab', { name: '가까운순' })
      expect(near).toHaveAttribute('aria-selected', 'true')
      near.focus()
      await userEvent.keyboard('{ArrowRight}')
      const recent = screen.getByRole('tab', { name: '최근 주문' })
      expect(recent).toHaveFocus()
      expect(recent).toHaveAttribute('aria-selected', 'true')
      await userEvent.keyboard('{End}')
      expect(screen.getByRole('tab', { name: '단골 점포' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await userEvent.keyboard('{ArrowRight}')
      expect(screen.getByRole('tab', { name: '가까운순' })).toHaveFocus()

      const listOnly = screen.getByRole('button', { name: '목록만' })
      expect(listOnly).toHaveAttribute('aria-pressed', 'false')
      await userEvent.click(listOnly)
      expect(listOnly).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByText(/지도가 아직 없어요/)).not.toBeInTheDocument()
    })

    it('♥ 알림은 이 기기에서 처음 넣을 때 한 번만 띄운다', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      await userEvent.click(await screen.findByRole('button', { name: '프레시 역삼점 단골 점포' }))
      await userEvent.click(screen.getByRole('button', { name: '프레시 강남점 단골 점포' }))
      expect(vi.mocked(toast.success)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        '단골 점포에 넣었어요. [단골 점포] 탭에서 모아 볼 수 있어요.',
      )
    })

    it('핀을 누르면 점포 칸이 열리고, [픽업 점포로 정하기]로 이 기기에 저장한다(둘러보기)', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      allowLocation()
      serveSeoul()
      renderSearch('/customer/stores')

      await userEvent.click(await screen.findByRole('button', { name: '프레시 역삼점, 100m' }))
      const sheet = screen.getByRole('region', { name: '프레시 역삼점 정보' })
      expect(within(sheet).getByText('서울 강남구 역삼로 2')).toBeInTheDocument()
      expect(within(sheet).getByRole('link', { name: '점포 보기' })).toHaveAttribute(
        'href',
        '/customer/stores/2',
      )
      await userEvent.click(within(sheet).getByRole('button', { name: '픽업 점포로 정하기' }))
      expect(within(sheet).getByText('✓ 내 픽업 점포')).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem('freshlink.pickupStore.sub-1') ?? 'null')).toEqual({
        storeId: 2,
        name: '프레시 역삼점',
      })
      // 핀에도 내 픽업 점포가 보인다
      expect(
        screen.getByRole('button', { name: '프레시 역삼점, 100m, 내 픽업 점포' }),
      ).toBeInTheDocument()

      await userEvent.click(within(sheet).getByRole('button', { name: '점포 정보 닫기' }))
      expect(screen.queryByRole('region', { name: '프레시 역삼점 정보' })).not.toBeInTheDocument()
    })

    it('고르기(?pick=1)에서는 점포 칸의 [픽업 점포로 정하기]가 저장하고 홈으로 간다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serveSeoul()
      const router = renderSearch('/customer/stores?pick=1')
      await userEvent.click(await screen.findByRole('button', { name: '프레시 강남점' }))
      await userEvent.click(screen.getByRole('button', { name: '픽업 점포로 정하기' }))
      await waitFor(() => expect(router.state.location.pathname).toBe('/customer'))
      expect(JSON.parse(localStorage.getItem('freshlink.pickupStore.sub-1') ?? 'null')).toEqual({
        storeId: 1,
        name: '프레시 강남점',
      })
    })

    it('♥를 누르면 단골 점포 탭에 모이고, 다시 누르면 빠진다', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      await userEvent.click(await screen.findByRole('button', { name: '프레시 역삼점 단골 점포' }))
      expect(screen.getByRole('button', { name: '프레시 역삼점 단골 점포' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await userEvent.click(screen.getByRole('tab', { name: '단골 점포' }))
      expect(screen.getByText('단골 점포 1곳')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /프레시 역삼점/ })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /프레시 강남점/ })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: '프레시 역삼점 단골 점포' }))
      expect(screen.getByText('단골 점포가 아직 없어요.')).toBeInTheDocument()
    })

    it('최근 주문 탭은 주문 내역의 점포를 최근 순서대로 한 번씩 보여 준다', async () => {
      serveSeoul(['프레시 역삼점', '프레시 해운대점', '프레시 역삼점'])
      renderSearch('/customer/stores')
      await userEvent.click(await screen.findByRole('tab', { name: '최근 주문' }))
      expect(await screen.findByText(/최근 주문한 점포 1곳/)).toBeInTheDocument()
      expect(
        screen.getByText('지금 고른 지역(서울특별시)에서 주문한 점포만 보여요.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /프레시 역삼점/ })).toBeInTheDocument()
      expect(get).toHaveBeenCalledWith('/orders', {
        params: { tab: 'ALL', page: 0, size: 50 },
      })
    })

    it('주문이 없으면 최근 주문 탭에 안내를 보인다', async () => {
      serveSeoul()
      renderSearch('/customer/stores')
      await userEvent.click(await screen.findByRole('tab', { name: '최근 주문' }))
      expect(await screen.findByText('서울특별시에서 주문한 점포가 없어요.')).toBeInTheDocument()
      expect(screen.getByText('주문하면 여기에서 다시 찾을 수 있어요.')).toBeInTheDocument()
    })
  })

  describe('겹치는 핀 묶기 (11/11)', () => {
    // 강남점 바로 옆(화면에서 겹침)과 같은 자리(좌표 거의 같음) 점포
    const near = {
      ...seoulStores[0],
      storeId: 7,
      storeCode: 'S7',
      name: '프레시 강남역점',
      address: '서울 강남구 강남대로 7',
      latitude: 37.4983,
      longitude: 127.0279,
    }
    const same = {
      ...near,
      storeId: 8,
      storeCode: 'S8',
      name: '프레시 강남2점',
      latitude: 37.498096,
      longitude: 127.027611,
    }
    const serve = (list: unknown[]) =>
      get.mockImplementation(async (url) => (url === '/members/me' ? seoulMe : { data: list }))

    it('이름표가 겹치는 핀은 "N곳" 하나로 묶고, 누르면 그 점포들이 보이게 확대한다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serve([...seoulStores, near])
      renderSearch('/customer/stores')

      const cluster = await screen.findByRole('button', {
        name: '점포 2곳: 프레시 강남점, 프레시 강남역점. 누르면 가까이 보여 줘요',
      })
      expect(cluster).toHaveTextContent('2곳')
      // 떨어진 역삼점은 그대로 핀 하나
      expect(screen.getByRole('button', { name: '프레시 역삼점' })).toBeInTheDocument()
      fakeSetBounds.mockReset()
      await userEvent.click(cluster)
      expect(fakeSetBounds).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('region', { name: '이 자리 점포 목록' })).not.toBeInTheDocument()
    })

    it('같은 자리라 더 확대해도 겹치면 목록으로 보여 주고, 고르면 그 점포 칸이 열린다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serve([seoulStores[0], same])
      renderSearch('/customer/stores')

      await userEvent.click(await screen.findByRole('button', { name: /^점포 2곳: / }))
      const list = screen.getByRole('region', { name: '이 자리 점포 목록' })
      expect(within(list).getByRole('heading', { name: '이 자리 점포 2곳' })).toHaveFocus()
      await userEvent.click(within(list).getByRole('button', { name: /프레시 강남2점/ }))
      expect(screen.getByRole('region', { name: '프레시 강남2점 정보' })).toBeInTheDocument()
      // 고른 점포는 묶지 않고 따로 보인다
      expect(screen.getByRole('button', { name: '프레시 강남2점' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it('목록을 Esc 로 닫으면 묶음 핀으로 포커스가 돌아간다', async () => {
      vi.mocked(kakaoMapKey).mockReturnValue('test-key')
      vi.mocked(loadKakaoMaps).mockResolvedValue(fakeKakao())
      serve([seoulStores[0], same])
      renderSearch('/customer/stores')
      await userEvent.click(await screen.findByRole('button', { name: /^점포 2곳: / }))
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('region', { name: '이 자리 점포 목록' })).not.toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('button', { name: /^점포 2곳: / })).toHaveFocus())
    })
  })
})
