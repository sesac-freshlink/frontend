import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { AdminLayout } from './AdminLayout'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { path: 'stores', element: <p>목록 본문</p> },
          { path: 'stores/new', element: <p>등록 본문</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

const activeLinks = () =>
  screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')

describe('AdminLayout', () => {
  beforeEach(() =>
    useAuthStore.setState({
      user: { userId: 'a', role: 'ADMIN', email: 'admin@test.com' },
      restoring: false,
    }),
  )

  it('점포 등록 화면에서는 점포 등록 메뉴 하나만 켜진다', () => {
    renderAt('/admin/stores/new')
    expect(screen.getByText('등록 본문')).toBeInTheDocument()
    expect(activeLinks().map((a) => a.textContent)).toEqual(['점포 등록'])
  })

  it('점포 목록 화면에서는 점포 목록 메뉴 하나만 켜지고 이메일을 보여 준다', () => {
    renderAt('/admin/stores')
    expect(activeLinks().map((a) => a.textContent)).toEqual(['점포 목록'])
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
  })
})
