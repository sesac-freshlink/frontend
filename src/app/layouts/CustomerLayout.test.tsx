import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CustomerLayout } from './CustomerLayout'

// 알림 종은 서버를 부르므로 이 테스트에서는 빈 칸으로 바꾼다
vi.mock('@/shared/notifications/NotificationBell', () => ({ NotificationBell: () => null }))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/customer',
        element: <CustomerLayout />,
        children: [{ path: '*', element: <p>본문</p> }],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

const ordersTab = () => screen.getByRole('link', { name: '주문 내역' })

describe('CustomerLayout 하단 메뉴', () => {
  it('주문 내역 화면에서는 [주문 내역] 칸이 켜진다', () => {
    renderAt('/customer/orders')
    expect(ordersTab()).toHaveClass('font-semibold')
  })

  it('픽업 QR 화면에서는 [주문 내역] 칸을 켜지 않는다', () => {
    renderAt('/customer/orders/pickup-qr')
    expect(ordersTab()).not.toHaveClass('font-semibold')
  })

  it('주문·결제 화면(아직 주문 전)에서도 [주문 내역] 칸을 켜지 않는다', () => {
    renderAt('/customer/orders/new?storeId=1')
    expect(ordersTab()).not.toHaveClass('font-semibold')
  })
})
