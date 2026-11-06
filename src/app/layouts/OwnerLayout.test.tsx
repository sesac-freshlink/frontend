import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { OwnerLayout } from './OwnerLayout'

// 알림 종은 서버를 부르므로 이 테스트에서는 빈 칸으로 바꾼다
vi.mock('@/shared/notifications/NotificationBell', () => ({ NotificationBell: () => null }))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/owner',
        element: <OwnerLayout />,
        children: [{ path: 'password', element: <p>비밀번호 본문</p> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('OwnerLayout', () => {
  beforeEach(() =>
    useAuthStore.setState({
      user: { userId: 'o', role: 'OWNER', storeId: '1', passwordLogin: true },
      restoring: false,
    }),
  )

  it('사이드 메뉴 아래에 비밀번호 변경 링크가 있다 (A4)', () => {
    renderAt('/owner/password')
    expect(screen.getByText('비밀번호 본문')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '비밀번호 변경' })).toHaveAttribute(
      'href',
      '/owner/password',
    )
  })

  it('비밀번호 로그인 계정이 아니면 링크를 숨긴다', () => {
    useAuthStore.setState({ user: { userId: 'o', role: 'OWNER', passwordLogin: false } })
    renderAt('/owner/password')
    expect(screen.queryByRole('link', { name: '비밀번호 변경' })).not.toBeInTheDocument()
  })
})
