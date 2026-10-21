import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import { CustomerHomePage } from './CustomerHomePage'

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

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/customer', element: <CustomerHomePage /> },
      { path: '/customer/stores/:storeId', element: <p>상품 목록</p> },
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

describe('고객 홈 점포 검색 (U-01)', () => {
  beforeEach(() => {
    get.mockReset()
    useAuthStore.setState({ user: { userId: 'sub-1', role: 'CUSTOMER' }, restoring: false })
  })

  it('프로필의 거주 지역으로 먼저 찾고, 점포를 누르면 상품 목록으로 간다', async () => {
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
    const router = renderHome()

    await userEvent.click(await screen.findByText('프레시 해운대점'))
    expect(get).toHaveBeenCalledWith('/stores', { params: { region: 'BUSAN' } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/customer/stores/3'))
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
    renderHome()

    await userEvent.type(await screen.findByPlaceholderText('점포명이나 주소'), '  없는점포 ')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/stores', {
      params: { region: 'SEOUL', keyword: '없는점포' },
    })
  })

  it('프로필이 없으면 프로필 등록 마무리 화면으로 보낸다', async () => {
    get.mockRejectedValue(notFound)
    renderHome()
    expect(await screen.findByText('프로필 등록')).toBeInTheDocument()
  })
})
