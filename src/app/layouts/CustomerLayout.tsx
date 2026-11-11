import { Home, QrCode, ReceiptText, Store, UserRound, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { NotificationBell } from '@/shared/notifications/NotificationBell'
import { cn } from '@/shared/ui/cn'

const PICKUP_QR_PATH = '/customer/orders/pickup-qr'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

const LEFT_TABS: Tab[] = [
  { to: '/customer', label: '홈', icon: Home, end: true },
  { to: '/customer/stores', label: '점포 검색', icon: Store, end: true },
]

// 공지는 마이페이지 메뉴의 [공지사항]으로 들어간다
const RIGHT_TABS: Tab[] = [
  { to: '/customer/orders', label: '주문 내역', icon: ReceiptText, end: false },
  { to: '/customer/my', label: '마이페이지', icon: UserRound, end: false },
]

/**
 * 고객 화면: 핸드폰(세로 화면)용 상단 바(로고·알림 종) + 하단 탭.
 * 하단 탭 가운데에 픽업 QR 을 크게 둔다(가게에서 바로 꺼내 보여 주는 화면이라서).
 * 로그아웃은 마이페이지에만 둔다(상단에서 잘못 눌러 로그아웃되지 않게)
 */
export function CustomerLayout() {
  const { pathname } = useLocation()
  const onPickupQr = pathname.startsWith(PICKUP_QR_PATH)
  // 픽업 QR·주문·결제(아직 주문 전) 화면에서는 [주문 내역] 칸을 켜지 않는다(주소가 /customer/orders/… 라도)
  const ordersInactive = onPickupQr || pathname.startsWith('/customer/orders/new')

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5">
        <NavLink to="/customer" className="-ml-1 flex min-h-11 items-center">
          {/* 로고 원본(final_project/로고.svg) 그대로. 색을 바꾸지 않는다 */}
          <img src="/logo.png" alt="freshLink 홈" className="h-7 w-auto" />
        </NavLink>
        <div className="-mr-2 flex items-center">
          <NotificationBell align="end" />
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4 pb-8">
        <Outlet />
      </main>
      <nav
        aria-label="하단 메뉴"
        className="sticky bottom-0 z-10 flex items-end border-t border-slate-200 bg-white pb-1"
      >
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} forceInactive={onPickupQr} />
        ))}
        <NavLink
          to={PICKUP_QR_PATH}
          className="flex flex-1 flex-col items-center gap-0.5 text-xs font-semibold text-emerald-700"
        >
          {/* 초록 바탕 + 흰 아이콘(대비 3.8:1, 그림 기준 3:1 이상) */}
          <span className="-mt-5 flex size-14 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-lg">
            <QrCode className="size-6" aria-hidden />
          </span>
          픽업 QR
        </NavLink>
        {RIGHT_TABS.map((tab) => (
          <TabLink
            key={tab.to}
            tab={tab}
            forceInactive={tab.to === '/customer/orders' && ordersInactive}
          />
        ))}
      </nav>
    </div>
  )
}

function TabLink({ tab, forceInactive }: { tab: Tab; forceInactive: boolean }) {
  const { to, label, icon: Icon, end } = tab
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 border-t-4 border-transparent text-xs text-slate-500',
          isActive && !forceInactive && 'border-emerald-600 font-semibold text-emerald-700',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </NavLink>
  )
}
