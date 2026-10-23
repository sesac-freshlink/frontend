import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore, type AuthUser } from '@/shared/auth'
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

describe('RequireRole', () => {
  beforeEach(() => useAuthStore.setState({ user: null, restoring: false }))

  it('로그인하지 않았으면 로그인 화면으로 보낸다', () => {
    renderAt('/owner/inventory')
    expect(screen.getByText('로그인 화면')).toBeInTheDocument()
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
})
