import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import { CustomerHomePage } from './CustomerHomePage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)

const notFound = Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } })
const gangnam = {
  storeId: 1,
  storeCode: 'S1',
  name: '프레시 강남점',
  address: '서울 강남구 테헤란로 1',
  region: 'SEOUL',
  latitude: 37.498095,
  longitude: 127.02761,
}
const haeundae = {
  storeId: 10,
  storeCode: 'B1',
  name: '프레시 해운대점',
  address: '부산 해운대구',
  region: 'BUSAN',
  latitude: 35.1631,
  longitude: 129.1636,
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  get.mockReset()
  useAuthStore.setState({ user: { userId: 's', role: 'CUSTOMER' }, restoring: false })
  get.mockImplementation(async (url, config) => {
    const params = (config as { params?: Record<string, unknown> } | undefined)?.params ?? {}
    if (url === '/members/me')
      return {
        data: { memberId: 's', role: 'CUSTOMER', name: '김', nickname: 'n', region: 'SEOUL' },
      }
    if (url === '/members/banners') throw notFound
    if (url === '/stores') return { data: params.region === 'BUSAN' ? [haeundae] : [gangnam] }
    if (url === '/stores/1') return { data: { ...gangnam, description: null, imageUrl: null } }
    if (/^\/stores\/\d+\//.test(String(url))) return { data: [] }
    throw new Error(`unexpected ${String(url)}`)
  })
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

function at(position: { latitude: number; longitude: number } | 'denied') {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
        position === 'denied'
          ? fail({ code: 1 } as GeolocationPositionError)
          : ok({ coords: position } as GeolocationPosition),
    },
  })
}
const BUSAN = { latitude: 35.1588, longitude: 129.1603 }
const pickGangnam = () =>
  localStorage.setItem(
    'freshlink.pickupStore',
    JSON.stringify({ storeId: 1, name: '프레시 강남점' }),
  )

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/customer', element: <CustomerHomePage /> }], {
    initialEntries: ['/customer'],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('홈 더 가까운 점포 안내 (11/14 시안 가·버튼 안 1)', () => {
  it('부산에서 서울 픽업 점포로 열면 픽업 점포 줄 아래에 안내하고, [바꾸기]로 픽업 점포를 바꾼다', async () => {
    pickGangnam()
    at(BUSAN)
    renderHome()
    const notice = await screen.findByRole('region', { name: '더 가까운 점포 안내' })
    expect(notice).toHaveTextContent(
      '픽업 점포가 지금 계신 곳에서 멀어요. 더 가까운 프레시 해운대점(600m)이 있어요.',
    )
    fireEvent.click(screen.getByRole('button', { name: '프레시 해운대점으로 바꾸기' }))
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore.s') ?? '{}')).toEqual({
      storeId: 10,
      name: '프레시 해운대점',
    })
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '더 가까운 점포 안내' })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /픽업 점포 프레시 해운대점/ })).toBeInTheDocument()
  })

  it('[그대로 두기]를 누르면 이번 접속 동안 다시 안 띄운다', async () => {
    pickGangnam()
    at(BUSAN)
    renderHome()
    fireEvent.click(await screen.findByRole('button', { name: '그대로 두기' }))
    expect(screen.queryByRole('region', { name: '더 가까운 점포 안내' })).not.toBeInTheDocument()
    expect(sessionStorage.getItem('freshlink.nearbyNotice.dismissed')).toBe('1')
    // 사라진 버튼 대신 픽업 점포 줄로 초점을 옮긴다
    await waitFor(() => expect(document.activeElement?.id).toBe('pickup-store-row'))
  })

  it('이번 접속에서 이미 닫았거나, 위치 권한이 없거나, 픽업 점포가 가까우면 안 띄운다', async () => {
    pickGangnam()
    sessionStorage.setItem('freshlink.nearbyNotice.dismissed', '1')
    at(BUSAN)
    renderHome()
    await screen.findByRole('link', { name: /픽업 점포 프레시 강남점/ })
    expect(screen.queryByRole('region', { name: '더 가까운 점포 안내' })).not.toBeInTheDocument()
  })

  it('위치를 거절하면 안 띄운다', async () => {
    pickGangnam()
    at('denied')
    renderHome()
    await screen.findByRole('link', { name: /픽업 점포 프레시 강남점/ })
    expect(screen.queryByRole('region', { name: '더 가까운 점포 안내' })).not.toBeInTheDocument()
  })

  it('픽업 점포를 안 골랐으면 지금 위치의 시·도에서 가장 가까운 점포가 임시 점포다', async () => {
    at(BUSAN)
    renderHome()
    expect(
      await screen.findByRole('link', { name: /가까운 점포 프레시 해운대점/ }),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores', { params: { region: 'BUSAN' } })
    expect(screen.queryByRole('region', { name: '더 가까운 점포 안내' })).not.toBeInTheDocument()
  })
})
