import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { StoreDetail } from '../api'
import { loadKakaoMaps } from '../kakaoMap'
import { StoreDetailPage } from './StoreDetailPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))
vi.mock('../kakaoMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../kakaoMap')>()),
  loadKakaoMaps: vi.fn(),
}))
const get = vi.mocked(api.get)
const loadMaps = vi.mocked(loadKakaoMaps)

const gangnam: StoreDetail = {
  storeId: 1,
  storeCode: 'S1',
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
  latitude: 37.498095,
  longitude: 127.02761,
  description: '강남역 11번 출구에서 200m',
  imageUrl: '/images/stores/1/abc.jpg',
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer', element: <p>점포 찾기 화면</p> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록 화면</p> },
      { path: '/customer/stores/:storeId/info', element: <StoreDetailPage /> },
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

beforeEach(() => {
  get.mockReset()
  loadMaps.mockReset()
  // CI 빌드에는 레포 변수의 카카오 키가 들어오므로 테스트마다 키를 정해 둔다 (기본: 없음)
  vi.stubEnv('VITE_KAKAO_MAP_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('고객 점포 상세', () => {
  it('GET /stores/{storeId} 로 이미지·이름·주소·설명을 보여 준다', async () => {
    get.mockResolvedValue({ data: gangnam })
    renderAt('/customer/stores/1/info')

    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores/1')
    expect(screen.getByText('서울 강남구 테헤란로 1')).toBeInTheDocument()
    expect(screen.getByText('강남역 11번 출구에서 200m')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '프레시 강남점' })).toHaveAttribute(
      'src',
      '/images/stores/1/abc.jpg',
    )
  })

  it('카카오맵 키가 없으면(테스트·로컬) 지도 자리에 안내만 둔다', async () => {
    get.mockResolvedValue({ data: gangnam })
    renderAt('/customer/stores/1/info')

    expect(await screen.findByText('지도가 아직 없어요')).toBeInTheDocument()
    expect(loadMaps).not.toHaveBeenCalled()
  })

  it('키가 있으면 카카오맵 SDK 를 키로 부르고, 불러오지 못하면 안내로 바꾼다', async () => {
    vi.stubEnv('VITE_KAKAO_MAP_KEY', 'test-key')
    loadMaps.mockRejectedValue(new Error('blocked'))
    get.mockResolvedValue({ data: gangnam })
    renderAt('/customer/stores/1/info')

    expect(await screen.findByText('지도를 불러오지 못했어요')).toBeInTheDocument()
    expect(loadMaps).toHaveBeenCalledWith('test-key')
  })

  it('관리자가 아직 넣지 않은 값은 자리표시로 둔다', async () => {
    get.mockResolvedValue({
      data: { ...gangnam, latitude: null, longitude: null, description: null, imageUrl: null },
    })
    renderAt('/customer/stores/1/info')

    expect(
      await screen.findByRole('img', { name: '프레시 강남점 이미지 없음' }),
    ).toBeInTheDocument()
    expect(screen.getByText('지도가 아직 없어요')).toBeInTheDocument()
    expect(screen.queryByText('강남역 11번 출구에서 200m')).not.toBeInTheDocument()
  })

  it('[이 점포 상품 보기]는 상품 목록으로 점포 이름을 넘긴다', async () => {
    get.mockResolvedValue({ data: gangnam })
    const router = renderAt('/customer/stores/1/info')
    await userEvent.click(await screen.findByRole('link', { name: '이 점포 상품 보기' }))

    expect(router.state.location.pathname).toBe('/customer/stores/1')
    expect(router.state.location.state).toEqual({ storeName: '프레시 강남점' })
  })

  it('불러오지 못하면(없는 점포 404 등) 안내하고 다시 시도할 수 있다', async () => {
    get.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ data: gangnam })
    renderAt('/customer/stores/9/info')

    expect(await screen.findByText('점포 정보를 불러오지 못했어요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '프레시 강남점' })).toBeInTheDocument()
  })

  it('주소의 점포 번호가 숫자가 아니면 점포 찾기로 안내한다', () => {
    renderAt('/customer/stores/abc/info')

    expect(screen.getByText('점포 주소가 올바르지 않아요.')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
})
