import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/shared/auth'
import { authClient } from '@/shared/auth/store'
import { RequireRole } from './RequireRole'

const owner: AuthUser = { userId: 'o', role: 'OWNER', storeId: '1' }
const customer: AuthUser = { userId: 'c', role: 'CUSTOMER' }
const admin: AuthUser = { userId: 'a', role: 'ADMIN' }

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>로그인 화면</p> },
      {
        path: '/owner',
        element: <RequireRole role="OWNER" />,
        children: [{ path: 'inventory', element: <p>점주 재고</p> }],
      },
      {
        path: '/customer',
        element: <RequireRole role="CUSTOMER" />,
        children: [{ index: true, element: <p>고객 홈</p> }],
      },
      {
        path: '/admin',
        element: <RequireRole role="ADMIN" />,
        children: [{ path: 'stores', element: <p>관리자 점포</p> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

/** 로그인 화면이 받은 "돌아갈 주소" 를 그대로 보여 준다 */
function LoginProbe() {
  const from = (useLocation().state as { from?: string } | null)?.from
  return <p>돌아갈 주소 {from}</p>
}

describe('RequireRole', () => {
  beforeEach(() => useAuthStore.setState({ user: null, restoring: false }))

  it('로그인하지 않았으면 로그인 화면으로 보낸다', () => {
    renderAt('/owner/inventory')
    expect(screen.getByText('로그인 화면')).toBeInTheDocument()
  })

  it('로그인 화면에 돌아갈 주소를 쿼리·해시까지 넘긴다', () => {
    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginProbe /> },
        {
          path: '/customer',
          element: <RequireRole role="CUSTOMER" />,
          children: [{ path: 'orders/new', element: <p>주문 화면</p> }],
        },
      ],
      { initialEntries: ['/customer/orders/new?storeId=1&productId=15#top'] },
    )
    render(<RouterProvider router={router} />)
    expect(
      screen.getByText('돌아갈 주소 /customer/orders/new?storeId=1&productId=15#top'),
    ).toBeInTheDocument()
  })

  it('역할이 맞으면 화면을 보여 준다', () => {
    useAuthStore.setState({ user: owner })
    renderAt('/owner/inventory')
    expect(screen.getByText('점주 재고')).toBeInTheDocument()
  })

  it('고객이 점주 화면에 오면 고객 홈으로 보낸다', () => {
    useAuthStore.setState({ user: customer })
    renderAt('/owner/inventory')
    expect(screen.getByText('고객 홈')).toBeInTheDocument()
  })

  it('점주가 고객 화면에 오면 재고 화면으로 보낸다', () => {
    useAuthStore.setState({ user: owner })
    renderAt('/customer')
    expect(screen.getByText('점주 재고')).toBeInTheDocument()
  })

  it('관리자는 관리자 화면을 본다', () => {
    useAuthStore.setState({ user: admin })
    renderAt('/admin/stores')
    expect(screen.getByText('관리자 점포')).toBeInTheDocument()
  })

  it('점주가 관리자 화면에 오면 재고 화면으로 보낸다', () => {
    useAuthStore.setState({ user: owner })
    renderAt('/admin/stores')
    expect(screen.getByText('점주 재고')).toBeInTheDocument()
  })

  it('고객이 관리자 화면에 오면 고객 홈으로 보낸다', () => {
    useAuthStore.setState({ user: customer })
    renderAt('/admin/stores')
    expect(screen.getByText('고객 홈')).toBeInTheDocument()
  })

  it('관리자가 점주 화면에 오면 점포 목록으로 보낸다', () => {
    useAuthStore.setState({ user: admin })
    renderAt('/owner/inventory')
    expect(screen.getByText('관리자 점포')).toBeInTheDocument()
  })

  it('로그인하지 않고 관리자 화면에 오면 로그인 화면으로 보낸다', () => {
    renderAt('/admin/stores')
    expect(screen.getByText('로그인 화면')).toBeInTheDocument()
  })

  it('보던 중 세션이 만료되면(401 갱신 실패) 보던 주소를 들고 로그인 화면으로 간다', () => {
    const signOut = vi.spyOn(authClient, 'signOut').mockResolvedValue(undefined)
    useAuthStore.setState({ user: owner })
    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginProbe /> },
        {
          path: '/owner',
          element: <RequireRole role="OWNER" />,
          children: [{ path: 'inventory', element: <p>점주 재고</p> }],
        },
      ],
      { initialEntries: ['/owner/inventory?tab=lots'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('점주 재고')).toBeInTheDocument()
    act(() => {
      useAuthStore.getState().expireSession()
    })
    expect(screen.getByText('돌아갈 주소 /owner/inventory?tab=lots')).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledTimes(1)
    signOut.mockRestore()
  })
})
