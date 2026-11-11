import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import { StoreSearchPage } from './StoreSearchPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const get = vi.mocked(api.get)

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
    useAuthStore.setState({ user: { userId: 'sub-1', role: 'CUSTOMER' }, restoring: false })
  })

  it('프로필의 거주 지역으로 먼저 찾고, 점포를 누르면 픽업 점포로 저장하고 고객 홈으로 돌아간다', async () => {
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer'))
    expect(screen.getByText('고객 홈')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore') ?? 'null')).toEqual({
      storeId: 3,
      name: '프레시 해운대점',
    })
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

  it('고른 점포를 내 픽업 점포로 남긴다', async () => {
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
    await userEvent.click(await screen.findByText('프레시 해운대점'))
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore') ?? 'null')).toEqual({
      storeId: 3,
      name: '프레시 해운대점',
    })
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
    expect(JSON.parse(localStorage.getItem('freshlink.pickupStore') ?? 'null')).toEqual({
      storeId: 1,
      name: '프레시 강남점',
    })
  })

  it('프로필이 없으면 프로필 등록 마무리 화면으로 보낸다', async () => {
    get.mockRejectedValue(notFound)
    renderSearch()
    expect(await screen.findByText('프로필 등록')).toBeInTheDocument()
  })
})
