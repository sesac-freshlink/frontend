import { Home, LogOut, ReceiptText } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

const TABS = [
  { to: '/customer', label: '홈', icon: Home, end: true },
  { to: '/customer/orders', label: '주문 내역', icon: ReceiptText, end: false },
]

/** 고객 화면: 핸드폰(세로 화면)용 상단 바 + 하단 탭 */
export function CustomerLayout() {
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <p className="font-bold text-emerald-600">FreshLink</p>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="로그아웃"
          className="text-slate-500"
        >
          <LogOut className="size-5" />
        </button>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
      <nav className="sticky bottom-0 flex border-t border-slate-200 bg-white">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs text-slate-500',
                isActive && 'text-emerald-600',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
