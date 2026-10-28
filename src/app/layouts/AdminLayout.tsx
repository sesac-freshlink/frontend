import { LogOut, Plus, Store } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

// 점포 목록은 end 가 있어야 /admin/stores/new 에서 두 메뉴가 함께 켜지지 않는다
const MENU = [
  { to: '/admin/stores', label: '점포 목록', icon: Store, end: true },
  { to: '/admin/stores/new', label: '점포 등록', icon: Plus, end: false },
]

/** 관리자 화면: PC 브라우저용 왼쪽 사이드 메뉴 */
export function AdminLayout() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4">
          <p className="text-lg font-bold text-emerald-600">FreshLink</p>
          <p className="text-xs text-slate-500">관리자</p>
          {user?.email && <p className="truncate text-xs text-slate-400">{user.email}</p>}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {MENU.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
