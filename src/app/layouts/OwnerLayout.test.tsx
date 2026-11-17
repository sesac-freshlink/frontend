import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { OwnerLayout } from './OwnerLayout'
import { OWNER_SIDEBAR_KEY } from './ownerSidebar'

// 알림 종은 서버를 부르므로 이 테스트에서는 빈 칸으로 바꾼다
vi.mock('@/shared/notifications/NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('@/shared/realtime/useNotificationRefresh', () => ({
  useNotificationRefresh: () => undefined,
}))
// AI 비서 버튼도 서버를 부르므로 빈 칸으로 바꾼다
vi.mock('@/owner/assistant/components/AssistantLauncher', () => ({ AssistantLauncher: () => null }))
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

  it('점포명 옆에 QR 알림 연결 불이 있고, 통로가 열리기 전에는 끊김으로 보인다 (A16, 11/13)', () => {
    renderAt('/owner/store')
    const name = screen.getByText('프레시 강남점')
    // 테스트 환경에는 EventSource 가 없어 통로가 열리지 않는다
    expect(within(name.parentElement as HTMLElement).getByRole('status')).toHaveAttribute(
      'title',
      'QR 연결 끊김, 다시 연결 중',
    )
  })

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

  describe('왼쪽 메뉴 접기·펴기 (11/14 경우 결정 E1~E8)', () => {
    beforeEach(() => localStorage.clear())
    afterEach(() => vi.restoreAllMocks())

    const toggleButton = () => screen.getByRole('button', { name: /메뉴 (접기|펴기)/ })

    it('처음에는 펼쳐 있고, 로고 줄의 [메뉴 접기]를 누르면 아이콘만 남는다', () => {
      renderAt('/owner/store')
      expect(toggleButton()).toHaveAccessibleName('메뉴 접기')
      expect(toggleButton()).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('complementary')).toHaveClass('w-56')

      fireEvent.click(toggleButton())

      expect(toggleButton()).toHaveAccessibleName('메뉴 펴기')
      expect(toggleButton()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('complementary')).toHaveClass('w-16')
      // 점포명·묶음 이름·하위 메뉴는 숨기고(E7·E8), QR 불은 남긴다(E7)
      expect(screen.queryByText('프레시 강남점')).not.toBeInTheDocument()
      expect(screen.queryByText('재고')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: '비밀번호 변경' })).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute('title', 'QR 연결 끊김, 다시 연결 중')
      // 묶음 사이에는 가는 선(E8)
      expect(screen.getAllByRole('separator')).toHaveLength(3)
    })

    it('접어도 메뉴 이름은 화면 읽기로 남고, 말풍선은 접혔을 때만 있다 (E5)', () => {
      renderAt('/owner/store')
      expect(document.querySelector('[data-rail-tip]')).toBeNull()

      fireEvent.click(toggleButton())

      expect(screen.getByRole('link', { name: '매장 재고' })).toHaveAttribute(
        'href',
        '/owner/inventory',
      )
      expect(screen.getByRole('link', { name: '내 점포' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
      const tips = [...document.querySelectorAll('[data-rail-tip]')]
      expect(tips.map((t) => t.textContent)).toContain('매출')
    })

    it('접힌 메뉴는 화면 순서대로 [메뉴 펴기]가 알림 종보다 먼저 초점을 받는다', () => {
      renderAt('/owner/store')
      fireEvent.click(toggleButton())
      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveAccessibleName('메뉴 펴기')
    })

    it('말풍선은 Esc 로 닫히고, 마우스가 떠나면 다시 뜰 수 있다 (WCAG 1.4.13)', () => {
      renderAt('/owner/store')
      fireEvent.click(toggleButton())
      const link = screen.getByRole('link', { name: '매출' })
      const tip = link.querySelector('[data-rail-tip]') as HTMLElement
      expect(tip).not.toHaveClass('hidden')
      fireEvent.keyDown(link, { key: 'Escape' })
      expect(tip).toHaveClass('hidden')
      fireEvent.mouseLeave(link)
      expect(tip).not.toHaveClass('hidden')
    })

    it('접은 상태를 이 브라우저에 기억해 다시 열어도 접혀 있다 (E4)', () => {
      renderAt('/owner/store')
      fireEvent.click(toggleButton())
      expect(localStorage.getItem(OWNER_SIDEBAR_KEY)).toBe('1')

      fireEvent.click(toggleButton())
      expect(localStorage.getItem(OWNER_SIDEBAR_KEY)).toBeNull()

      localStorage.setItem(OWNER_SIDEBAR_KEY, '1')
      renderAt('/owner/store')
      expect(screen.getAllByRole('button', { name: '메뉴 펴기' }).length).toBeGreaterThan(0)
    })

    it('저장소를 못 쓰는 브라우저에서도 펼친 채로 열리고 접기·펴기는 된다', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      renderAt('/owner/store')
      expect(toggleButton()).toHaveAccessibleName('메뉴 접기')
      fireEvent.click(toggleButton())
      expect(toggleButton()).toHaveAccessibleName('메뉴 펴기')
    })
  })
})
