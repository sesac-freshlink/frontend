import { ChartColumn, ClipboardList, History, LogOut, Package, TriangleAlert } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

const MENU = [
  { to: '/owner/inventory', label: '재고', icon: Package },
  { to: '/owner/ledger', label: '변동 이력', icon: History },
  { to: '/owner/expiring', label: '임박·폐기', icon: TriangleAlert },
  { to: '/owner/orders', label: '주문', icon: ClipboardList },
  { to: '/owner/sales', label: '매출', icon: ChartColumn },
]

/** 점주 화면: 매장 포스기(가로 화면)용 왼쪽 사이드 메뉴 */
export function OwnerLayout() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4">
          <p className="text-lg font-bold text-emerald-600">FreshLink</p>
          <p className="text-xs text-slate-500">점포 {user?.storeId ?? '-'}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {MENU.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
                  isActive && 'bg-emerald-50 text-emerald-700',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void signOut()}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="size-4" />
          로그아웃
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
