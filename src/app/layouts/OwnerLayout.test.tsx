import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { OwnerLayout } from './OwnerLayout'

// 알림 종은 서버를 부르므로 이 테스트에서는 빈 칸으로 바꾼다
vi.mock('@/shared/notifications/NotificationBell', () => ({ NotificationBell: () => null }))
// 로고 아래 점포명은 내 점포 응답에서 가져온다(11/12 결정). 서버 대신 고정 값
vi.mock('@/owner/store/api', () => ({
  useOwnerStore: () => ({ data: { name: '프레시 강남점' } }),
}))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/owner',
        element: <OwnerLayout />,
        children: [
          { path: 'store', element: <p>점포 수정 본문</p> },
          { path: 'store/password', element: <p>비밀번호 본문</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

const activeLinks = () =>
  screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')

describe('OwnerLayout', () => {
  it('왼쪽 메뉴는 화면에 붙어 있어 긴 화면에서도 로그아웃이 보인다', () => {
    renderAt('/owner/store')
    expect(screen.getByRole('complementary')).toHaveClass('sticky', 'top-0', 'h-dvh', 'self-start')
    expect(screen.getByRole('navigation', { name: '점주 메뉴' })).toHaveClass('overflow-y-auto')
  })

  beforeEach(() =>
    useAuthStore.setState({
      user: { userId: 'o', role: 'OWNER', storeId: '1', passwordLogin: true },
      restoring: false,
    }),
  )

  it('로고 아래 점포명, "내 점포" 아래에 비밀번호 변경 하위 메뉴가 늘 보인다 (A15, 11/12 결정)', () => {
    renderAt('/owner/store')
    expect(screen.getByText('프레시 강남점')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '내 점포' })).toHaveAttribute('href', '/owner/store')
    // "점포 수정" 줄은 "내 점포"와 같은 곳으로 가서 11/12에 뺐다
    const sub = within(screen.getByRole('list', { name: '내 점포 메뉴' }))
    expect(sub.queryByRole('link', { name: '점포 수정' })).not.toBeInTheDocument()
    expect(sub.getByRole('link', { name: '비밀번호 변경' })).toHaveAttribute(
      'href',
      '/owner/store/password',
    )
    expect(activeLinks().map((a) => a.textContent)).toEqual(['내 점포'])
  })

  it('비밀번호 변경 화면에서는 "내 점포"와 비밀번호 변경이 켜진다', () => {
    renderAt('/owner/store/password')
    expect(screen.getByText('비밀번호 본문')).toBeInTheDocument()
    expect(activeLinks().map((a) => a.textContent)).toEqual(['내 점포', '비밀번호 변경'])
  })

  it('비밀번호 로그인 계정이 아니면 비밀번호 변경 줄을 숨긴다', () => {
    useAuthStore.setState({ user: { userId: 'o', role: 'OWNER', passwordLogin: false } })
    renderAt('/owner/store')
    expect(screen.queryByRole('link', { name: '비밀번호 변경' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '내 점포' })).toBeInTheDocument()
  })
})
